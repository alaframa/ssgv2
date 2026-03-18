// app/api/reports/pencapaian/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam  = searchParams.get("month");   // 1-12
  const yearParam   = searchParams.get("year");    // e.g. 2026
  const exportXlsx  = searchParams.get("export") === "1";

  const now   = new Date();
  const month = monthParam  ? parseInt(monthParam,  10) : now.getMonth() + 1;
  const year  = yearParam   ? parseInt(yearParam,   10) : now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1); // exclusive

  // Fetch all branches
  const branches = await prisma.branch.findMany({ orderBy: { code: "asc" } });

  // For each branch, aggregate delivered DOs in the month
  const branchStats = await Promise.all(
    branches.map(async (branch) => {
      const orders = await prisma.deliveryOrder.findMany({
        where: {
          branchId: branch.id,
          doDate: { gte: startDate, lt: endDate },
          status: { not: "CANCELLED" },
        },
        select: {
          doDate:        true,
          kg12Delivered: true,
          kg50Delivered: true,
        },
      });

      const kg12  = orders.reduce((s, o) => s + o.kg12Delivered, 0);
      const kg50  = orders.reduce((s, o) => s + o.kg50Delivered, 0);
      const tonase = kg12 * 12 + kg50 * 50;

      // Count unique working days (days that have at least 1 DO)
      const daySet = new Set(orders.map((o) => new Date(o.doDate).toISOString().slice(0, 10)));
      const workingDays = daySet.size;
      const avgPerDay = workingDays > 0 ? Math.round(tonase / workingDays) : 0;

      // Daily breakdown (for detail rows)
      const dailyMap = new Map<string, { date: string; kg12: number; kg50: number; tonase: number; trips: number }>();
      for (const o of orders) {
        const key = new Date(o.doDate).toISOString().slice(0, 10);
        const existing = dailyMap.get(key) ?? { date: key, kg12: 0, kg50: 0, tonase: 0, trips: 0 };
        existing.kg12   += o.kg12Delivered;
        existing.kg50   += o.kg50Delivered;
        existing.tonase += o.kg12Delivered * 12 + o.kg50Delivered * 50;
        existing.trips  += 1;
        dailyMap.set(key, existing);
      }

      const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      return {
        branchId:    branch.id,
        branchCode:  branch.code,
        branchName:  branch.name,
        kg12,
        kg50,
        tonase,
        workingDays,
        avgPerDay,
        daily,
      };
    })
  );

  // Total across all branches for share calculation
  const grandTonase = branchStats.reduce((s, b) => s + b.tonase, 0);

  const result = branchStats.map((b) => ({
    ...b,
    sharePct: grandTonase > 0 ? parseFloat(((b.tonase / grandTonase) * 100).toFixed(1)) : 0,
  }));

  // ── XLSX Export ────────────────────────────────────────────────────────────
  if (exportXlsx) {
    const monthName = startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    const wsData: (string | number)[][] = [
      [`Laporan Pencapaian — ${monthName}`],
      [],
      ["Cabang", "12 kg", "50 kg", "Tonase (kg)", "Hari Kerja", "Avg/Hari (kg)", "% Share"],
    ];

    result.forEach((b) => {
      wsData.push([
        b.branchName,
        b.kg12,
        b.kg50,
        b.tonase,
        b.workingDays,
        b.avgPerDay,
        `${b.sharePct}%`,
      ]);
    });

    wsData.push([]);
    wsData.push([
      "TOTAL",
      result.reduce((s, b) => s + b.kg12,  0),
      result.reduce((s, b) => s + b.kg50,  0),
      grandTonase,
      "", "", "100%",
    ]);

    // Daily detail per branch
    for (const b of result) {
      wsData.push([], [`── ${b.branchName} — Rincian Harian ──`]);
      wsData.push(["Tanggal", "12 kg", "50 kg", "Tonase (kg)", "Trips"]);
      for (const d of b.daily) {
        const dateLabel = new Date(d.date).toLocaleDateString("id-ID", {
          weekday: "short", day: "numeric", month: "short",
        });
        wsData.push([dateLabel, d.kg12, d.kg50, d.tonase, d.trips]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pencapaian");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `Pencapaian_${year}_${String(month).padStart(2, "0")}.xlsx`;
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ month, year, branches: result, grandTonase });
}