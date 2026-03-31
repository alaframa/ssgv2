// app/api/customer-po/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PoStatus } from "@prisma/client";

// GET /api/customer-po/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cpo = await prisma.customerPo.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, code: true, customerType: true } },
      branch: { select: { id: true, code: true, name: true } },
      deliveryOrders: {
        orderBy: { createdAt: "desc" },
        include: {
          driver: { select: { displayName: true } },
          kenek: { select: { displayName: true } },
        },
      },
    },
  });

  if (!cpo) {
    return NextResponse.json({ error: "CPO tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(cpo);
}

const validTransitions: Record<PoStatus, PoStatus[]> = {
  DRAFT: ["SUBMITTED", "CONFIRMED", "CANCELLED"],
  SUBMITTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};


const VALID_PO_STATUSES = new Set<string>([
  "DRAFT", "SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"
]);

function isPoStatus(value: unknown): value is PoStatus {
  return typeof value === "string" && VALID_PO_STATUSES.has(value);
}


// PATCH /api/customer-po/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const status = raw.status;
  const notes = raw.notes;

  const { id } = params;

  const cpo = await prisma.customerPo.findUnique({
    where: { id },
  });

  if (!cpo) {
    return NextResponse.json({ error: "CPO tidak ditemukan" }, { status: 404 });
  }

  if (status !== undefined) {
    if (!isPoStatus(status)) {
      return NextResponse.json(
        { error: "Status tidak valid" },
        { status: 422 }
      );
    }

    const allowed = validTransitions[cpo.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Tidak bisa ubah status dari ${cpo.status} ke ${status}` },
        { status: 422 }
      );
    }
  }

  if (notes !== undefined && typeof notes !== "string") {
    return NextResponse.json(
      { error: "Notes harus berupa string" },
      { status: 422 }
    );
  }

  const updated = await prisma.customerPo.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      branch: { select: { code: true } },
    },
  });

  return NextResponse.json(updated);
}