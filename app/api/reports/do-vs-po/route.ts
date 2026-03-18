// app/api/reports/do-vs-po/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId  = searchParams.get("branchId");
  const dateParam = searchParams.get("date");       // YYYY-MM-DD
  const exportXlsx = searchParams.get("export") === "1";

  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // Resolve date: default to today
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Fetch all DOs for the branch on that date (by doDate)
  const orders = await prisma.deliveryOrder.findMany({
    where: {
      branchId,
      doDate: {
        gte: targetDate,
        lt:  nextDay,
      },
    },
    orderBy: [{ doNumber: "asc" }],
    include: {
      customerPo: {
        include: {
          customer: { select: { id: true, name: true, code: true } },
        },
      },
      driver: { select: { id: true, displayName: true } },
      kenek:  { select: { id: true, displayName: true } },
      branch: { select: { code: true, name: true } },
    },
  });

  // Transform rows
  const rows = orders.map((o) => {
    // Driver display: "RUDI/WAHYU" or "RUDI" or fallback driverName
    let driverDisplay = "—";
    if (o.driver) {
      driverDisplay = o.kenek
        ? `${o.driver.displayName}/${o.kenek.displayName}`
        : o.driver.displayName;
    } else if (o.driverName) {
      driverDisplay = o.driverName;
    }

    const tonase =
      o.kg12Delivered * 12 + o.kg50Delivered * 50;

    return {
      id:            o.id,
      doNumber:      o.doNumber,
      doDate:        o.doDate,
      supplierPoRef: o.supplierPoRef ?? "—",
      driver:        driverDisplay,
      vehicleNo:     o.vehicleNo ?? "—",
      customer:      o.customerPo.customer.name,
      customerCode:  o.customerPo.customer.code,
      cpoNumber:     o.customerPo.poNumber,
      status:        o.status,
      kg12Released:  o.kg12Released,
      kg50Released:  o.kg50Released,
      kg12Delivered: o.kg12Delivered,
      kg50Delivered: o.kg50Delivered,
      tonase,
    };
  });

  // Summary totals
  const totals = rows.reduce(
    (acc, r) => ({
      kg12Released:  acc.kg12Released  + r.kg12Released,
      kg50Released:  acc.kg50Released  + r.kg50Released,
      kg12Delivered: acc.kg12Delivered + r.kg12Delivered,
      kg50Delivered: acc.kg50Delivered + r.kg50Delivered,
      tonase:        acc.tonase        + r.tonase,
    }),
    { kg12Released: 0, kg50Released: 0, kg12Delivered: 0, kg50Delivered: 0, tonase: 0 }
  );

  // ── XLSX Export ────────────────────────────────────────────────────────────
  if (exportXlsx) {
    const branch = orders[0]?.branch ?? { code: "—", name: "—" };
    const dateStr = targetDate.toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const wsData: (string | number)[][] = [
      [`DO vs PO — ${branch.name} — ${dateStr}`],
      [],
      ["No", "No DO", "Ref SPO", "Driver", "Kendaraan", "Pelanggan", "12kg Released", "50kg Released", "12kg Delivered", "50kg Delivered", "Tonase (kg)", "Status"],
    ];

    rows.forEach((r, i) => {
      wsData.push([
        i + 1,
        r.doNumber,
        r.supplierPoRef,
        r.driver,
        r.vehicleNo,
        r.customer,
        r.kg12Released,
        r.kg50Released,
        r.kg12Delivered,
        r.kg50Delivered,
        r.tonase,
        r.status,
      ]);
    });

    wsData.push([]);
    wsData.push([
      "", "TOTAL", "", "", "", "",
      totals.kg12Released, totals.kg50Released,
      totals.kg12Delivered, totals.kg50Delivered,
      totals.tonase, "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Column widths
    ws["!cols"] = [
      { wch: 4 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 12 },
      { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DO vs PO");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `DO_vs_PO_${branch.code}_${dateParam ?? targetDate.toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ rows, totals, date: targetDate.toISOString().slice(0, 10) });
}