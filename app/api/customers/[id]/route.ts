// app/api/customers/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CustomerType } from "@prisma/client";

// ─── GET /api/customers/[id] ──────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get latest gasback balance
  const latestGasback = await prisma.gasbackLedger.findFirst({
    where: { customerId: params.id },
    orderBy: { txDate: "desc" },
    select: { runningBalance: true, txDate: true },
  });

  // Get cylinder holdings (latest per date, desc)
  const holdings = await prisma.customerCylinderHolding.findMany({
    where: { customerId: params.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({
    ...customer,
    gasbackBalance: latestGasback?.runningBalance ?? 0,
    gasbackDate: latestGasback?.txDate ?? null,
    holdings,
  });
}

// ─── PUT /api/customers/[id] ──────────────────────────────────────────────────
const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  npwp: z.string().optional().nullable(),
  creditLimitKg12: z.number().int().min(0).optional(),
  creditLimitKg50: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Duplicate name check (excluding self)
  if (data.name) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        branchId: existing.branchId,
        name: { equals: data.name, mode: "insensitive" },
        NOT: { id: params.id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Customer "${data.name}" already exists in this branch` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.customer.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.customerType !== undefined && { customerType: data.customerType }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.npwp !== undefined && { npwp: data.npwp }),
      ...(data.creditLimitKg12 !== undefined && { creditLimitKg12: data.creditLimitKg12 }),
      ...(data.creditLimitKg50 !== undefined && { creditLimitKg50: data.creditLimitKg50 }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: { branch: { select: { code: true, name: true } } },
  });

  return NextResponse.json(updated);
}