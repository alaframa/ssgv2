// app/api/cylinders/types/route.ts
//
// Manages CylinderType configuration: nominal tare, nominal full weight, label.
// Called from /settings/cylinder-types page.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CylinderSize } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const types = await prisma.cylinderType.findMany({
    orderBy: { size: "asc" },
    include: {
      _count: { select: { cylinders: true } },
    },
  });

  return NextResponse.json(types);
}

const UpsertSchema = z.object({
  size:           z.nativeEnum(CylinderSize),
  label:          z.string().min(1).max(60),
  nominalTareKg:  z.number().positive(),
  nominalFullKg:  z.number().positive(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  const { size, label, nominalTareKg, nominalFullKg } = parsed.data;

  if (nominalFullKg <= nominalTareKg) {
    return NextResponse.json(
      { error: "Berat penuh harus lebih besar dari berat tare (kosong)" },
      { status: 422 }
    );
  }

  const type = await prisma.cylinderType.upsert({
    where:  { size },
    update: { label, nominalTareKg, nominalFullKg },
    create: { size, label, nominalTareKg, nominalFullKg },
  });

  return NextResponse.json(type, { status: 201 });
}