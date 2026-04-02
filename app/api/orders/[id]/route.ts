// app/api/orders/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── GET /api/orders/[id] ─────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;


  const po = await prisma.supplierPo.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      branch:   { select: { code: true, name: true } },
      inbounds: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          grNumber: true,
          receivedAt: true,
          kg12Received: true,
          kg12Good: true,
          kg12Reject: true,
          kg50Received: true,
          kg50Good: true,
          kg50Reject: true,
          notes: true,
        },
      },
    },
  });

  if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

  // Compute totals received so far
  const receivedKg12 = po.inbounds.reduce((s, g) => s + g.kg12Good, 0);
  const receivedKg50 = po.inbounds.reduce((s, g) => s + g.kg50Good, 0);

  return NextResponse.json({ ...po, receivedKg12, receivedKg50 });
}

// ─── PATCH /api/orders/[id] ───────────────────────────────────────────────────
// Allowed transitions:
//   DRAFT → SUBMITTED
//   SUBMITTED → CONFIRMED  (also bumps HMT usedQty)
//   SUBMITTED → CANCELLED
//   CONFIRMED → CANCELLED
//   DRAFT → CANCELLED
// PARTIALLY_RECEIVED and COMPLETED are set by inbound GR, not here.

const PatchSchema = z.object({
  status: z.enum(["SUBMITTED", "CONFIRMED", "CANCELLED"]),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:      ["SUBMITTED", "CANCELLED"],
  SUBMITTED:  ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["CANCELLED"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const po = await prisma.supplierPo.findUnique({
    where: { id },
    include: { supplier: true },
  });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { status: newStatus } = parsed.data;

  // Validate transition
  const allowed = VALID_TRANSITIONS[po.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Tidak dapat mengubah status dari ${po.status} ke ${newStatus}` },
      { status: 400 }
    );
  }

  // ── $transaction for CONFIRMED: bump HMT usedQty ───────────────────────────
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.supplierPo.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        branch:   { select: { code: true, name: true } },
      },
    });

    // On CONFIRMED: increment HMT usedQty for both cylinder sizes
    if (newStatus === "CONFIRMED") {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year  = now.getFullYear();

      // KG12
      if (po.kg12Qty > 0) {
        await tx.supplierHmtQuota.updateMany({
          where: {
            supplierId:   po.supplierId,
            branchId:     po.branchId,
            cylinderSize: "KG12",
            periodMonth:  month,
            periodYear:   year,
          },
          data: { usedQty: { increment: po.kg12Qty } },
        });
      }

      // KG50
      if (po.kg50Qty > 0) {
        await tx.supplierHmtQuota.updateMany({
          where: {
            supplierId:   po.supplierId,
            branchId:     po.branchId,
            cylinderSize: "KG50",
            periodMonth:  month,
            periodYear:   year,
          },
          data: { usedQty: { increment: po.kg50Qty } },
        });
      }
    }

    return result;
  });

  return NextResponse.json(updated);
}