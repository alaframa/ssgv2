// app/api/warehouse/empty-return/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  branchId: z.string().min(1),
  returnedAt: z.string().min(1),
  source: z.enum(["CUSTOMER", "DRIVER"]),
  customerId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  kg12Qty: z.number().int().min(0).default(0),
  kg50Qty: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

// ─── GET /api/warehouse/empty-return ─────────────────────────────────────────
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
    prisma.emptyReturn.findMany({
      where: { branchId },
      orderBy: { returnedAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, code: true, name: true } },
        driver:   { select: { id: true, displayName: true, employeeCode: true } },
        branch:   { select: { code: true, name: true } },
      },
    }),
    prisma.emptyReturn.count({ where: { branchId } }),
  ]);

  return NextResponse.json({ records, total, page, totalPages: Math.ceil(total / limit) });
}

// ── Auto-generate returnNumber ────────────────────────────────────────────────
async function generateReturnNumber(branchId: string, date: Date): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });
  if (!branch) throw new Error("Branch tidak ditemukan");

  const yyyy = date.getFullYear().toString();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `RET-${branch.code}-${yyyy}${mm}-`;

  const last = await prisma.emptyReturn.findFirst({
    where: { returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: "desc" },
    select: { returnNumber: true },
  });

  let nextSeq = 1;
  if (last) {
    const parts = last.returnNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// ─── POST /api/warehouse/empty-return ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const branchId = data.branchId;

  if (session.user.role !== "SUPER_ADMIN" && session.user.branchId !== branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (data.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });
  }
  if (data.driverId) {
    const driver = await prisma.employee.findUnique({ where: { id: data.driverId } });
    if (!driver) return NextResponse.json({ error: "Driver tidak ditemukan" }, { status: 404 });
  }

  // ── LOCKED period check ───────────────────────────────────────────────────
  const retDate = new Date(data.returnedAt);
  const locked  = await prisma.monthlyRecon.findFirst({
    where: { branchId, month: retDate.getMonth() + 1, year: retDate.getFullYear(), status: "LOCKED" },
  });
  if (locked) {
    return NextResponse.json({ error: "Periode ini sudah dikunci (LOCKED)" }, { status: 423 });
  }

  let returnNumber: string;
  try {
    returnNumber = await generateReturnNumber(branchId, retDate);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal generate return number";
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const stockDate = new Date(data.returnedAt);
  stockDate.setHours(0, 0, 0, 0);

  const todayStock = await prisma.warehouseStock.findUnique({
    where: { branchId_date: { branchId, date: stockDate } },
  });
  const base =
    todayStock ??
    (await prisma.warehouseStock.findFirst({ where: { branchId }, orderBy: { date: "desc" } })) ??
    {
      kg12FullQty: 0, kg12EmptyQty: 0, kg12OnTransitQty: 0, kg12HmtQty: 0, kg12KuotaWo: 0,
      kg50FullQty: 0, kg50EmptyQty: 0, kg50OnTransitQty: 0, kg50HmtQty: 0, kg50KuotaWo: 0,
    };

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create EmptyReturn record
    const emptyReturn = await tx.emptyReturn.create({
      data: {
        branch:       { connect: { id: branchId } },
        returnNumber,
        source:       data.source,
        returnedAt:   new Date(data.returnedAt),
        kg12Qty:      data.kg12Qty,
        kg50Qty:      data.kg50Qty,
        ...(data.customerId ? { customer: { connect: { id: data.customerId } } } : {}),
        ...(data.driverId   ? { driver:   { connect: { id: data.driverId   } } } : {}),
        ...(data.notes      ? { notes: data.notes } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        driver:   { select: { id: true, displayName: true } },
        branch:   { select: { code: true, name: true } },
      },
    });

    // 2. Upsert WarehouseStock — INCREMENT emptyQty
    if (todayStock) {
      await tx.warehouseStock.update({
        where: { branchId_date: { branchId, date: stockDate } },
        data: {
          kg12EmptyQty: { increment: data.kg12Qty },
          kg50EmptyQty: { increment: data.kg50Qty },
        },
      });
    } else {
      await tx.warehouseStock.create({
        data: {
          branch:           { connect: { id: branchId } },
          date:             stockDate,
          kg12FullQty:      base.kg12FullQty,
          kg12EmptyQty:     base.kg12EmptyQty + data.kg12Qty,
          kg12OnTransitQty: base.kg12OnTransitQty,
          kg12HmtQty:       base.kg12HmtQty,
          kg12KuotaWo:      base.kg12KuotaWo,
          kg50FullQty:      base.kg50FullQty,
          kg50EmptyQty:     base.kg50EmptyQty + data.kg50Qty,
          kg50OnTransitQty: base.kg50OnTransitQty,
          kg50HmtQty:       base.kg50HmtQty,
          kg50KuotaWo:      base.kg50KuotaWo,
        },
      });
    }

    // 3. Decrement CustomerCylinderHolding when source is CUSTOMER.
    //    This frees up quota: available_to_order = creditLimit - currentHoldings.
    //    DRIVER returns don't map to a specific customer so holdings are not touched.
    if (data.source === "CUSTOMER" && data.customerId) {
      const holding = await tx.customerCylinderHolding.findUnique({
        where: { customerId_branchId: { customerId: data.customerId, branchId } },
      });
      if (holding) {
        await tx.customerCylinderHolding.update({
          where: { customerId_branchId: { customerId: data.customerId, branchId } },
          data: {
            // Clamp to 0 — never go negative
            kg12HeldQty: Math.max(0, holding.kg12HeldQty - data.kg12Qty),
            kg50HeldQty: Math.max(0, holding.kg50HeldQty - data.kg50Qty),
          },
        });
      }
      // If no holding record exists yet, there's nothing to decrement — that's fine.
    }

    return emptyReturn;
  });

  return NextResponse.json(result, { status: 201 });
}