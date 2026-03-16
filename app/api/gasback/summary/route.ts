// app/api/gasback/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GASBACK_DEFAULTS, getGasbackSettings } from "@/lib/gasback-settings";

// GET /api/gasback/summary?branchId=xxx&search=xxx&page=1&limit=30
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const search   = searchParams.get("search") ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit    = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip     = (page - 1) * limit;

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const effectiveBranchId =
    session.user.role === "SUPER_ADMIN" ? branchId : session.user.branchId!;

  const settings = await getGasbackSettings();
  const threshold = parseFloat(settings.redemption_threshold_kg);

  const customerWhere = {
    branchId: effectiveBranchId,
    isActive: true,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [customers, totalCustomers] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: {
        id: true, code: true, name: true, customerType: true,
        gasbackLedgers: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { runningBalance: true, txDate: true },
        },
        gasbackClaims: {
          where: { isPaid: false },
          select: { amount: true },
        },
      },
    }),
    prisma.customer.count({ where: customerWhere }),
  ]);

  const [creditAgg, debitAgg] = await Promise.all([
    prisma.gasbackLedger.aggregate({
      where: { branchId: effectiveBranchId, txType: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.gasbackLedger.aggregate({
      where: { branchId: effectiveBranchId, txType: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);

  const totalCredit  = Number(creditAgg._sum.amount ?? 0);
  const totalDebit   = Number(debitAgg._sum.amount  ?? 0);
  const totalBalance = totalCredit - totalDebit;

  const rows = customers.map((c) => {
    const balance     = c.gasbackLedgers[0] ? Number(c.gasbackLedgers[0].runningBalance) : 0;
    const balanceDate = c.gasbackLedgers[0]?.txDate ?? null;
    const unpaidClaims = c.gasbackClaims.reduce((s, cl) => s + Number(cl.amount), 0);
    return {
      id: c.id, code: c.code, name: c.name, customerType: c.customerType,
      balance, balanceDate, unpaidClaims,
      canRedeem: balance >= threshold,
      progress: threshold > 0 ? Math.min(100, (balance / threshold) * 100) : 0,
    };
  });

  const eligibleCount = rows.filter((r) => r.canRedeem).length;

  return NextResponse.json({
    customers: rows,
    total: totalCustomers,
    pages: Math.ceil(totalCustomers / limit),
    branchTotals: { totalCredit, totalDebit, totalBalance },
    settings,
    eligibleCount,
  });
}