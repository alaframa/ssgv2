// app/api/customers/[id]/cylinder-holdings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const holdings = await prisma.customerCylinderHolding.findMany({
    where: { id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(holdings);
}