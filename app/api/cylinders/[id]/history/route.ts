// app/api/cylinders/[id]/history/route.ts
//
// GET full custody + event history for a single cylinder.
// Used by the "Cylinder Tracker" page.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bySerial = searchParams.get("serial");

  // Allow lookup by serial code as well
  const unit = bySerial
    ? await prisma.cylinderUnit.findUnique({ where: { serialCode: bySerial } })
    : await prisma.cylinderUnit.findUnique({ where: { id: params.id } });

  if (!unit) return NextResponse.json({ error: "Cylinder not found" }, { status: 404 });

  const events = await prisma.cylinderEvent.findMany({
    where:   { cylinderUnitId: unit.id },
    orderBy: { eventAt: "asc" },
    include: {
      branch:        { select: { id: true, code: true, name: true } },
      customer:      { select: { id: true, name: true, code: true, phone: true } },
      deliveryOrder: {
        select: {
          id: true,
          doNumber: true,
          doDate: true,
          driver: { select: { displayName: true } },
        },
      },
      emptyReturn: {
        select: { id: true, returnNumber: true, returnedAt: true, source: true },
      },
      writeoff: {
        select: { id: true, writeoffNumber: true, reason: true, writeoffAt: true },
      },
      gasbackLedgers: {
        select: {
          id: true,
          txType: true,
          amount: true,
          runningBalance: true,
          txDate: true,
          customer: { select: { name: true } },
        },
      },
    },
  });

  // Summary: where is it now?
  const currentUnit = await prisma.cylinderUnit.findUnique({
    where: { id: unit.id },
    include: {
      type:   { select: { size: true, label: true } },
      branch: { select: { code: true, name: true } },
    },
  });

  // Who held this cylinder historically (unique customers)
  const customerIds = [...new Set(
    events
      .filter(e => e.customerId)
      .map(e => e.customerId as string)
  )];

  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, code: true },
      })
    : [];

  // Total gasback ever generated from this cylinder
  const totalGasback = events.reduce((sum, e) => {
    if (e.gasbackKg) return sum + Number(e.gasbackKg);
    return sum;
  }, 0);

  return NextResponse.json({
    unit: currentUnit,
    events,
    summary: {
      totalEvents:      events.length,
      uniqueCustomers:  customers,
      totalGasbackKg:   totalGasback,
      currentStatus:    unit.status,
      currentCondition: unit.condition,
    },
  });
}