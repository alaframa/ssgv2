// app/api/customers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerType } from "@prisma/client";
import { z } from "zod";

// ── Type prefix map ────────────────────────────────────────────────────────
const TYPE_PREFIX: Record<CustomerType, string> = {
  RETAIL:   "RET",
  AGEN:     "AGN",
  INDUSTRI: "IND",
};

// ── Validation schema ──────────────────────────────────────────────────────
const CreateCustomerSchema = z.object({
  name:            z.string().min(2).max(200),
  customerType:    z.nativeEnum(CustomerType),
  phone:           z.string().max(30).optional().nullable(),
  email:           z.string().email().max(120).optional().nullable().or(z.literal("")),
  address:         z.string().max(1000).optional().nullable(),
  npwp:            z.string().max(30).optional().nullable(),
  creditLimitKg12: z.number().int().min(0).default(0),
  creditLimitKg50: z.number().int().min(0).default(0),
  isActive:        z.boolean().default(true),
  branchId:        z.string().min(1),
});

// ── GET /api/customers ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search") ?? "";
  const type     = searchParams.get("type") as CustomerType | null;
  const isActive = searchParams.get("isActive");
  const branchId = searchParams.get("branchId");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = 30;

  // Branch filter: non-SUPER_ADMIN locked to their own branch
  const effectiveBranchId =
    session.user.role === "SUPER_ADMIN"
      ? branchId ?? undefined
      : session.user.branchId ?? undefined;

  const where: any = {};
  if (effectiveBranchId) where.branchId = effectiveBranchId;
  if (type) where.customerType = type;
  if (isActive !== null && isActive !== "") where.isActive = isActive === "true";
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id:           true,
        code:         true,
        name:         true,
        customerType: true,
        phone:        true,
        isActive:     true,
        branchId:     true,
        branch:       { select: { code: true } },
      },
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: customers,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
}

// ── POST /api/customers ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", issues: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Non-SUPER_ADMIN cannot create for a different branch
  if (session.user.role !== "SUPER_ADMIN" && data.branchId !== session.user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Duplicate name check within same branch
  const existing = await prisma.customer.findFirst({
    where: {
      branchId: data.branchId,
      name: { equals: data.name, mode: "insensitive" },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Pelanggan dengan nama "${data.name}" sudah ada di cabang ini.` },
      { status: 409 }
    );
  }

  // Auto-generate customer code: {BRANCH_CODE}-{TYPE_PREFIX}-{NNNN}
  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 400 });

  const prefix = `${branch.code}-${TYPE_PREFIX[data.customerType]}-`;

  // Find highest existing sequence for this prefix
  const lastCustomer = await prisma.customer.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });

  let seq = 1;
  if (lastCustomer) {
    const parts = lastCustomer.code.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) seq = lastNum + 1;
  }

  const code = `${prefix}${String(seq).padStart(4, "0")}`;

  const customer = await prisma.customer.create({
    data: {
      branchId:        data.branchId,
      code,
      name:            data.name,
      customerType:    data.customerType,
      phone:           data.phone ?? null,
      email:           data.email || null,
      address:         data.address ?? null,
      npwp:            data.npwp ?? null,
      creditLimitKg12: data.creditLimitKg12,
      creditLimitKg50: data.creditLimitKg50,
      isActive:        data.isActive,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}