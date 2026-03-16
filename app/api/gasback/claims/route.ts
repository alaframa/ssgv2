// app/api/gasback/claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/gasback/claims?branchId=xxx&isPaid=&page=1&limit=30
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const isPaidStr = searchParams.get("isPaid");
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip  = (page - 1) * limit;

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const effectiveBranchId =
    session.user.role === "SUPER_ADMIN" ? branchId : session.user.branchId!;

  const where: Record<string, unknown> = { branchId: effectiveBranchId };
  if (isPaidStr === "true")  where.isPaid = true;
  if (isPaidStr === "false") where.isPaid = false;

  const [records, total] = await Promise.all([
    prisma.gasbackClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, code: true, name: true } },
        branch:   { select: { code: true } },
      },
    }),
    prisma.gasbackClaim.count({ where }),
  ]);

  return NextResponse.json({ records, total, pages: Math.ceil(total / limit) });
}

// POST /api/gasback/claims
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { customerId, branchId, qty, amountPerUnit, notes } =
    body as Record<string, unknown>;

  if (!customerId || !branchId || !qty) {
    return NextResponse.json({ error: "customerId, branchId, qty diperlukan" }, { status: 422 });
  }

  const qtyNum = Number(qty);
  const rate   = Number(amountPerUnit ?? 0);
  const total  = qtyNum * rate;

  // Auto-generate claim number: CLM-SBY-0001
  const branch = await prisma.branch.findUnique({
    where: { id: String(branchId) },
    select: { code: true },
  });
  if (!branch) return NextResponse.json({ error: "Branch tidak ditemukan" }, { status: 404 });

  const lastClaim = await prisma.gasbackClaim.findFirst({
    where: { branchId: String(branchId) },
    orderBy: { createdAt: "desc" },
    select: { claimNumber: true },
  });

  let seq = 1;
  if (lastClaim?.claimNumber) {
    const parts = lastClaim.claimNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1] ?? "0");
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  const claimNumber = `CLM-${branch.code}-${String(seq).padStart(4, "0")}`;

  // Get current running balance to compute new balance for DEBIT
  const lastLedger = await prisma.gasbackLedger.findFirst({
    where: { customerId: String(customerId) },
    orderBy: { createdAt: "desc" },
    select: { runningBalance: true },
  });
  const prevBalance   = lastLedger ? Number(lastLedger.runningBalance) : 0;
  const newBalance    = prevBalance - total;

  // $transaction: create claim + create DEBIT ledger entry
  const [claim] = await prisma.$transaction([
    prisma.gasbackClaim.create({
      data: {
        branchId: String(branchId),
        customerId: String(customerId),
        claimNumber,
        qty: qtyNum,
        amount: total,
        notes: notes ? String(notes) : null,
      },
    }),
    prisma.gasbackLedger.create({
      data: {
        branchId: String(branchId),
        customerId: String(customerId),
        txType: "DEBIT",
        qty: qtyNum,
        amount: total,
        runningBalance: newBalance,
        txDate: new Date(),
        notes: `Klaim ${claimNumber} — ${qtyNum} kg @ ${rate}`,
      },
    }),
  ]);

  // Link ledger to claim
  await prisma.gasbackLedger.updateMany({
    where: {
      customerId: String(customerId),
      txType: "DEBIT",
      notes: { contains: claimNumber },
    },
    data: { claimId: claim.id },
  });

  return NextResponse.json(claim, { status: 201 });
}