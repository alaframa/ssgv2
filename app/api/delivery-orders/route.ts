// app/api/delivery-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateDoSchema = z.object({
  customerPoId: z.string().min(1, "Customer PO wajib diisi"),
  branchId: z.string().optional(),
  doDate: z.string().min(1, "Tanggal DO wajib diisi"),
  driverId: z.string().optional().nullable(),
  kenetId: z.string().optional().nullable(),
  supplierPoRef: z.string().optional().nullable(),
  vehicleNo: z.string().optional().nullable(),
  kg12Released: z.number().int().min(0).default(0),
  kg50Released: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

// GET /api/delivery-orders
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId ?? undefined)
      : (session.user.branchId ?? undefined);

  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (date) {
    const d = new Date(date);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    where.doDate = { gte: d, lt: next };
  }
  if (customerId) where.customerPo = { customerId };

  const [records, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      include: {
        customerPo: {
          include: {
            customer: { select: { id: true, name: true, code: true } },
          },
        },
        branch: { select: { code: true, name: true } },
        driver: { select: { id: true, displayName: true } },
        kenek: { select: { id: true, displayName: true } },
      },
      orderBy: [{ doDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip,
    }),
    prisma.deliveryOrder.count({ where }),
  ]);

  return NextResponse.json({ records, total, pages: Math.ceil(total / limit), page });
}

// POST /api/delivery-orders
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateDoSchema.safeParse(body);
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

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const cpo = await prisma.customerPo.findUnique({ where: { id: data.customerPoId } });
  if (!cpo) return NextResponse.json({ error: "Customer PO tidak ditemukan" }, { status: 404 });
  if (cpo.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Customer PO harus CONFIRMED" }, { status: 422 });
  }

  const doDate = new Date(data.doDate);
  const month = doDate.getMonth() + 1;
  const year = doDate.getFullYear();

  const locked = await prisma.monthlyRecon.findFirst({
    where: { branchId, month, year, status: "LOCKED" },
  });
  if (locked) return NextResponse.json({ error: "Periode dikunci (LOCKED)" }, { status: 423 });

  // Auto-generate DO number: MM-NNN
  const mm = String(month).padStart(2, "0");
  const monthStart = new Date(`${year}-${mm}-01`);
  const monthEnd = new Date(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`);

  const lastDo = await prisma.deliveryOrder.findFirst({
    where: {
      branchId,
      doNumber: { startsWith: `${mm}-` },
      doDate: { gte: monthStart, lt: monthEnd },
    },
    orderBy: { doNumber: "desc" },
  });

  let seq = 1;
  if (lastDo) {
    const parts = lastDo.doNumber.split("-");
    const n = parseInt(parts[parts.length - 1]);
    if (!isNaN(n)) seq = n + 1;
  }

  let doNumber = `${mm}-${String(seq).padStart(3, "0")}`;
  // ensure uniqueness
  while (await prisma.deliveryOrder.findUnique({ where: { doNumber } })) {
    seq++;
    doNumber = `${mm}-${String(seq).padStart(3, "0")}`;
  }

  const deliveryOrder = await prisma.deliveryOrder.create({
    data: {
      branchId,
      customerPoId: data.customerPoId,
      doNumber,
      doDate,
      driverId: data.driverId ?? undefined,
      kenetId: data.kenetId ?? undefined,
      supplierPoRef: data.supplierPoRef ?? undefined,
      vehicleNo: data.vehicleNo ?? undefined,
      kg12Released: data.kg12Released,
      kg50Released: data.kg50Released,
      notes: data.notes ?? undefined,
      status: "PENDING",
    },
    include: {
      customerPo: { include: { customer: { select: { id: true, name: true, code: true } } } },
      branch: { select: { code: true } },
      driver: { select: { id: true, displayName: true } },
      kenek: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(deliveryOrder, { status: 201 });
}