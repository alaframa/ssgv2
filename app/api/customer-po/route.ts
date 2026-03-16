// app/api/customer-po/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateCpoSchema = z.object({
  customerId: z.string().min(1, "Customer wajib diisi"),
  branchId: z.string().optional(),
  kg12Qty: z.number().int().min(0).default(0),
  kg50Qty: z.number().int().min(0).default(0),
  channel: z.enum(["WHATSAPP", "PHONE", "WALK_IN", "SALES_VISIT"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/customer-po
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId ?? undefined)
      : (session.user.branchId ?? undefined);

  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [records, total] = await Promise.all([
    prisma.customerPo.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        branch: { select: { code: true, name: true } },
        _count: { select: { deliveryOrders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.customerPo.count({ where }),
  ]);

  return NextResponse.json({
    records,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}

// POST /api/customer-po
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateCpoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validasi gagal", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (data.branchId ?? session.user.branchId)
      : session.user.branchId;

  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // Auto-generate CPO number: CPO-{BRANCH}-YYYYMM-NNNN
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return NextResponse.json({ error: "Branch tidak ditemukan" }, { status: 400 });

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CPO-${branch.code}-${yyyy}${mm}-`;

  const lastCpo = await prisma.customerPo.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
  });

  let seq = 1;
  if (lastCpo) {
    const parts = lastCpo.poNumber.split("-");
    seq = parseInt(parts[parts.length - 1]) + 1;
  }

  const poNumber = `${prefix}${String(seq).padStart(4, "0")}`;

  const cpo = await prisma.customerPo.create({
    data: {
      branchId,
      customerId: data.customerId,
      poNumber,
      kg12Qty: data.kg12Qty,
      kg50Qty: data.kg50Qty,
      channel: data.channel ?? undefined,
      notes: data.notes ?? undefined,
      status: "DRAFT",
    },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      branch: { select: { code: true } },
    },
  });

  return NextResponse.json(cpo, { status: 201 });
}