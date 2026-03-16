// app/api/suppliers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── GET /api/suppliers ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

// ─── POST /api/suppliers ──────────────────────────────────────────────────────
const CreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  npwp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Duplicate code check
  const dup = await prisma.supplier.findUnique({ where: { code: data.code } });
  if (dup) {
    return NextResponse.json({ error: `Supplier code "${data.code}" already exists` }, { status: 409 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      code: data.code.toUpperCase(),
      name: data.name,
      npwp: data.npwp || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}