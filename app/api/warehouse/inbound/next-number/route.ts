// app/api/warehouse/inbound/next-number/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateGrNumber } from "@/lib/document-numbers";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId =
    session.user.role === "SUPER_ADMIN"
      ? (searchParams.get("branchId") ?? session.user.branchId)
      : session.user.branchId;

  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });
  if (!branch) return NextResponse.json({ error: "Branch tidak ditemukan" }, { status: 404 });

  const nextNumber = await generateGrNumber(branch.code);
  return NextResponse.json({ grNumber: nextNumber });
}