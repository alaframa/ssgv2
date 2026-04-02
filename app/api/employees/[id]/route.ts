// app/api/employees/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── GET /api/employees/[id] ──────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      roles: { orderBy: { assignedAt: "asc" } },
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

// ─── PUT /api/employees/[id] ──────────────────────────────────────────────────
const UpdateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(60).optional(),
  joinDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.employee.findUnique({ where: { id } });
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

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.displayName !== undefined && { displayName: data.displayName.toUpperCase() }),
      ...(data.joinDate !== undefined && { joinDate: data.joinDate ? new Date(data.joinDate) : null }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      branch: { select: { code: true, name: true } },
      roles: true,
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json(updated);
}