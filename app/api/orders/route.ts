// app/api/orders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PoStatus } from "@prisma/client";
import { z } from "zod";

const CreatePoSchema = z.object({
  branchId: z.string().optional(),
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  poNumber: z.string().min(1, "Nomor PO wajib diisi"),
  kg12Qty: z.coerce.number().int().min(0).default(0),
  kg50Qty: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
  confirmedAt: z.string().optional().nullable(),
});

// ── GET /api/orders ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? searchParams.get("branchId") ?? session.user.branchId ?? undefined
      : session.user.branchId ?? undefined;

  const statusParam = searchParams.get("status"); // comma-separated: "CONFIRMED,SUBMITTED"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip = (page - 1) * limit;

  // Build status filter
  let statusFilter: PoStatus[] | undefined;
  if (statusParam) {
    const raw = statusParam.split(",").map((s) => s.trim().toUpperCase());
    statusFilter = raw.filter((s): s is PoStatus =>
      ["DRAFT", "SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"].includes(s)
    );
  }

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (statusFilter?.length) where.status = { in: statusFilter };

  const [records, total] = await Promise.all([
    prisma.supplierPo.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        branch: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.supplierPo.count({ where }),
  ]);

  return NextResponse.json({
    records,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}

// ── POST /api/orders ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreatePoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validasi gagal", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const data = parsed.data;

  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? data.branchId ?? session.user.branchId
      : session.user.branchId;

  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // Duplicate poNumber check
  const existing = await prisma.supplierPo.findUnique({
    where: { poNumber: data.poNumber },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Nomor PO "${data.poNumber}" sudah digunakan` },
      { status: 409 }
    );
  }

  const po = await prisma.supplierPo.create({
    data: {
      branchId,
      supplierId: data.supplierId,
      poNumber: data.poNumber,
      kg12Qty: data.kg12Qty,
      kg50Qty: data.kg50Qty,
      notes: data.notes ?? undefined,
      status: data.confirmedAt ? "CONFIRMED" : "DRAFT",
      confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : undefined,
    },
    include: {
      supplier: { select: { name: true } },
      branch: { select: { code: true } },
    },
  });

  return NextResponse.json(po, { status: 201 });
}