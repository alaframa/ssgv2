// app/api/delivery-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateDoSchema = z.object({
  customerPoId:  z.string().min(1, "Customer PO wajib diisi"),
  branchId:      z.string().optional(),
  doDate:        z.string().min(1, "Tanggal DO wajib diisi"),
  driverId:      z.string().optional().nullable(),
  kenetId:       z.string().optional().nullable(),
  supplierPoRef: z.string().optional().nullable(),
  vehicleNo:     z.string().optional().nullable(),
  kg12Released:  z.number().int().min(0).default(0),
  kg50Released:  z.number().int().min(0).default(0),
  notes:         z.string().optional().nullable(),
});

// ── GET /api/delivery-orders ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId ?? undefined)
      : (session.user.branchId ?? undefined);

  const status     = searchParams.get("status");
  const date       = searchParams.get("date");
  const customerId = searchParams.get("customerId");
  const customerPoId = searchParams.get("customerPoId"); // ← add this

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
  const skip  = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (branchId)   where.branchId = branchId;
  if (status) where.status = status;
  if (customerPoId) where.customerPoId = customerPoId; // ← add this

  if (date) {
    const d    = new Date(date);
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
          include: { customer: { select: { id: true, name: true, code: true } } },
        },
        branch: { select: { code: true, name: true } },
        driver: { select: { id: true, displayName: true } },
        kenek:  { select: { id: true, displayName: true } },
      },
      orderBy: [{ doDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip,
    }),
    prisma.deliveryOrder.count({ where }),
  ]);

  return NextResponse.json({ records, total, pages: Math.ceil(total / limit), page });
}

// ── POST /api/delivery-orders ──────────────────────────────────────────────────
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

  // ── 1. Load CPO and validate status ─────────────────────────────────────────
  const cpo = await prisma.customerPo.findUnique({
    where: { id: data.customerPoId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          creditLimitKg12: true,
          creditLimitKg50: true,
        },
      },
      deliveryOrders: {
        where: { status: { notIn: ["CANCELLED"] } },
        select: { kg12Released: true, kg50Released: true },
      },
    },
  });

  if (!cpo) {
    return NextResponse.json({ error: "Customer PO tidak ditemukan" }, { status: 404 });
  }
  if (cpo.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: `Customer PO harus CONFIRMED (saat ini: ${cpo.status})` },
      { status: 422 }
    );
  }

  // ── 2. CPO overage check — DO qty must not exceed remaining CPO qty ──────────
  const alreadyReleased12 = cpo.deliveryOrders.reduce((s, d) => s + d.kg12Released, 0);
  const alreadyReleased50 = cpo.deliveryOrders.reduce((s, d) => s + d.kg50Released, 0);

  const remainingCpo12 = cpo.kg12Qty - alreadyReleased12;
  const remainingCpo50 = cpo.kg50Qty - alreadyReleased50;

  if (data.kg12Released > remainingCpo12) {
    return NextResponse.json(
      {
        error:
          `Qty 12kg melebihi sisa CPO. ` +
          `CPO: ${cpo.kg12Qty}, sudah dirilis: ${alreadyReleased12}, sisa: ${remainingCpo12}. ` +
          `Anda memasukkan: ${data.kg12Released}.`,
      },
      { status: 422 }
    );
  }
  if (data.kg50Released > remainingCpo50) {
    return NextResponse.json(
      {
        error:
          `Qty 50kg melebihi sisa CPO. ` +
          `CPO: ${cpo.kg50Qty}, sudah dirilis: ${alreadyReleased50}, sisa: ${remainingCpo50}. ` +
          `Anda memasukkan: ${data.kg50Released}.`,
      },
      { status: 422 }
    );
  }

  if (data.kg12Released === 0 && data.kg50Released === 0) {
    return NextResponse.json(
      { error: "Minimal salah satu qty (12kg atau 50kg) harus lebih dari 0." },
      { status: 422 }
    );
  }

  // ── 3. Holdings-based quota check ───────────────────────────────────────────
  // Rule: available_to_order = creditLimit - currentActiveHoldings
  // Holdings are incremented when DO is CREATED (cylinders allocated), 
  // and decremented when empty cylinders are RETURNED.
  const customerId = cpo.customer.id;
  const customer = cpo.customer;

  const currentHolding = await prisma.customerCylinderHolding.findUnique({
    where: { customerId_branchId: { customerId, branchId } },
  });

  const currentHeld12 = currentHolding?.kg12HeldQty ?? 0;
  const currentHeld50 = currentHolding?.kg50HeldQty ?? 0;

  const quota12 = customer.creditLimitKg12;
  const quota50 = customer.creditLimitKg50;

  // Only enforce if quota is set (> 0)
  if (quota12 > 0) {
    const available12 = quota12 - currentHeld12;
    if (data.kg12Released > available12) {
      return NextResponse.json(
        {
          error:
            `Qty 12kg melebihi kuota aktif pelanggan. ` +
            `Kuota: ${quota12}, tabung aktif saat ini: ${currentHeld12}, ` +
            `tersedia: ${available12}. Anda memasukkan: ${data.kg12Released}. ` +
            `Pelanggan perlu mengembalikan tabung kosong terlebih dahulu.`,
          detail: {
            quota: quota12,
            currentHoldings: currentHeld12,
            available: available12,
            requested: data.kg12Released,
          },
        },
        { status: 422 }
      );
    }
  }

  if (quota50 > 0) {
    const available50 = quota50 - currentHeld50;
    if (data.kg50Released > available50) {
      return NextResponse.json(
        {
          error:
            `Qty 50kg melebihi kuota aktif pelanggan. ` +
            `Kuota: ${quota50}, tabung aktif saat ini: ${currentHeld50}, ` +
            `tersedia: ${available50}. Anda memasukkan: ${data.kg50Released}. ` +
            `Pelanggan perlu mengembalikan tabung kosong terlebih dahulu.`,
          detail: {
            quota: quota50,
            currentHoldings: currentHeld50,
            available: available50,
            requested: data.kg50Released,
          },
        },
        { status: 422 }
      );
    }
  }

  // ── 4. Period lock check ─────────────────────────────────────────────────────
  const doDate = new Date(data.doDate);
  const month  = doDate.getMonth() + 1;
  const year   = doDate.getFullYear();

  const locked = await prisma.monthlyRecon.findFirst({
    where: { branchId, month, year, status: "LOCKED" },
  });
  if (locked) return NextResponse.json({ error: "Periode dikunci (LOCKED)" }, { status: 423 });

  // ── 5. Auto-generate DO number: MM-NNN ──────────────────────────────────────
  const mm         = String(month).padStart(2, "0");
  const monthStart = new Date(`${year}-${mm}-01`);
  const monthEnd   = new Date(
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`
  );

  const lastDo = await prisma.deliveryOrder.findFirst({
    where: {
      branchId,
      doNumber: { startsWith: `${mm}-` },
      doDate:   { gte: monthStart, lt: monthEnd },
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
  while (await prisma.deliveryOrder.findUnique({ where: { doNumber } })) {
    seq++;
    doNumber = `${mm}-${String(seq).padStart(3, "0")}`;
  }

  // ── 6. Create DO + update holdings + auto-complete CPO if fully allocated ────
  // Holdings are incremented HERE (at DO creation = cylinders are being allocated),
  // NOT at delivery. This ensures the quota is consumed as soon as cylinders leave
  // the warehouse, preventing double-ordering.
  const newTotal12 = alreadyReleased12 + data.kg12Released;
  const newTotal50 = alreadyReleased50 + data.kg50Released;
  const fullyAllocated =
    (cpo.kg12Qty === 0 || newTotal12 >= cpo.kg12Qty) &&
    (cpo.kg50Qty === 0 || newTotal50 >= cpo.kg50Qty);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveryOrder = await prisma.$transaction(async (tx) => {
    // Create the DO
    const newDo = await tx.deliveryOrder.create({
      data: {
        branchId,
        customerPoId:  data.customerPoId,
        doNumber,
        doDate,
        driverId:      data.driverId      ?? undefined,
        kenetId:       data.kenetId       ?? undefined,
        supplierPoRef: data.supplierPoRef ?? undefined,
        vehicleNo:     data.vehicleNo     ?? undefined,
        kg12Released:  data.kg12Released,
        kg50Released:  data.kg50Released,
        notes:         data.notes         ?? undefined,
        status:        "PENDING",
      },
      include: {
        customerPo: {
          include: { customer: { select: { id: true, name: true, code: true } } },
        },
        branch: { select: { code: true } },
        driver: { select: { id: true, displayName: true } },
        kenek:  { select: { id: true, displayName: true } },
      },
    });

    // Increment customer cylinder holdings immediately on DO creation.
    // This reflects that cylinders are now "allocated" / on their way to the customer.
    await tx.customerCylinderHolding.upsert({
      where: { customerId_branchId: { customerId, branchId } },
      create: {
        customerId,
        branchId,
        date: today,
        kg12HeldQty: data.kg12Released,
        kg50HeldQty: data.kg50Released,
      },
      update: {
        kg12HeldQty: { increment: data.kg12Released },
        kg50HeldQty: { increment: data.kg50Released },
        date: today,
      },
    });

    // Auto-complete CPO when all qty has been allocated to DOs
    if (fullyAllocated) {
      await tx.customerPo.update({
        where: { id: data.customerPoId },
        data: { status: "COMPLETED" },
      });
    }

    return newDo;
  });

  return NextResponse.json(deliveryOrder, { status: 201 });
}