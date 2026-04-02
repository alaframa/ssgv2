// app/api/suppliers/[id]/hmt-quota/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderSize } from "@prisma/client";

// ─── GET /api/suppliers/[id]/hmt-quota ───────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const { id } = await params;

  const where: any = { supplierId: id };
  if (branchId) where.branchId = branchId;
  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);

  const quotas = await prisma.supplierHmtQuota.findMany({
    where,
    include: { branch: { select: { code: true, name: true } } },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { cylinderSize: "asc" }],
  });

  return NextResponse.json(quotas);
}

// ─── POST /api/suppliers/[id]/hmt-quota ──────────────────────────────────────
const QuotaSchema = z.object({
  branchId: z.string().min(1),
  cylinderSize: z.nativeEnum(CylinderSize),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020).max(2099),
  quotaQty: z.number().int().min(0),
  pricePerUnit: z.number().min(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = QuotaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const { id } = await params;
  // Upsert: if quota for same supplier+branch+size+month+year exists, update it
  const quota = await prisma.supplierHmtQuota.upsert({
    where: {
      supplierId_branchId_cylinderSize_periodMonth_periodYear: {
        supplierId: id,
        branchId: data.branchId,
        cylinderSize: data.cylinderSize,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
      },
    },
    update: {
      quotaQty: data.quotaQty,
      pricePerUnit: data.pricePerUnit,
    },
    create: {
      supplierId: id,
      branchId: data.branchId,
      cylinderSize: data.cylinderSize,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      quotaQty: data.quotaQty,
      pricePerUnit: data.pricePerUnit,
    },
    include: { branch: { select: { code: true, name: true } } },
  });

  return NextResponse.json(quota, { status: 201 });
}

// ─── PUT /api/suppliers/[id]/hmt-quota ───────────────────────────────────────
// Same as POST — delegates to upsert
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Re-wrap the id as a Promise to satisfy the POST handler's expected type
  return POST(req, { params: Promise.resolve({ id }) });
}