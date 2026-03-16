// app/api/warehouse/inbound/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const GrSchema = z.object({
  branchId: z.string().optional(),
  supplierPoId: z.string().optional().nullable(),
  grNumber: z.string().min(1, "GR Number wajib diisi"),
  receivedAt: z.string().min(1, "Tanggal wajib diisi"),
  kg12Received: z.coerce.number().int().min(0).default(0),
  kg12Good:     z.coerce.number().int().min(0).default(0),
  kg12Reject:   z.coerce.number().int().min(0).default(0),
  kg50Received: z.coerce.number().int().min(0).default(0),
  kg50Good:     z.coerce.number().int().min(0).default(0),
  kg50Reject:   z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

// ── GET /api/warehouse/inbound ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId ?? undefined)
      : (session.user.branchId ?? undefined);

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = 30;
  const skip  = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.inboundReceiving.findMany({
      where: { branchId },
      include: {
        supplierPo: {
          select: {
            poNumber: true,
            status: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.inboundReceiving.count({ where: { branchId } }),
  ]);

  return NextResponse.json({ records, total, pages: Math.ceil(total / limit), page });
}

// ── POST /api/warehouse/inbound ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse body
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = GrSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    console.error("[warehouse/inbound POST] validation:", JSON.stringify(issues));
    return NextResponse.json({ error: "Validasi gagal", issues }, { status: 422 });
  }
  const data = parsed.data;

  // Resolve branchId
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (data.branchId ?? session.user.branchId)
      : session.user.branchId;

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  // Duplicate GR number check
  const dup = await prisma.inboundReceiving.findUnique({ where: { grNumber: data.grNumber } });
  if (dup) {
    return NextResponse.json({ error: `GR Number "${data.grNumber}" sudah digunakan` }, { status: 409 });
  }

  // Recon lock check
  const rcvDate = new Date(data.receivedAt);
  const locked = await prisma.monthlyRecon.findFirst({
    where: { branchId, month: rcvDate.getMonth() + 1, year: rcvDate.getFullYear(), status: "LOCKED" },
  });
  if (locked) return NextResponse.json({ error: "Periode ini sudah dikunci (LOCKED)" }, { status: 423 });

  // Resolve optional PO id (empty string → null)
  const poId: string | null =
    data.supplierPoId && data.supplierPoId.trim() !== "" ? data.supplierPoId : null;

  if (poId) {
    const po = await prisma.supplierPo.findUnique({ where: { id: poId } });
    if (!po) return NextResponse.json({ error: "Supplier PO tidak ditemukan" }, { status: 404 });
    if (!["CONFIRMED", "SUBMITTED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      return NextResponse.json({ error: `PO status "${po.status}" tidak bisa menerima GR` }, { status: 400 });
    }
  }

  // Stock date (midnight)
  const stockDate = new Date(data.receivedAt);
  stockDate.setHours(0, 0, 0, 0);

  // Carry-forward base
  const todayStock = await prisma.warehouseStock.findUnique({
    where: { branchId_date: { branchId, date: stockDate } },
  });
  const base = todayStock
    ?? await prisma.warehouseStock.findFirst({ where: { branchId }, orderBy: { date: "desc" } })
    ?? { kg12FullQty:0, kg12EmptyQty:0, kg12OnTransitQty:0, kg12HmtQty:0, kg12KuotaWo:0,
         kg50FullQty:0, kg50EmptyQty:0, kg50OnTransitQty:0, kg50HmtQty:0, kg50KuotaWo:0 };

  // ── $transaction ────────────────────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {

    // 1. Create GR — use relation `connect` syntax, never bare scalar FK
    const gr = await tx.inboundReceiving.create({
      data: {
        branch:     { connect: { id: branchId } },
        grNumber:   data.grNumber,
        receivedAt: new Date(data.receivedAt),
        kg12Received: data.kg12Received,
        kg12Good:     data.kg12Good,
        kg12Reject:   data.kg12Reject,
        kg50Received: data.kg50Received,
        kg50Good:     data.kg50Good,
        kg50Reject:   data.kg50Reject,
        // Only include optional FK relations when they have a value
        ...(poId        ? { supplierPo: { connect: { id: poId } } } : {}),
        ...(data.notes  ? { notes: data.notes }                     : {}),
      },
    });

    // 2. Upsert today's WarehouseStock
    if (todayStock) {
      await tx.warehouseStock.update({
        where: { branchId_date: { branchId, date: stockDate } },
        data: {
          kg12FullQty: { increment: data.kg12Good },
          kg50FullQty: { increment: data.kg50Good },
        },
      });
    } else {
      await tx.warehouseStock.create({
        data: {
          branch:          { connect: { id: branchId } },
          date:            stockDate,
          kg12FullQty:     base.kg12FullQty     + data.kg12Good,
          kg12EmptyQty:    base.kg12EmptyQty,
          kg12OnTransitQty:base.kg12OnTransitQty,
          kg12HmtQty:      base.kg12HmtQty,
          kg12KuotaWo:     base.kg12KuotaWo,
          kg50FullQty:     base.kg50FullQty     + data.kg50Good,
          kg50EmptyQty:    base.kg50EmptyQty,
          kg50OnTransitQty:base.kg50OnTransitQty,
          kg50HmtQty:      base.kg50HmtQty,
          kg50KuotaWo:     base.kg50KuotaWo,
        },
      });
    }

    // 3. Update SupplierPo status if linked
    if (poId) {
      const po = await tx.supplierPo.findUnique({ where: { id: poId } });
      if (po) {
        const newStatus =
          data.kg12Good >= po.kg12Qty && data.kg50Good >= po.kg50Qty
            ? "COMPLETED"
            : "PARTIALLY_RECEIVED";
        await tx.supplierPo.update({ where: { id: poId }, data: { status: newStatus } });
      }
    }

    return gr;
  });

  return NextResponse.json(result, { status: 201 });
}