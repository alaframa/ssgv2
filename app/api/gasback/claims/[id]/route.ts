// app/api/gasback/claims/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/gasback/claims/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const claim = await prisma.gasbackClaim.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, code: true, name: true, customerType: true } },
      branch:   { select: { code: true, name: true } },
      gasbackLedgers: {
        orderBy: { txDate: "desc" },
        select: {
          id: true, txType: true, qty: true, amount: true,
          runningBalance: true, txDate: true, notes: true,
        },
      },
    },
  });

  if (!claim) return NextResponse.json({ error: "Klaim tidak ditemukan" }, { status: 404 });
  return NextResponse.json(claim);
}

// PATCH /api/gasback/claims/[id]
// Body: { action: "mark_paid", paymentRef?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, paymentRef } = body as Record<string, unknown>;
  const { id } = await params;
  const claim = await prisma.gasbackClaim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Klaim tidak ditemukan" }, { status: 404 });

  if (action === "mark_paid") {
    if (claim.isPaid) {
      return NextResponse.json({ error: "Klaim sudah dibayar" }, { status: 409 });
    }
    const updated = await prisma.gasbackClaim.update({
      where: { id },
      data: {
        isPaid:     true,
        paidAt:     new Date(),
        paymentRef: paymentRef ? String(paymentRef) : null,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "mark_unpaid") {
    const updated = await prisma.gasbackClaim.update({
      where: { id },
      data: { isPaid: false, paidAt: null, paymentRef: null },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "action tidak dikenali" }, { status: 400 });
}