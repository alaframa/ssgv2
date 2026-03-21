// app/api/recon/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  branchId: z.string().min(1),
  month:    z.number().int().min(1).max(12),
  year:     z.number().int().min(2020).max(2099),
  notes:    z.string().optional().nullable(),
});

// ─── GET /api/recon ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? undefined)
      : (session.user.branchId ?? undefined);

  const periods = await prisma.monthlyRecon.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      branch: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json({ periods });
}

// ─── POST /api/recon ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only BRANCH_MANAGER and SUPER_ADMIN can open periods
  if (!["SUPER_ADMIN", "BRANCH_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { branchId, month, year, notes } = parsed.data;

  // Non-SUPER_ADMIN can only open for their own branch
  if (session.user.role !== "SUPER_ADMIN" && session.user.branchId !== branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Duplicate check — one period per branch/month/year
  const existing = await prisma.monthlyRecon.findUnique({
    where: { branchId_month_year: { branchId, month, year } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Periode ${month}/${year} sudah ada untuk cabang ini` },
      { status: 409 }
    );
  }

  const period = await prisma.monthlyRecon.create({
    data: { branchId, month, year, notes: notes ?? null },
    include: { branch: { select: { code: true, name: true } } },
  });

  return NextResponse.json(period, { status: 201 });
}