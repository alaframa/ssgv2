// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const paramBranchId = searchParams.get("branchId");

  // Branch resolution
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? paramBranchId ?? null
      : session.user.branchId ?? null;

  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── All queries in parallel ───────────────────────────────────────────────
  const [
    deliveriesToday,
    warehouseStock,
    hmtQuota,
    gasbackTotal,
    emptiesThisMonth,
    activeCustomers,
    cylindersInTransit,
    recentDOs,
    recentGRs,
    recentReturns,
    recentGasback,
    pendingTransitDOs,
    pendingPOs,
    latestRecon,
    doTrend7d,          
  ] = await Promise.all([
    // 1. Deliveries today (DOs created today)
    prisma.deliveryOrder.count({
      where: { branchId, doDate: { gte: todayStart, lt: todayEnd } },
    }),

    // 2. Warehouse stock (full + onTransit)
    prisma.warehouseStock.findFirst({
      where: { branchId },
      orderBy: { date: "desc" },
      select: {
        kg12FullQty: true, kg12EmptyQty: true, kg12OnTransitQty: true,
        kg50FullQty: true, kg50EmptyQty: true, kg50OnTransitQty: true,
      },
    }),


    // 3. HMT quota this month
    prisma.supplierHmtQuota.findMany({
      where: { branchId, periodMonth: now.getMonth() + 1, periodYear: now.getFullYear() },
      select: { cylinderSize: true, quotaQty: true, usedQty: true },
    }),


    // 4. Total gasback balance (sum of latest runningBalance per customer)
    prisma.gasbackLedger.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      distinct: ["customerId"],
      select: { runningBalance: true },
    }),



    // 5. Empties returned this month
    prisma.emptyReturn.aggregate({
      where: { branchId, returnedAt: { gte: monthStart, lt: monthEnd } },
      _sum: { kg12Qty: true, kg50Qty: true },
    }),

    // 6. Active customers
    prisma.customer.count({ where: { branchId, isActive: true } }),

    // 7. Cylinders in transit (sum of DO kg12Released + kg50Released where status=IN_TRANSIT)
    prisma.deliveryOrder.aggregate({
      where: { branchId, status: "IN_TRANSIT" },
      _sum: { kg12Released: true, kg50Released: true },
    }),

    // 8. Recent DOs (last 3)
    prisma.deliveryOrder.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, doNumber: true, doDate: true, status: true, createdAt: true,
        customerPo: { select: { customer: { select: { name: true } } } },
      },
    }),

    // 9. Recent GRs (last 2)
    prisma.inboundReceiving.findMany({
      where: { branchId },
      orderBy: { receivedAt: "desc" },
      take: 2,
      select: { id: true, grNumber: true, receivedAt: true, kg12Received: true, kg50Received: true, createdAt: true },
    }),

    // 10. Recent returns (last 1)
    prisma.emptyReturn.findMany({
      where: { branchId },
      orderBy: { returnedAt: "desc" },
      take: 1,
      select: { id: true, returnNumber: true, returnedAt: true, kg12Qty: true, kg50Qty: true, createdAt: true },
    }),

    // 11. Recent gasback credits (last 2)
    prisma.gasbackLedger.findMany({
      where: { branchId, txType: "CREDIT" },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        id: true, amount: true, createdAt: true,
        customer: { select: { name: true } },
      },
    }),

    // 12. Pending: DOs IN_TRANSIT for >24h
    prisma.deliveryOrder.findMany({
      where: {
        branchId,
        status: "IN_TRANSIT",
        updatedAt: { lt: new Date(now.getTime() - 86400000) },
      },
      select: { id: true, doNumber: true, updatedAt: true },
      take: 10,
    }),

    // 13. Pending: Supplier POs awaiting confirm
    prisma.supplierPo.count({
      where: { branchId, status: "DRAFT" },
    }),

    // 14. Latest recon period for this branch/month
    prisma.monthlyRecon.findFirst({
      where: { branchId, month: now.getMonth() + 1, year: now.getFullYear() },
      select: { status: true },
    }),


    // 15. Daily DO count — last 7 days
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT DATE("doDate") as day, COUNT(*) as count
      FROM "DeliveryOrder"
      WHERE "branchId" = ${branchId}
        AND "doDate" >= ${new Date(now.getTime() - 6 * 86400000)}
      GROUP BY DATE("doDate")
      ORDER BY day ASC
    `,
  ]);

  // ── Compute KPIs ──────────────────────────────────────────────────────────
  const fullCylinders =
    (warehouseStock?.kg12FullQty ?? 0) + (warehouseStock?.kg50FullQty ?? 0);


  const hmt12 = hmtQuota.find(h => h.cylinderSize === "KG12");
  const hmt50 = hmtQuota.find(h => h.cylinderSize === "KG50");
  const hmt12Pct = hmt12 && hmt12.quotaQty > 0
    ? Math.round((hmt12.usedQty / hmt12.quotaQty) * 100)
    : 0;
  const hmt50Pct = hmt50 && hmt50.quotaQty > 0
    ? Math.round((hmt50.usedQty / hmt50.quotaQty) * 100)
    : 0;


  const totalGasback = gasbackTotal.reduce((sum, g) => sum + Number(g.runningBalance), 0);

  const emptiesMonth =
    (emptiesThisMonth._sum.kg12Qty ?? 0) + (emptiesThisMonth._sum.kg50Qty ?? 0);

  const inTransitCylinders =
    (cylindersInTransit._sum.kg12Released ?? 0) +
    (cylindersInTransit._sum.kg50Released ?? 0);

  // ── Recent activity feed (merge + sort by createdAt desc, take 6) ─────────
  const activityRaw: Array<{
    id: string; type: string; label: string; sub: string; createdAt: Date
  }> = [
      ...recentDOs.map(d => ({
        id: d.id,
        type: "DO",
        label: `DO ${d.doNumber}`,
        sub: d.customerPo?.customer?.name ?? "—",
        createdAt: d.createdAt,
      })),
      ...recentGRs.map(g => ({
        id: g.id,
        type: "GR",
        label: `GR ${g.grNumber}`,
        sub: `12kg: ${g.kg12Received} · 50kg: ${g.kg50Received}`,
        createdAt: g.createdAt,
      })),
      ...recentReturns.map(r => ({
        id: r.id,
        type: "RETURN",
        label: `Retur ${r.returnNumber}`,
        sub: `12kg: ${r.kg12Qty} · 50kg: ${r.kg50Qty}`,
        createdAt: r.createdAt,
      })),
      ...recentGasback.map(g => ({
        id: g.id,
        type: "GASBACK",
        label: `Gasback Kredit`,
        sub: `${g.customer.name} +${Number(g.amount).toFixed(2)} kg`,

        createdAt: g.createdAt,
      })),
    ];
  activityRaw.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const recentActivity = activityRaw.slice(0, 6);

  // ── Pending actions ───────────────────────────────────────────────────────
  const pendingActions: Array<{ type: string; message: string; count?: number; href: string }> = [];
  if (pendingTransitDOs.length > 0) {
    pendingActions.push({
      type: "TRANSIT",
      message: `${pendingTransitDOs.length} DO masih IN_TRANSIT lebih dari 24 jam`,
      count: pendingTransitDOs.length,
      href: "/delivery-orders?status=IN_TRANSIT",
    });
  }
  if (pendingPOs > 0) {
    pendingActions.push({
      type: "PO",
      message: `${pendingPOs} Supplier PO menunggu konfirmasi`,
      count: pendingPOs,
      href: "/supplier-po?status=DRAFT",
    });
  }
  if (hmt12Pct >= 80) {
    pendingActions.push({
      type: "HMT",
      message: `HMT 12kg sudah ${hmt12Pct}% — mendekati batas kuota`,
      href: "/supplier-po",
    });
  }
  if (hmt50Pct >= 80) {
    pendingActions.push({
      type: "HMT",
      message: `HMT 50kg sudah ${hmt50Pct}% — mendekati batas kuota`,
      href: "/supplier-po",
    });
  }
  if (!latestRecon) {
    pendingActions.push({
      type: "RECON",
      message: "Belum ada periode rekonsiliasi bulan ini",
      href: "/recon",
    });
  }

  return NextResponse.json({
    kpi: {
      deliveriesToday,
      fullCylinders,
      hmt12Pct,
      hmt50Pct,
      hmt12Used: hmt12?.usedQty ?? 0,
      hmt12Quota: hmt12?.quotaQty ?? 0,
      hmt50Used: hmt50?.usedQty ?? 0,
      hmt50Quota: hmt50?.quotaQty ?? 0,

      totalGasbackKg: Math.round(totalGasback * 100) / 100,
      emptiesThisMonth: emptiesMonth,
      activeCustomers,
      inTransitCylinders,
      stock12Full: warehouseStock?.kg12FullQty ?? 0,
      stock50Full: warehouseStock?.kg50FullQty ?? 0,

    },
    recentActivity: recentActivity.map(a => ({
      ...a, 
      createdAt: a.createdAt.toISOString(),
    })),
    pendingActions,
    doTrend7d: doTrend7d.map(r => ({   // ← add this block
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    })),

  });
}