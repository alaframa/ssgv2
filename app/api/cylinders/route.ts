// app/api/cylinders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderStatus, CylinderCondition } from "@prisma/client";

// ─── GET /api/cylinders ────────────────────────────────────────────────────────
// Query params: branchId, status, condition, search (serialCode), page, limit
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId  = searchParams.get("branchId");
  const status    = searchParams.get("status") as CylinderStatus | null;
  const condition = searchParams.get("condition") as CylinderCondition | null;
  const search    = searchParams.get("search") ?? "";
  const size      = searchParams.get("size"); // "KG12" | "KG50"
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit     = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const skip      = (page - 1) * limit;

  const where: Record<string, unknown> = { isActive: true };

  if (branchId)   where.branchId  = branchId;
  if (status)     where.status    = status;
  if (condition)  where.condition = condition;
  if (size)       where.type      = { size };
  if (search) {
    where.serialCode = { contains: search, mode: "insensitive" };
  }

  const [units, total] = await Promise.all([
    prisma.cylinderUnit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { serialCode: "asc" },
      include: {
        type:            { select: { size: true, label: true } },
        // Latest event for "last seen" info
        events: {
          orderBy: { eventAt: "desc" },
          take: 1,
          select: {
            eventType: true,
            eventAt: true,
            customer: { select: { id: true, name: true, code: true } },
            weightReturnedKg: true,
            gasbackKg: true,
          },
        },
      },
    }),
    prisma.cylinderUnit.count({ where }),
  ]);

  return NextResponse.json({
    units,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// ─── POST /api/cylinders ───────────────────────────────────────────────────────
// Register a new cylinder unit (individual serial code)
const RegisterSchema = z.object({
  branchId:     z.string().min(1),
  serialCode:   z.string().min(1).max(60),
  size:         z.enum(["KG12", "KG50"]),
  tareWeightKg: z.number().positive().optional(),
  condition:    z.nativeEnum(CylinderCondition).optional(),
  locationNote: z.string().max(120).optional(),
  notes:        z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const { branchId, serialCode, size, tareWeightKg, condition, locationNote, notes } = parsed.data;

  // Duplicate serial check
  const existing = await prisma.cylinderUnit.findUnique({ where: { serialCode } });
  if (existing) {
    return NextResponse.json({ error: `Serial code ${serialCode} sudah terdaftar` }, { status: 409 });
  }

  // Get cylinder type
  const type = await prisma.cylinderType.findUnique({ where: { size } });
  if (!type) {
    return NextResponse.json({ error: `CylinderType ${size} belum dikonfigurasi — buat di Settings` }, { status: 400 });
  }

  const unit = await prisma.cylinderUnit.create({
    data: {
      branchId,
      serialCode,
      typeId:       type.id,
      tareWeightKg: tareWeightKg ?? null,
      status:       CylinderStatus.WAREHOUSE_FULL,
      condition:    condition ?? CylinderCondition.GOOD,
      locationNote: locationNote ?? null,
      notes:        notes ?? null,
    },
    include: { type: true },
  });

  return NextResponse.json(unit, { status: 201 });
}