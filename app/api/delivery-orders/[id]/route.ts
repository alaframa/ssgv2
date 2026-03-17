// app/api/delivery-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGasbackRates, isWeightBasedGasback } from "@/lib/gasback-settings";

// GET /api/delivery-orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.deliveryOrder.findUnique({
    where: { id: params.id },
    include: {
      customerPo: {
        include: {
          customer: { select: { id: true, name: true, code: true, customerType: true } },
        },
      },
      branch: { select: { id: true, code: true, name: true } },
      driver: { select: { id: true, displayName: true, fullName: true } },
      kenek:  { select: { id: true, displayName: true, fullName: true } },
      gasbackLedgers: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!order) return NextResponse.json({ error: "DO tidak ditemukan" }, { status: 404 });
  return NextResponse.json(order);
}

// PATCH /api/delivery-orders/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const {
    status, kg12Delivered, kg50Delivered,
    driverId, kenetId, vehicleNo, supplierPoRef, notes,
  } = body as Record<string, unknown>;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id: params.id },
    include: {
      customerPo: { include: { customer: { select: { id: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "DO tidak ditemukan" }, { status: 404 });

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    PENDING:    ["IN_TRANSIT", "CANCELLED"],
    IN_TRANSIT: ["DELIVERED", "PARTIAL", "CANCELLED"],
    PARTIAL:    ["DELIVERED", "CANCELLED"],
    DELIVERED:  [],
    CANCELLED:  [],
  };
  if (status && typeof status === "string") {
    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Tidak dapat mengubah status dari ${order.status} ke ${status}` },
        { status: 400 }
      );
    }
  }

  // Fields that can be updated freely
  const updateData: Record<string, unknown> = {};
  if (driverId      !== undefined) updateData.driverId      = driverId      || null;
  if (kenetId       !== undefined) updateData.kenetId       = kenetId       || null;
  if (vehicleNo     !== undefined) updateData.vehicleNo     = vehicleNo     || null;
  if (supplierPoRef !== undefined) updateData.supplierPoRef = supplierPoRef || null;
  if (notes         !== undefined) updateData.notes         = notes         || null;

  // DELIVERED / PARTIAL: full transaction
  if (status === "DELIVERED" || status === "PARTIAL") {
    const kg12Del    = typeof kg12Delivered === "number" ? kg12Delivered : order.kg12Released;
    const kg50Del    = typeof kg50Delivered === "number" ? kg50Delivered : order.kg50Released;
    const customerId = order.customerPo.customerId;
    const today      = new Date(); today.setHours(0, 0, 0, 0);

    // ── Check gasback mode ───────────────────────────────────────────────────
    // In WEIGHT mode, gasback is NOT auto-credited here.
    // It is credited per-cylinder when the cylinder is weighed on return
    // via POST /api/cylinders/[id]/weigh-return.
    // In LEGACY mode (default), credit at flat rate per cylinder delivered.
    const weightMode = await isWeightBasedGasback();

    const net12 = order.kg12Released - kg12Del;
    const net50 = order.kg50Released - kg50Del;

    // Customer cylinder holding update (always runs regardless of gasback mode)
    const existingHolding = await prisma.customerCylinderHolding.findUnique({
      where: { customerId_date: { customerId, date: today } },
    });
    const lastHolding = existingHolding
      ? null
      : await prisma.customerCylinderHolding.findFirst({
          where: { customerId },
          orderBy: { date: "desc" },
        });

    let holdingOp;
    if (existingHolding) {
      holdingOp = prisma.customerCylinderHolding.update({
        where: { customerId_date: { customerId, date: today } },
        data: {
          kg12HeldQty: { increment: net12 },
          kg50HeldQty: { increment: net50 },
        },
      });
    } else {
      holdingOp = prisma.customerCylinderHolding.create({
        data: {
          branchId: order.branchId,
          customerId,
          date: today,
          kg12HeldQty: Math.max(0, (lastHolding?.kg12HeldQty ?? 0) + net12),
          kg50HeldQty: Math.max(0, (lastHolding?.kg50HeldQty ?? 0) + net50),
        },
      });
    }

    // Stock update (always runs)
    const stockOp = prisma.warehouseStock.upsert({
      where: { branchId_date: { branchId: order.branchId, date: today } },
      update: {
        kg12OnTransitQty: { decrement: order.kg12Released },
        kg12EmptyQty:     { increment: kg12Del },
        kg50OnTransitQty: { decrement: order.kg50Released },
        kg50EmptyQty:     { increment: kg50Del },
      },
      create: {
        branchId: order.branchId,
        date: today,
        kg12OnTransitQty: 0, kg12EmptyQty: kg12Del,
        kg50OnTransitQty: 0, kg50EmptyQty: kg50Del,
      },
    });

    const doUpdateOp = prisma.deliveryOrder.update({
      where: { id: params.id },
      data: {
        ...updateData,
        status: status as string,
        kg12Delivered: kg12Del,
        kg50Delivered: kg50Del,
        deliveredAt: new Date(),
      },
    });

    if (weightMode) {
      // ── WEIGHT MODE: no auto gasback credit here ─────────────────────────
      // Gasback will be credited individually when each cylinder is weighed.
      // We still do: DO update + holding update + stock update.
      const [updatedDo] = await prisma.$transaction([doUpdateOp, holdingOp, stockOp]);
      return NextResponse.json({
        ...updatedDo,
        _gasbackMode: "WEIGHT",
        _gasbackNote: "Gasback akan dihitung saat tabung ditimbang di gudang (mode WEIGHT aktif)",
      });
    } else {
      // ── LEGACY MODE: auto-credit flat rate gasback on delivery ────────────
      const { rateKg12, rateKg50 } = await getGasbackRates();

      const lastLedger = await prisma.gasbackLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
      });
      const prevBalance       = lastLedger ? Number(lastLedger.runningBalance) : 0;
      const gasbackQty        = kg12Del + kg50Del;
      const gasbackAmount     = kg12Del * rateKg12 + kg50Del * rateKg50;
      const newRunningBalance = prevBalance + gasbackAmount;

      const gasbackOp = prisma.gasbackLedger.create({
        data: {
          branchId:        order.branchId,
          customerId,
          txType:          "CREDIT",
          qty:             gasbackQty,
          amount:          gasbackAmount,
          runningBalance:  newRunningBalance,
          deliveryOrderId: params.id,
          txDate:          new Date(),
          notes: `DO ${order.doNumber} — ${kg12Del}×12kg(@${rateKg12}) + ${kg50Del}×50kg(@${rateKg50})`,
        },
      });

      const [updatedDo] = await prisma.$transaction([doUpdateOp, gasbackOp, holdingOp, stockOp]);
      return NextResponse.json(updatedDo);
    }
  }

  // Simple update (IN_TRANSIT, CANCELLED, or field-only)
  const updated = await prisma.deliveryOrder.update({
    where: { id: params.id },
    data: {
      ...updateData,
      ...(status ? { status: status as string } : {}),
    },
    include: {
      customerPo: { include: { customer: { select: { id: true, name: true, code: true } } } },
      branch:  { select: { code: true } },
      driver:  { select: { id: true, displayName: true } },
      kenek:   { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(updated);
}