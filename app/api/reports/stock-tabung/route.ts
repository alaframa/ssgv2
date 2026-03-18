// app/api/reports/stock-tabung/route.ts
//
// GET /api/reports/stock-tabung
// Returns the latest warehouse stock snapshot per branch (or a specific branch).
//
// Query params:
//   branchId - optional (SUPER_ADMIN can omit to get all branches)
//   date     - YYYY-MM-DD snapshot date (default: latest available per branch)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const branchIdParam =
    session.user.role === "SUPER_ADMIN"
      ? searchParams.get("branchId") ?? null
      : session.user.branchId ?? null;

  const dateParam = searchParams.get("date"); // YYYY-MM-DD

  // Get all branches (or the one branch)
  const branches = await prisma.branch.findMany({
    where: branchIdParam ? { id: branchIdParam } : { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const rows = await Promise.all(
    branches.map(async (branch) => {
      const where: Record<string, unknown> = { branchId: branch.id };
      if (dateParam) {
        const d = new Date(`${dateParam}T00:00:00.000Z`);
        where.date = { lte: d };
      }

      const stock = await prisma.warehouseStock.findFirst({
        where,
        orderBy: { date: "desc" },
      });

      const hmtQuotas = await prisma.supplierHmtQuota.groupBy({
        by: ["branchId"],
        where: { branchId: branch.id },
        _sum: { quotaQty: true, usedQty: true },
      });
      const hmt = hmtQuotas[0];

      return {
        branchId:   branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        stockDate:  stock?.date ?? null,
        kg12Full:   stock?.kg12FullQty      ?? 0,
        kg12Empty:  stock?.kg12EmptyQty     ?? 0,
        kg12Transit:stock?.kg12OnTransitQty ?? 0,
        kg12Hmt:    stock?.kg12HmtQty       ?? 0,
        kg12WO:     stock?.kg12KuotaWo      ?? 0,
        kg50Full:   stock?.kg50FullQty      ?? 0,
        kg50Empty:  stock?.kg50EmptyQty     ?? 0,
        kg50Transit:stock?.kg50OnTransitQty ?? 0,
        kg50Hmt:    stock?.kg50HmtQty       ?? 0,
        kg50WO:     stock?.kg50KuotaWo      ?? 0,
        hmtQuota:   Number(hmt?._sum?.quotaQty ?? 0),
        hmtUsed:    Number(hmt?._sum?.usedQty  ?? 0),
      };
    })
  );

  return NextResponse.json({ rows, date: dateParam ?? "latest" });
}