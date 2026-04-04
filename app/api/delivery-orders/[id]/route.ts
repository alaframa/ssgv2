// app/api/delivery-orders/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGasbackRates, isWeightBasedGasback } from "@/lib/gasback-settings";
import { CylinderStatus } from "@prisma/client";
import { DoStatus } from "@prisma/client";

// GET /api/delivery-orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
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
      cylinderEvents: {
        where: { eventType: "DISPATCHED_TO_CUSTOMER" },
        include: {
          cylinderUnit: {
            include: { type: { select: { size: true, label: true } } },
          },
        },
        orderBy: { eventAt: "asc" },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "DO tidak ditemukan" }, { status: 404 });
  return NextResponse.json(order);
}

// PATCH /api/delivery-orders/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
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
        { error: `Transisi ${order.status} → ${status} tidak diizinkan` },
        { status: 422 }
      );
    }
  }

  const customerId = order.customerPo.customer.id;

  const updateData: Record<string, unknown> = {};
  if (driverId      !== undefined) updateData.driverId      = driverId      || null;
  if (kenetId       !== undefined) updateData.kenetId       = kenetId       || null;
  if (vehicleNo     !== undefined) updateData.vehicleNo     = vehicleNo     || null;
  if (supplierPoRef !== undefined) updateData.supplierPoRef = supplierPoRef || null;
  if (notes         !== undefined) updateData.notes         = notes         || null;

  // ── IN_TRANSIT: update dispatched cylinders to WITH_CUSTOMER ────────────────
  if (status === "IN_TRANSIT") {
    const dispatchedCylinders = await prisma.cylinderUnit.findMany({
      where: {
        events: { some: { deliveryOrderId: id, eventType: "DISPATCHED_TO_CUSTOMER" } },
        status: CylinderStatus.IN_TRANSIT,
      },
      select: { id: true },
    });

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: { ...updateData, status: "IN_TRANSIT" },
    });

    if (dispatchedCylinders.length > 0) {
      await prisma.cylinderUnit.updateMany({
        where: { id: { in: dispatchedCylinders.map(c => c.id) } },
        data: {
          status:            CylinderStatus.WITH_CUSTOMER,
          currentCustomerId: customerId,
        },
      });
    }

    return NextResponse.json({
      ...updated,
      _cylindersUpdated: dispatchedCylinders.length,
    });
  }

  // ── CANCELLED: return cylinders to warehouse + DECREMENT holdings ───────────
  // When a DO is cancelled, the cylinders are back in the warehouse.
  // We need to reverse the holdings increment that happened at DO creation.
  if (status === "CANCELLED") {
    const dispatchedCylinders = await prisma.cylinderUnit.findMany({
      where: {
        events: { some: { deliveryOrderId: id, eventType: "DISPATCHED_TO_CUSTOMER" } },
        status: { in: [CylinderStatus.IN_TRANSIT, CylinderStatus.WITH_CUSTOMER] },
      },
      select: { id: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDo = await tx.deliveryOrder.update({
        where: { id },
        data: { ...updateData, status: "CANCELLED" },
      });

      // Reverse the holdings that were added when this DO was created
      const holding = await tx.customerCylinderHolding.findUnique({
        where: { customerId_branchId: { customerId, branchId: order.branchId } },
      });
      if (holding) {
        await tx.customerCylinderHolding.update({
          where: { customerId_branchId: { customerId, branchId: order.branchId } },
          data: {
            kg12HeldQty: Math.max(0, holding.kg12HeldQty - order.kg12Released),
            kg50HeldQty: Math.max(0, holding.kg50HeldQty - order.kg50Released),
          },
        });
      }

      if (dispatchedCylinders.length > 0) {
        await tx.cylinderUnit.updateMany({
          where: { id: { in: dispatchedCylinders.map(c => c.id) } },
          data: {
            status: CylinderStatus.WAREHOUSE_FULL,
            currentCustomerId: null,
          },
        });
      }

      return updatedDo;
    });

    return NextResponse.json(updated);
  }

  // ── DELIVERED / PARTIAL ───────────────────────────────────────────────────────
  // Holdings are NOT touched here anymore — they were set at DO creation.
  // The only thing that reduces holdings is an EmptyReturn record.
  // We still update warehouse stock (on-transit → empty) here.
  if (status === "DELIVERED" || status === "PARTIAL") {
    const kg12Del = typeof kg12Delivered === "number" ? kg12Delivered : order.kg12Released;
    const kg50Del = typeof kg50Delivered === "number" ? kg50Delivered : order.kg50Released;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weightMode = await isWeightBasedGasback();

    // Stock update: move from onTransit → empty
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
      where: { id },
      data: {
        ...updateData,
        status: status as DoStatus,
        kg12Delivered: kg12Del,
        kg50Delivered: kg50Del,
        deliveredAt: new Date(),
      },
    });

    if (weightMode) {
      const [updatedDo] = await prisma.$transaction([doUpdateOp, stockOp]);
      return NextResponse.json({
        ...updatedDo,
        _gasbackMode: "WEIGHT",
        _gasbackNote: "Gasback akan dihitung saat tabung ditimbang di gudang (mode WEIGHT aktif)",
      });
    } else {
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
          deliveryOrderId: id,
          txDate:          new Date(),
          notes: `DO ${order.doNumber} — ${kg12Del}×12kg(@${rateKg12}) + ${kg50Del}×50kg(@${rateKg50})`,
        },
      });

      const [updatedDo] = await prisma.$transaction([doUpdateOp, gasbackOp, stockOp]);
      return NextResponse.json(updatedDo);
    }
  }

  // Simple field-only update (no status change)
  const updated = await prisma.deliveryOrder.update({
    where: { id },
    data: {
      ...updateData,
      ...(status ? { status: status as DoStatus } : {}),
    },
  });

  return NextResponse.json(updated);
}