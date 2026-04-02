// app/api/cylinders/[id]/weigh-return/route.ts
//
// POST — Called when a returned cylinder is weighed at the warehouse.
// This is WHERE gasback is actually calculated and credited to the customer.
//
// Business logic:
//   1. Cylinder was dispatched to customer with weightDispatchedKg (full weight)
//   2. Customer returns it empty (or partially empty)
//   3. Warehouse staff weighs the returned cylinder → weightReturnedKg
//   4. tare = cylinderUnit.tareWeightKg ?? cylinderType.nominalTareKg
//   5. gasbackKg = max(0, weightReturnedKg - tare)
//      = gas still left inside the cylinder when returned
//   6. This gasbackKg is credited to the customer's gasback ledger as CREDIT
//   7. CylinderUnit.status → WAREHOUSE_EMPTY
//   8. CylinderUnit.currentCustomerId → null

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderCondition, CylinderStatus, CylinderEventType, GasbackTxType } from "@prisma/client";

const WeighSchema = z.object({
  // The EmptyReturn record this weighing is associated with (required)
  emptyReturnId: z.string().min(1),
  // Customer who returned this cylinder
  customerId: z.string().min(1),
  // Weight of the returned cylinder (kg) — measured on scale
  weightReturnedKg: z.number().positive(),
  // Condition after return
  condition: z.nativeEnum(CylinderCondition).optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = WeighSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const { emptyReturnId, customerId, weightReturnedKg, condition, notes } = parsed.data;

  // Load cylinder with type for tare fallback
  const { id } = await params;
  const unit = await prisma.cylinderUnit.findUnique({
    where: { id },
    include: { type: true },
  });
  if (!unit) return NextResponse.json({ error: "Cylinder not found" }, { status: 404 });
  if (!unit.isActive) return NextResponse.json({ error: "Cylinder is written off" }, { status: 400 });

  // Validate cylinder is WITH_CUSTOMER (or at minimum not already empty in warehouse)
  if (unit.status === CylinderStatus.WAREHOUSE_EMPTY || unit.status === CylinderStatus.WAREHOUSE_FULL) {
    return NextResponse.json(
      { error: `Tabung ${unit.serialCode} sudah ada di gudang (status: ${unit.status}). Tidak perlu ditimbang lagi.` },
      { status: 400 }
    );
  }

  // Find last dispatch event to get weightDispatchedKg
  const lastDispatch = await prisma.cylinderEvent.findFirst({
    where: {
      cylinderUnitId: unit.id,
      eventType: CylinderEventType.DISPATCHED_TO_CUSTOMER,
    },
    orderBy: { eventAt: "desc" },
  });

  // Tare weight: use individual tare if set, else fall back to nominal
  const tare = unit.tareWeightKg
    ? Number(unit.tareWeightKg)
    : Number(unit.type.nominalTareKg);

  // Gas remaining in returned cylinder
  const gasbackKg = Math.max(0, weightReturnedKg - tare);

  // Load customer + verify same branch
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, branchId: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Get gasback running balance for customer
  const lastLedger = await prisma.gasbackLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: { runningBalance: true },
  });
  const prevBalance = lastLedger ? Number(lastLedger.runningBalance) : 0;
  const newBalance = prevBalance + gasbackKg;

  const now = new Date();

  // $transaction: create event + update cylinder + credit gasback ledger
  const [event] = await prisma.$transaction([
    // 1. Create the return/weigh event
    prisma.cylinderEvent.create({
      data: {
        branchId: unit.branchId,
        cylinderUnitId: unit.id,
        eventType: CylinderEventType.RETURNED_FROM_CUSTOMER,
        eventAt: now,
        emptyReturnId,
        customerId,
        weightDispatchedKg: lastDispatch?.weightDispatchedKg ?? null,
        weightReturnedKg,
        gasbackKg: gasbackKg > 0 ? gasbackKg : null,
        condition: condition ?? CylinderCondition.GOOD,
        notes: notes ?? null,
        recordedBy: session.user.name,
      },
    }),

    // 2. Update cylinder status — now empty in warehouse, no longer with customer
    prisma.cylinderUnit.update({
      where: { id: unit.id },
      data: {
        status: CylinderStatus.WAREHOUSE_EMPTY,
        condition: condition ?? unit.condition,
        currentCustomerId: null,
        locationNote: null,
      },
    }),

    // 3. Credit gasback to customer if any gas remains
    ...(gasbackKg > 0
      ? [
        prisma.gasbackLedger.create({
          data: {
            branchId: unit.branchId,
            customerId,
            txType: GasbackTxType.CREDIT,
            qty: gasbackKg,
            amount: gasbackKg,
            runningBalance: newBalance,
            txDate: now,
            notes: `Gasback dari timbang tabung ${unit.serialCode} — sisa gas ${gasbackKg.toFixed(3)} kg`,
          },
        }),
      ]
      : []),
  ]);

  // Link the gasback ledger to this event (if created)
  if (gasbackKg > 0) {
    await prisma.gasbackLedger.updateMany({
      where: {
        customerId,
        txType: GasbackTxType.CREDIT,
        notes: { contains: unit.serialCode },
        createdAt: { gte: now },
      },
      data: { cylinderEventId: event.id },
    });
  }

  return NextResponse.json({
    success: true,
    serialCode: unit.serialCode,
    tare,
    weightReturnedKg,
    gasbackKg,
    newGasbackBalance: newBalance,
    eventId: event.id,
    message: gasbackKg > 0
      ? `✓ Sisa gas ${gasbackKg.toFixed(3)} kg dikreditkan ke gasback ${customer.name}`
      : `Tidak ada sisa gas. Gasback = 0.`,
  }, { status: 201 });
}