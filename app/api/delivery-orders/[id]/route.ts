// app/api/delivery-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GASBACK_RATE_KG12 = 0.5;
const GASBACK_RATE_KG50 = 0.5;

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
      kenek: { select: { id: true, displayName: true, fullName: true } },
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
        { error: `Tidak bisa ubah status dari ${order.status} ke ${status}` },
        { status: 422 }
      );
    }
  }

  // Check period lock
  const doDate = new Date(order.doDate);
  const month = doDate.getMonth() + 1;
  const year = doDate.getFullYear();
  const locked = await prisma.monthlyRecon.findFirst({
    where: { branchId: order.branchId, month, year, status: "LOCKED" },
  });
  if (locked) return NextResponse.json({ error: "Periode dikunci (LOCKED)" }, { status: 423 });

  // Base update payload
  const updateData: Record<string, unknown> = {};
  if (driverId !== undefined) updateData.driverId = driverId as string | null;
  if (kenetId !== undefined) updateData.kenetId = kenetId as string | null;
  if (vehicleNo !== undefined) updateData.vehicleNo = vehicleNo as string | null;
  if (supplierPoRef !== undefined) updateData.supplierPoRef = supplierPoRef as string | null;
  if (notes !== undefined) updateData.notes = notes as string | null;

  // ── IN_TRANSIT: fullQty-- + onTransitQty++ ───────────────────────────────
  if (status === "IN_TRANSIT" && order.status === "PENDING") {
    const today = new Date(); today.setHours(0,0,0,0);
    const [updatedDo] = await prisma.$transaction([
      prisma.deliveryOrder.update({
        where: { id: params.id },
        data: { ...updateData, status: "IN_TRANSIT" },
      }),
      prisma.warehouseStock.upsert({
        where: { branchId_date: { branchId: order.branchId, date: today } },
        update: {
          kg12FullQty:      { decrement: order.kg12Released },
          kg12OnTransitQty: { increment: order.kg12Released },
          kg50FullQty:      { decrement: order.kg50Released },
          kg50OnTransitQty: { increment: order.kg50Released },
        },
        create: {
          branchId: order.branchId,
          date: today,
          kg12FullQty: 0, kg12OnTransitQty: order.kg12Released,
          kg50FullQty: 0, kg50OnTransitQty: order.kg50Released,
        },
      }),
    ]);
    return NextResponse.json(updatedDo);
  }

  // ── DELIVERED / PARTIAL ─────────────────────────────────────────────────
  if (
    (status === "DELIVERED" || status === "PARTIAL") &&
    (order.status === "IN_TRANSIT" || order.status === "PARTIAL")
  ) {
    const kg12Del = typeof kg12Delivered === "number" ? kg12Delivered : order.kg12Released;
    const kg50Del = typeof kg50Delivered === "number" ? kg50Delivered : order.kg50Released;
    const customerId = order.customerPo.customerId;
    const today = new Date(); today.setHours(0,0,0,0);

    // Get current gasback running balance
    const lastLedger = await prisma.gasbackLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    const prevBalance = lastLedger ? Number(lastLedger.runningBalance) : 0;
    const gasbackQty = kg12Del + kg50Del;
    const gasbackAmount = kg12Del * GASBACK_RATE_KG12 + kg50Del * GASBACK_RATE_KG50;
    const newRunningBalance = prevBalance + gasbackAmount;

    // Cylinder holding delta
    const net12 = order.kg12Released - kg12Del;
    const net50 = order.kg50Released - kg50Del;

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

    const [updatedDo] = await prisma.$transaction([
      // 1. Update DO
      prisma.deliveryOrder.update({
        where: { id: params.id },
        data: {
          ...updateData,
          status: status as string,
          kg12Delivered: kg12Del,
          kg50Delivered: kg50Del,
          deliveredAt: new Date(),
        },
      }),
      // 2. GasbackLedger CREDIT
      prisma.gasbackLedger.create({
        data: {
          branchId: order.branchId,
          customerId,
          txType: "CREDIT",
          qty: gasbackQty,
          amount: gasbackAmount,
          runningBalance: newRunningBalance,
          deliveryOrderId: params.id,
          txDate: new Date(),
          notes: `DO ${order.doNumber} — ${kg12Del}×12kg + ${kg50Del}×50kg`,
        },
      }),
      // 3. CustomerCylinderHolding
      holdingOp,
      // 4. WarehouseStock: onTransit-- + empty += kg delivered
      prisma.warehouseStock.upsert({
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
      }),
    ]);

    return NextResponse.json(updatedDo);
  }

  // ── Simple update (CANCELLED or field-only) ──────────────────────────────
  const updated = await prisma.deliveryOrder.update({
    where: { id: params.id },
    data: {
      ...updateData,
      ...(status ? { status: status as string } : {}),
    },
    include: {
      customerPo: { include: { customer: { select: { id: true, name: true, code: true } } } },
      branch: { select: { code: true } },
      driver: { select: { id: true, displayName: true } },
      kenek: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(updated);
}