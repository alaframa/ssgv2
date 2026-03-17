// app/api/cylinders/lookup/route.ts
//
// GET /api/cylinders/lookup?serial=SBY-12-00143
// Convenience endpoint to look up a cylinder by serial code without knowing its ID.
// Used by the weigh page's serial search.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const serial = searchParams.get("serial");
  if (!serial) return NextResponse.json({ error: "serial param required" }, { status: 400 });

  const unit = await prisma.cylinderUnit.findUnique({
    where: { serialCode: serial.trim().toUpperCase() },
    include: {
      type:   true,
      branch: { select: { id: true, code: true, name: true } },
      events: {
        orderBy: { eventAt: "desc" },
        take: 5,
        include: {
          customer: { select: { id: true, name: true, code: true, phone: true } },
          deliveryOrder: { select: { id: true, doNumber: true, doDate: true } },
          emptyReturn:   { select: { id: true, returnNumber: true, returnedAt: true } },
        },
      },
    },
  });

  if (!unit) return NextResponse.json({ error: `Tabung ${serial} tidak ditemukan` }, { status: 404 });

  return NextResponse.json(unit);
}