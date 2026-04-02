// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      branch: { select: { id: true, name: true, code: true } },
      employee: { select: { id: true, displayName: true, employeeCode: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, role, isActive, branchId, password } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined)     updateData.name = name;
  if (role !== undefined)     updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (branchId !== undefined) updateData.branchId = branchId || null;
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }
  const { id } = await params;
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      branch: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json(user);
}