// app/api/reports/do-vs-po/route.ts
//
// GET /api/reports/do-vs-po
// Fulfilment rate: CPO qty ordered vs DO qty delivered, per customer.
//
// Query params:
//   branchId  - branch filter
//   dateFrom  - CPO created date from (YYYY-MM-DD)
//   dateTo    - CPO created date to (YYYY-MM-DD)

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

  const now        = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo   = now.toISOString().slice(0, 10);

  const dateFrom = searchParams.get("dateFrom") ?? defaultFrom;
  const dateTo   = searchParams.get("dateTo")   ?? defaultTo;

  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to   = new Date(`${dateTo}T23:59:59.999Z`);

  const cpos = await prisma.customerPo.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: from, lte: to },
      status: { not: "CANCELLED" },
    },
    include: {
      customer: { select: { id: true, name: true, code: true, customerType: true } },
      deliveryOrders: {
        where: { status: { in: ["DELIVERED", "PARTIAL"] } },
        select: { kg12Delivered: true, kg50Delivered: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = cpos.map(cpo => {
    const delivered12 = cpo.deliveryOrders.reduce((s, d) => s + d.kg12Delivered, 0);
    const delivered50 = cpo.deliveryOrders.reduce((s, d) => s + d.kg50Delivered, 0);

    const ordered12 = cpo.kg12Qty;
    const ordered50 = cpo.kg50Qty;

    const totalOrdered   = ordered12 + ordered50;
    const totalDelivered = delivered12 + delivered50;

    const fulfillPct = totalOrdered > 0
      ? Math.round((totalDelivered / totalOrdered) * 100)
      : 0;

    return {
      cpoId:       cpo.id,
      poNumber:    cpo.poNumber,
      status:      cpo.status,
      createdAt:   cpo.createdAt,
      customer:    cpo.customer,
      ordered12,
      ordered50,
      delivered12,
      delivered50,
      totalOrdered,
      totalDelivered,
      fulfillPct,
      doCount:     cpo.deliveryOrders.length,
    };
  });

  const totals = {
    cpoCount:      rows.length,
    totalOrdered:  rows.reduce((s, r) => s + r.totalOrdered,   0),
    totalDelivered:rows.reduce((s, r) => s + r.totalDelivered, 0),
    fulfillPct:    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.fulfillPct, 0) / rows.length)
      : 0,
  };

  return NextResponse.json({ rows, totals, dateFrom, dateTo });
}