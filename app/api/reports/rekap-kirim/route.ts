// app/api/reports/rekap-kirim/route.ts
//
// GET /api/reports/rekap-kirim
// Returns daily delivery summary for a given date range + branch.
//
// Query params:
//   branchId  - filter by branch (SUPER_ADMIN only; others fixed to their branch)
//   dateFrom  - YYYY-MM-DD (default: start of current month)
//   dateTo    - YYYY-MM-DD (default: today)
//   groupBy   - "day" | "customer" | "driver" (default: "day")

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

  // Date range — default: current month
  const now       = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo   = now.toISOString().slice(0, 10);

  const dateFrom = searchParams.get("dateFrom") ?? defaultFrom;
  const dateTo   = searchParams.get("dateTo")   ?? defaultTo;
  const groupBy  = searchParams.get("groupBy")  ?? "day";

  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to   = new Date(`${dateTo}T23:59:59.999Z`);

  const where: Record<string, unknown> = {
    status:      { in: ["DELIVERED", "PARTIAL"] },
    deliveredAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const dos = await prisma.deliveryOrder.findMany({
    where,
    orderBy: { deliveredAt: "asc" },
    include: {
      customerPo: {
        include: {
          customer: { select: { id: true, name: true, code: true, customerType: true } },
        },
      },
      driver: { select: { id: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  // ── Aggregate by groupBy ──────────────────────────────────────────────────
  type Row = {
    key:        string;
    label:      string;
    subLabel?:  string;
    doCount:    number;
    kg12Total:  number;
    kg50Total:  number;
    tonaseKg:   number;
    customers?: Set<string>;
    customerCount?: number;
  };

  const map = new Map<string, Row>();

  for (const d of dos) {
    let key: string;
    let label: string;
    let subLabel: string | undefined;

    if (groupBy === "customer") {
      key      = d.customerPo.customer.id;
      label    = d.customerPo.customer.name;
      subLabel = d.customerPo.customer.code;
    } else if (groupBy === "driver") {
      key      = d.driverId ?? "no-driver";
      label    = d.driver?.displayName ?? "Tanpa Driver";
      subLabel = undefined;
    } else {
      // group by day
      const delivDay = (d.deliveredAt ?? d.doDate).toISOString().slice(0, 10);
      key   = delivDay;
      label = new Date(delivDay).toLocaleDateString("id-ID", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      });
    }

    const existing = map.get(key);
    if (existing) {
      existing.doCount   += 1;
      existing.kg12Total += d.kg12Delivered;
      existing.kg50Total += d.kg50Delivered;
      existing.tonaseKg  += d.kg12Delivered * 12 + d.kg50Delivered * 50;
      existing.customers?.add(d.customerPo.customer.id);
    } else {
      map.set(key, {
        key,
        label,
        subLabel,
        doCount:   1,
        kg12Total: d.kg12Delivered,
        kg50Total: d.kg50Delivered,
        tonaseKg:  d.kg12Delivered * 12 + d.kg50Delivered * 50,
        customers: new Set([d.customerPo.customer.id]),
      });
    }
  }

  const rows = Array.from(map.values()).map(r => ({
    ...r,
    customerCount: r.customers?.size ?? 0,
    customers: undefined,
  }));

  // Totals
  const totals = {
    doCount:   dos.length,
    kg12Total: dos.reduce((s, d) => s + d.kg12Delivered, 0),
    kg50Total: dos.reduce((s, d) => s + d.kg50Delivered, 0),
    tonaseKg:  dos.reduce((s, d) => s + d.kg12Delivered * 12 + d.kg50Delivered * 50, 0),
  };

  return NextResponse.json({ rows, totals, dateFrom, dateTo, groupBy, branchId });
}