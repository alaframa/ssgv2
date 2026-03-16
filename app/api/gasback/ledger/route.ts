// app/api/gasback/ledger/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/gasback/ledger?customerId=xxx&page=1&limit=30
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const skip  = (page - 1) * limit;

  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const [rows, total] = await Promise.all([
    prisma.gasbackLedger.findMany({
      where: { customerId },
      orderBy: { txDate: "desc" },
      skip,
      take: limit,
      include: {
        deliveryOrder: { select: { doNumber: true } },
        claim:         { select: { claimNumber: true } },
      },
    }),
    prisma.gasbackLedger.count({ where: { customerId } }),
  ]);

  // Latest running balance (most recent row)
  const latest = await prisma.gasbackLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: { runningBalance: true, txDate: true },
  });

  return NextResponse.json({
    entries: rows,
    total,
    pages: Math.ceil(total / limit),
    currentBalance: latest ? Number(latest.runningBalance) : 0,
    balanceDate:    latest?.txDate ?? null,
  });
}