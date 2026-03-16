// app/api/warehouse/stock/route.ts

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
      ? searchParams.get("branchId") ?? session.user.branchId ?? undefined
      : session.user.branchId ?? undefined;

  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // ── Find today's stock row (carry-forward if missing) ─────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let stock = await prisma.warehouseStock.findUnique({
    where: { branchId_date: { branchId, date: today } },
  });

  // If no row for today, carry forward from the last known row
  if (!stock) {
    stock = await prisma.warehouseStock.findFirst({
      where: { branchId },
      orderBy: { date: "desc" },
    });
  }

  // ── HMT Quota for current month ───────────────────────────────────────────
  const now = new Date();
  const supplier = await prisma.supplier.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let hmtQuota12 = 0;
  let hmtQuota50 = 0;

  if (supplier) {
    const quotas = await prisma.supplierHmtQuota.findMany({
      where: {
        branchId,
        supplierId: supplier.id,
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
      },
    });

    for (const q of quotas) {
      if (q.cylinderSize === "KG12") hmtQuota12 = q.quotaQty;
      if (q.cylinderSize === "KG50") hmtQuota50 = q.quotaQty;
    }
  }

  // ── Branch info ───────────────────────────────────────────────────────────
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true, name: true },
  });

  return NextResponse.json({
    branchId,
    branch,
    stockDate: stock?.date ?? null,
    // KG12
    kg12FullQty: stock?.kg12FullQty ?? 0,
    kg12EmptyQty: stock?.kg12EmptyQty ?? 0,
    kg12OnTransitQty: stock?.kg12OnTransitQty ?? 0,
    kg12HmtQty: stock?.kg12HmtQty ?? 0,
    kg12KuotaWo: stock?.kg12KuotaWo ?? 0,
    // KG50
    kg50FullQty: stock?.kg50FullQty ?? 0,
    kg50EmptyQty: stock?.kg50EmptyQty ?? 0,
    kg50OnTransitQty: stock?.kg50OnTransitQty ?? 0,
    kg50HmtQty: stock?.kg50HmtQty ?? 0,
    kg50KuotaWo: stock?.kg50KuotaWo ?? 0,
    // HMT Quotas
    hmtQuota12,
    hmtQuota50,
  });
}