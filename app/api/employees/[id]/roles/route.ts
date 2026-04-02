// app/api/employees/[id]/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { EmployeeRoleType } from "@prisma/client";

// ─── GET /api/employees/[id]/roles ────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;


  const roles = await prisma.employeeRole.findMany({
    where: { employeeId: id },
    orderBy: { assignedAt: "asc" },
  });

  return NextResponse.json(roles);
}

// ─── POST /api/employees/[id]/roles ──────────────────────────────────────────
// Add a new role to an employee
const AddRoleSchema = z.object({
  role: z.nativeEnum(EmployeeRoleType),
  notes: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AddRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }


  // Check if role already assigned
  const existing = await prisma.employeeRole.findFirst({
    where: { employeeId: id, role: parsed.data.role },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Role ${parsed.data.role} already assigned to this employee` },
      { status: 409 }
    );
  }

  const role = await prisma.employeeRole.create({
    data: {
      employeeId: id,
      role: parsed.data.role,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json(role, { status: 201 });
}

// ─── DELETE /api/employees/[id]/roles ────────────────────────────────────────
// Remove a role by passing { role: "DRIVER" } in the body
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z.object({ role: z.nativeEnum(EmployeeRoleType) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 422 });
  }


  // Prevent removing last role
  const count = await prisma.employeeRole.count({ where: { employeeId: id } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last role — employee must have at least one role" },
      { status: 400 }
    );
  }

  await prisma.employeeRole.deleteMany({
    where: { employeeId: id, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}