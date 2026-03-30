// app/api/recon/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PatchSchema = z.object({
  action: z.enum(["LOCK"]),
  notes:  z.string().optional().nullable(),
});

// ─── GET /api/recon/[id] ──────────────────────────────────────────────────────
// Returns the period + auto-computed reconciliation figures from DB
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const period = await prisma.monthlyRecon.findUnique({
    where: { id },
    include: { branch: { select: { id: true, code: true, name: true } } },
  });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  const { branchId, month, year } = period;

  // Define period window
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1); // exclusive

  // Previous period end (opening balance = last day of prior month)
  const prevEnd   = new Date(year, month - 1, 1); // exclusive upper bound for "before this month"

  // ── 1. Opening stock: last WarehouseStock snapshot BEFORE this month ────────
  const openingStock = await prisma.warehouseStock.findFirst({
    where: { branchId, date: { lt: startDate } },
    orderBy: { date: "desc" },
  });

  const openingFull12  = openingStock?.kg12FullQty  ?? 0;
  const openingEmpty12 = openingStock?.kg12EmptyQty ?? 0;
  const openingFull50  = openingStock?.kg50FullQty  ?? 0;
  const openingEmpty50 = openingStock?.kg50EmptyQty ?? 0;

  // ── 2. Inbound (GR) totals this month ────────────────────────────────────────
  const [inboundAgg12, inboundAgg50] = await Promise.all([
    prisma.inboundReceiving.aggregate({
      where: { branchId, receivedAt: { gte: startDate, lt: endDate } },
      _sum: { kg12Good: true, kg50Good: true },
    }),
    Promise.resolve(null),
  ]);
  const inboundFull12 = inboundAgg12._sum.kg12Good ?? 0;
  const inboundFull50 = inboundAgg12._sum.kg50Good ?? 0;

  // ── 3. Outbound: DO kg12Released + kg50Released (non-CANCELLED) ───────────────
  const outboundAgg = await prisma.deliveryOrder.aggregate({
    where: {
      branchId,
      doDate: { gte: startDate, lt: endDate },
      status: { not: "CANCELLED" },
    },
    _sum: { kg12Released: true, kg50Released: true },
  });
  const outboundFull12 = outboundAgg._sum.kg12Released ?? 0;
  const outboundFull50 = outboundAgg._sum.kg50Released ?? 0;

  // ── 4. Empty returns this month ───────────────────────────────────────────────
  const returnAgg = await prisma.emptyReturn.aggregate({
    where: { branchId, returnedAt: { gte: startDate, lt: endDate } },
    _sum: { kg12Qty: true, kg50Qty: true },
  });
  const returnedEmpty12 = returnAgg._sum.kg12Qty ?? 0;
  const returnedEmpty50 = returnAgg._sum.kg50Qty ?? 0;

  // ── 5. Write-offs this month ──────────────────────────────────────────────────
  const writeoffAgg = await prisma.cylinderWriteoff.aggregate({
    where: { branchId, writeoffAt: { gte: startDate, lt: endDate } },
    _sum: { kg12Qty: true, kg50Qty: true },
  });
  const writeoffQty12 = writeoffAgg._sum.kg12Qty ?? 0;
  const writeoffQty50 = writeoffAgg._sum.kg50Qty ?? 0;

  // ── 6. Closing stock: last WarehouseStock snapshot IN or BEFORE end of month ─
  const closingStock = await prisma.warehouseStock.findFirst({
    where: { branchId, date: { gte: startDate, lt: endDate } },
    orderBy: { date: "desc" },
  });

  // Computed closing = opening + inbound - outbound + returned - writeoff
  const computedClosingFull12  = openingFull12  + inboundFull12  - outboundFull12  - writeoffQty12;
  const computedClosingEmpty12 = openingEmpty12 + returnedEmpty12 - outboundFull12; // empty returned minus dispatched full (which were empty before refill)
  const computedClosingFull50  = openingFull50  + inboundFull50  - outboundFull50  - writeoffQty50;
  const computedClosingEmpty50 = openingEmpty50 + returnedEmpty50 - outboundFull50;

  // Actual closing from stock table (if available)
  const actualClosingFull12  = closingStock?.kg12FullQty  ?? computedClosingFull12;
  const actualClosingEmpty12 = closingStock?.kg12EmptyQty ?? computedClosingEmpty12;
  const actualClosingFull50  = closingStock?.kg50FullQty  ?? computedClosingFull50;
  const actualClosingEmpty50 = closingStock?.kg50EmptyQty ?? computedClosingEmpty50;

  // ── 7. Variance = actual - computed ──────────────────────────────────────────
  const varianceFull12  = actualClosingFull12  - computedClosingFull12;
  const varianceEmpty12 = actualClosingEmpty12 - computedClosingEmpty12;
  const varianceFull50  = actualClosingFull50  - computedClosingFull50;
  const varianceEmpty50 = actualClosingEmpty50 - computedClosingEmpty50;

  return NextResponse.json({
    period,
    figures: {
      // 12 kg
      openingFull12,
      openingEmpty12,
      inboundFull12,
      outboundFull12,
      returnedEmpty12,
      writeoffQty12,
      computedClosingFull12,
      computedClosingEmpty12,
      actualClosingFull12,
      actualClosingEmpty12,
      varianceFull12,
      varianceEmpty12,
      // 50 kg
      openingFull50,
      openingEmpty50,
      inboundFull50,
      outboundFull50,
      returnedEmpty50,
      writeoffQty50,
      computedClosingFull50,
      computedClosingEmpty50,
      actualClosingFull50,
      actualClosingEmpty50,
      varianceFull50,
      varianceEmpty50,
    },
  });
}

// ─── PATCH /api/recon/[id] ────────────────────────────────────────────────────
// action: "LOCK" — transitions OPEN → LOCKED
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["SUPER_ADMIN", "BRANCH_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden — hanya BRANCH_MANAGER / SUPER_ADMIN" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.flatten() }, { status: 422 });
  }

  const period = await prisma.monthlyRecon.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  // Non-SUPER_ADMIN can only lock their own branch
  if (session.user.role !== "SUPER_ADMIN" && session.user.branchId !== period.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (period.status === "LOCKED") {
    return NextResponse.json({ error: "Periode sudah LOCKED" }, { status: 409 });
  }

  const updated = await prisma.monthlyRecon.update({
    where: { id: params.id },
    data: {
      status:   "LOCKED",
      lockedAt: new Date(),
      notes:    parsed.data.notes ?? period.notes,
    },
    include: { branch: { select: { code: true, name: true } } },
  });

  return NextResponse.json(updated);
}