// app/api/recon/route.ts
//
// GET /api/recon
// Customer cylinder reconciliation:
//   For each customer, compare:
//     - Holdings on record (CustomerCylinderHolding)
//     - Active DO deliveries (sum of kg12/50 delivered but not yet returned)
//     - Empty returns recorded
//   Surfaces discrepancies.
//
// Query params:
//   branchId - required
//   search   - customer name / code filter

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId ?? undefined)
      : session.user.branchId ?? undefined;

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const search = searchParams.get("search") ?? "";

  const customers = await prisma.customer.findMany({
    where: {
      branchId,
      isActive: true,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, customerType: true },
  });

  const rows = await Promise.all(customers.map(async (c) => {
    // 1. Recorded holdings
    const holding = await prisma.customerCylinderHolding.findFirst({
      where: { customerId: c.id, branchId },
      orderBy: { createdAt: "desc" },
    });
    const held12 = holding?.kg12HeldQty ?? 0;
    const held50 = holding?.kg50HeldQty ?? 0;

    // 2. Sum of deliveries (all DELIVERED/PARTIAL DOs for this customer)
    const doDelivered = await prisma.deliveryOrder.aggregate({
      where: {
        branchId,
        status: { in: ["DELIVERED", "PARTIAL"] },
        customerPo: { customerId: c.id },
      },
      _sum: { kg12Delivered: true, kg50Delivered: true },
    });
    const totalDelivered12 = Number(doDelivered._sum.kg12Delivered ?? 0);
    const totalDelivered50 = Number(doDelivered._sum.kg50Delivered ?? 0);

    // 3. Sum of empty returns from this customer
    const returnAgg = await prisma.emptyReturn.aggregate({
      where: { branchId, customerId: c.id, source: "CUSTOMER" },
      _sum: { kg12Qty: true, kg50Qty: true },
    });
    const returned12 = Number(returnAgg._sum.kg12Qty ?? 0);
    const returned50 = Number(returnAgg._sum.kg50Qty ?? 0);

    // 4. Expected holding = delivered - returned
    const expected12 = Math.max(0, totalDelivered12 - returned12);
    const expected50 = Math.max(0, totalDelivered50 - returned50);

    // 5. Discrepancy
    const diff12 = held12 - expected12;
    const diff50 = held50 - expected50;

    return {
      customerId:    c.id,
      customerName:  c.name,
      customerCode:  c.code,
      customerType:  c.customerType,
      held12,
      held50,
      totalDelivered12,
      totalDelivered50,
      returned12,
      returned50,
      expected12,
      expected50,
      diff12,
      diff50,
      hasDiscrepancy: diff12 !== 0 || diff50 !== 0,
    };
  }));

  const summary = {
    total:          rows.length,
    discrepancies:  rows.filter(r => r.hasDiscrepancy).length,
    totalHeld12:    rows.reduce((s, r) => s + r.held12, 0),
    totalHeld50:    rows.reduce((s, r) => s + r.held50, 0),
    totalExpected12:rows.reduce((s, r) => s + r.expected12, 0),
    totalExpected50:rows.reduce((s, r) => s + r.expected50, 0),
  };

  return NextResponse.json({ rows, summary });
}