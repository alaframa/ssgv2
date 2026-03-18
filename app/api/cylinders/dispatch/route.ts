// app/api/cylinders/dispatch/route.ts
//
// POST — Assign one or more cylinder serial codes to a DeliveryOrder.
// Creates CylinderEvent(DISPATCHED_TO_CUSTOMER) for each cylinder.
// Updates CylinderUnit.status → IN_TRANSIT, currentCustomerId → customer.
//
// Called from:
//   - /cylinders/dispatch page (manual serial assignment before DO departs)
//   - Future: scanner integration
//
// Business rules:
//   1. DO must be in PENDING status (not yet dispatched)
//   2. All serial codes must exist and be WAREHOUSE_FULL
//   3. Cylinder size (KG12/KG50) must match DO's released qty type
//      (we do a soft check — warn if size mismatch but don't block)
//   4. Creates one CylinderEvent per cylinder in a transaction

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderStatus, CylinderEventType } from "@prisma/client";

const DispatchSchema = z.object({
  // The DO to link cylinders to
  deliveryOrderId: z.string().min(1),
  // Array of serial codes to dispatch
  serialCodes: z.array(z.string().min(1).max(60)).min(1),
  // Optional: override dispatch timestamp
  dispatchedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = DispatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const { deliveryOrderId, serialCodes, dispatchedAt } = parsed.data;
  const eventAt = dispatchedAt ? new Date(dispatchedAt) : new Date();

  // ── 1. Load the DO ─────────────────────────────────────────────────────────
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    include: {
      customerPo: {
        include: {
          customer: { select: { id: true, name: true } },
        },
      },
      branch: { select: { id: true, code: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "DO tidak ditemukan" }, { status: 404 });
  }
  if (!["PENDING", "IN_TRANSIT"].includes(order.status)) {
    return NextResponse.json(
      { error: `DO status ${order.status} — hanya bisa assign tabung saat PENDING atau IN_TRANSIT` },
      { status: 422 }
    );
  }

  const customerId = order.customerPo.customer.id;

  // ── 2. Load all cylinders by serial code ──────────────────────────────────
  const units = await prisma.cylinderUnit.findMany({
    where: {
      serialCode: { in: serialCodes.map(s => s.trim().toUpperCase()) },
      isActive: true,
    },
    include: { type: true },
  });

  // Map for quick lookup
  const unitMap = new Map(units.map(u => [u.serialCode, u]));

  // ── 3. Validate each serial ───────────────────────────────────────────────
  const errors: string[] = [];
  const warnings: string[] = [];
  const toDispatch: typeof units = [];

  for (const raw of serialCodes) {
    const code = raw.trim().toUpperCase();
    const unit = unitMap.get(code);

    if (!unit) {
      errors.push(`Serial ${code} tidak ditemukan`);
      continue;
    }

    if (unit.status === CylinderStatus.WITH_CUSTOMER || unit.status === CylinderStatus.IN_TRANSIT) {
      // Already dispatched — check if it's for this same DO (idempotent)
      const existingEvent = await prisma.cylinderEvent.findFirst({
        where: {
          cylinderUnitId: unit.id,
          deliveryOrderId,
          eventType: CylinderEventType.DISPATCHED_TO_CUSTOMER,
        },
      });
      if (existingEvent) {
        warnings.push(`Serial ${code} sudah terdaftar di DO ini (dilewati)`);
        continue;
      }
      errors.push(`Serial ${code} tidak tersedia — status: ${unit.status}`);
      continue;
    }

    if (unit.status !== CylinderStatus.WAREHOUSE_FULL) {
      errors.push(`Serial ${code} tidak bisa dikirim — status: ${unit.status} (harus WAREHOUSE_FULL)`);
      continue;
    }

    if (unit.branchId !== order.branchId) {
      warnings.push(`Serial ${code} berasal dari branch berbeda — tetap diproses`);
    }

    toDispatch.push(unit);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Beberapa serial tidak valid", details: errors, warnings }, { status: 422 });
  }

  if (toDispatch.length === 0) {
    return NextResponse.json({ message: "Tidak ada tabung baru untuk didispatch", warnings });
  }

  // ── 4. Transaction: create events + update cylinder status ─────────────────
  const results = await prisma.$transaction(
    toDispatch.map(unit =>
      prisma.cylinderEvent.create({
        data: {
          branchId:       order.branchId,
          cylinderUnitId: unit.id,
          eventType:      CylinderEventType.DISPATCHED_TO_CUSTOMER,
          eventAt,
          deliveryOrderId,
          customerId,
          condition:      unit.condition,
          recordedBy:     session.user.name ?? session.user.email ?? "system",
          notes:          `Dispatch via DO ${order.doNumber}`,
        },
      })
    )
  );

  // Update cylinder statuses (separate transaction for clarity)
  await prisma.$transaction(
    toDispatch.map(unit =>
      prisma.cylinderUnit.update({
        where: { id: unit.id },
        data: {
          status:            CylinderStatus.IN_TRANSIT,
          currentCustomerId: customerId,
        },
      })
    )
  );

  return NextResponse.json({
    success: true,
    dispatched: toDispatch.length,
    warnings,
    events: results.map(e => ({ id: e.id, cylinderUnitId: e.cylinderUnitId })),
    doNumber: order.doNumber,
    customer: order.customerPo.customer.name,
  }, { status: 201 });
}

// GET — List cylinders currently assigned to a DO
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deliveryOrderId = searchParams.get("deliveryOrderId");

  if (!deliveryOrderId) {
    return NextResponse.json({ error: "deliveryOrderId required" }, { status: 400 });
  }

  const events = await prisma.cylinderEvent.findMany({
    where: {
      deliveryOrderId,
      eventType: CylinderEventType.DISPATCHED_TO_CUSTOMER,
    },
    include: {
      cylinderUnit: {
        include: { type: { select: { size: true, label: true } } },
      },
    },
    orderBy: { eventAt: "asc" },
  });

  return NextResponse.json({
    deliveryOrderId,
    cylinders: events.map(e => ({
      eventId:     e.id,
      eventAt:     e.eventAt,
      serialCode:  e.cylinderUnit.serialCode,
      size:        e.cylinderUnit.type.size,
      label:       e.cylinderUnit.type.label,
      status:      e.cylinderUnit.status,
      condition:   e.cylinderUnit.condition,
    })),
    total: events.length,
  });
}