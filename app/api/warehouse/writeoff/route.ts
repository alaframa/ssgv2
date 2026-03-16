// app/api/warehouse/writeoff/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Zod schema ────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  branchId:       z.string().min(1),
  writeoffNumber: z.string().min(1).max(50),
  writeoffAt:     z.string().min(1),
  reason:         z.enum(["RUSAK_BERAT", "HILANG", "KADALUARSA_UJI", "BOCOR_PARAH"]),
  kg12Qty:        z.number().int().min(0).default(0),
  kg50Qty:        z.number().int().min(0).default(0),
  notes:          z.string().optional().nullable(),
});

// ─── GET /api/warehouse/writeoff ──────────────────────────────────────────────
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

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const skip  = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.cylinderWriteoff.findMany({
      where: { branchId },
      orderBy: { writeoffAt: "desc" },
      skip,
      take: limit,
      include: {
        branch: { select: { code: true, name: true } },
      },
    }),
    prisma.cylinderWriteoff.count({ where: { branchId } }),
  ]);

  return NextResponse.json({
    records,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// ─── POST /api/warehouse/writeoff ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const branchId = data.branchId;

  // Auth: non-SUPER_ADMIN can only post to their own branch
  if (session.user.role !== "SUPER_ADMIN" && session.user.branchId !== branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // At least one cylinder must be written off
  if (data.kg12Qty === 0 && data.kg50Qty === 0) {
    return NextResponse.json({ error: "Minimal 1 tabung harus diisi" }, { status: 422 });
  }

  // Duplicate writeoffNumber check
  const existing = await prisma.cylinderWriteoff.findUnique({
    where: { writeoffNumber: data.writeoffNumber },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Nomor write-off "${data.writeoffNumber}" sudah ada` },
      { status: 409 }
    );
  }

  // Stock date (midnight)
  const stockDate = new Date(data.writeoffAt);
  stockDate.setHours(0, 0, 0, 0);

  // Carry-forward base for WarehouseStock
  const todayStock = await prisma.warehouseStock.findUnique({
    where: { branchId_date: { branchId, date: stockDate } },
  });
  const base =
    todayStock ??
    (await prisma.warehouseStock.findFirst({
      where: { branchId },
      orderBy: { date: "desc" },
    })) ?? {
      kg12FullQty: 0, kg12EmptyQty: 0, kg12OnTransitQty: 0, kg12HmtQty: 0, kg12KuotaWo: 0,
      kg50FullQty: 0, kg50EmptyQty: 0, kg50OnTransitQty: 0, kg50HmtQty: 0, kg50KuotaWo: 0,
    };

  // ── $transaction ────────────────────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create CylinderWriteoff
    const writeoff = await tx.cylinderWriteoff.create({
      data: {
        branch:         { connect: { id: branchId } },
        writeoffNumber: data.writeoffNumber,
        reason:         data.reason,
        writeoffAt:     new Date(data.writeoffAt),
        kg12Qty:        data.kg12Qty,
        kg50Qty:        data.kg50Qty,
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: {
        branch: { select: { code: true, name: true } },
      },
    });

    // 2. Upsert WarehouseStock — DECREMENT fullQty (write-offs remove cylinders)
    if (todayStock) {
      await tx.warehouseStock.update({
        where: { branchId_date: { branchId, date: stockDate } },
        data: {
          kg12FullQty: { decrement: data.kg12Qty },
          kg50FullQty: { decrement: data.kg50Qty },
        },
      });
    } else {
      await tx.warehouseStock.create({
        data: {
          branch:           { connect: { id: branchId } },
          date:             stockDate,
          kg12FullQty:      Math.max(0, base.kg12FullQty      - data.kg12Qty),
          kg12EmptyQty:     base.kg12EmptyQty,
          kg12OnTransitQty: base.kg12OnTransitQty,
          kg12HmtQty:       base.kg12HmtQty,
          kg12KuotaWo:      base.kg12KuotaWo,
          kg50FullQty:      Math.max(0, base.kg50FullQty      - data.kg50Qty),
          kg50EmptyQty:     base.kg50EmptyQty,
          kg50OnTransitQty: base.kg50OnTransitQty,
          kg50HmtQty:       base.kg50HmtQty,
          kg50KuotaWo:      base.kg50KuotaWo,
        },
      });
    }

    return writeoff;
  });

  return NextResponse.json(result, { status: 201 });
}