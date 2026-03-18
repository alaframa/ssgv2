// app/api/reports/pencapaian/route.ts
//
// GET /api/reports/pencapaian
// Monthly achievement: DO delivered vs HMT quota per branch per supplier.
//
// Query params:
//   branchId  - optional
//   year      - YYYY (default: current year)
//   month     - MM (default: current month)

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
      ? (searchParams.get("branchId") ?? undefined)
      : session.user.branchId ?? undefined;

  const now   = new Date();
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

  // Date range for this month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month,     1);

  // ── HMT Quotas for this period ─────────────────────────────────────────────
  const quotas = await prisma.supplierHmtQuota.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      periodYear:  year,
      periodMonth: month,
    },
    include: {
      branch:   { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, name: true, code: true } },
    },
  });

  // ── DO deliveries for this month ───────────────────────────────────────────
  const dos = await prisma.deliveryOrder.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status:      { in: ["DELIVERED", "PARTIAL"] },
      deliveredAt: { gte: monthStart, lt: monthEnd },
    },
    select: {
      branchId:      true,
      kg12Delivered: true,
      kg50Delivered: true,
    },
  });

  // Aggregate DO deliveries by branch
  const doByBranch = new Map<string, { kg12: number; kg50: number }>();
  for (const d of dos) {
    const cur = doByBranch.get(d.branchId) ?? { kg12: 0, kg50: 0 };
    cur.kg12 += d.kg12Delivered;
    cur.kg50 += d.kg50Delivered;
    doByBranch.set(d.branchId, cur);
  }

  // ── Build rows: one per (branch × supplier × size) quota ──────────────────
  const rows = quotas.map(q => {
    const del = doByBranch.get(q.branchId);
    // Match delivered qty to quota size
    const deliveredQty = q.cylinderSize === "KG12"
      ? (del?.kg12 ?? 0)
      : (del?.kg50 ?? 0);

    const achievePct = q.quotaQty > 0
      ? Math.round((deliveredQty / q.quotaQty) * 100)
      : 0;

    return {
      branchId:    q.branchId,
      branchCode:  q.branch.code,
      branchName:  q.branch.name,
      supplierId:  q.supplierId,
      supplierName:q.supplier.name,
      supplierCode:q.supplier.code,
      size:        q.cylinderSize,
      quotaQty:    q.quotaQty,
      usedQty:     q.usedQty,
      deliveredQty,
      achievePct,
      remaining:   Math.max(0, q.quotaQty - deliveredQty),
    };
  });

  // If no quota rows exist, still show DO summary per branch
  const uniqueBranchIds = [...new Set([...doByBranch.keys()])];
  const branches = branchId
    ? await prisma.branch.findMany({ where: { id: branchId }, select: { id: true, code: true, name: true } })
    : await prisma.branch.findMany({ where: { id: { in: uniqueBranchIds } }, select: { id: true, code: true, name: true } });

  const doSummary = branches.map(b => {
    const del = doByBranch.get(b.id) ?? { kg12: 0, kg50: 0 };
    return {
      branchId:   b.id,
      branchCode: b.code,
      branchName: b.name,
      kg12:       del.kg12,
      kg50:       del.kg50,
      tonase:     del.kg12 * 12 + del.kg50 * 50,
    };
  });

  return NextResponse.json({ rows, doSummary, year, month });
}