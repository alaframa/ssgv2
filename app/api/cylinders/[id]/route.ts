// app/api/cylinders/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderCondition, CylinderStatus } from "@prisma/client";

// ─── GET /api/cylinders/[id] ──────────────────────────────────────────────────
// Also accepts ?serial=XXX-001 to look up by serialCode
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bySerial = searchParams.get("serial");

  const unit = bySerial
    ? await prisma.cylinderUnit.findUnique({ where: { serialCode: bySerial }, include: unitInclude })
    : await prisma.cylinderUnit.findUnique({ where: { id: params.id }, include: unitInclude });

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(unit);
}

// Full event history with all relation details
const unitInclude = {
  type:   true,
  branch: { select: { id: true, code: true, name: true } },
  events: {
    orderBy: { eventAt: "desc" as const },
    include: {
      customer:      { select: { id: true, name: true, code: true } },
      deliveryOrder: { select: { id: true, doNumber: true, doDate: true } },
      emptyReturn:   { select: { id: true, returnNumber: true, returnedAt: true } },
      writeoff:      { select: { id: true, writeoffNumber: true, writeoffAt: true } },
      gasbackLedgers: {
        select: { id: true, txType: true, amount: true, runningBalance: true, txDate: true },
      },
    },
  },
} as const;

// ─── PATCH /api/cylinders/[id] ────────────────────────────────────────────────
const UpdateSchema = z.object({
  condition:    z.nativeEnum(CylinderCondition).optional(),
  locationNote: z.string().max(120).optional().nullable(),
  notes:        z.string().optional().nullable(),
  tareWeightKg: z.number().positive().optional().nullable(),
  isActive:     z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const unit = await prisma.cylinderUnit.update({
    where: { id: params.id },
    data:  parsed.data,
    include: { type: true },
  });

  return NextResponse.json(unit);
}