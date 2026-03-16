// app/api/employees/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { EmployeeRoleType } from "@prisma/client";

// ─── Role → code prefix map ───────────────────────────────────────────────────
const ROLE_PREFIX: Record<string, string> = {
  DRIVER: "DRV",
  KENEK: "KNK",
  WAREHOUSE: "WRH",
  ADMIN: "ADM",
  FINANCE: "FIN",
  SALES: "SLS",
  BRANCH_MANAGER: "MGR",
  MECHANIC: "MCH",
  OTHER: "OTH",
};

// ─── GET /api/employees ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const branchId = searchParams.get("branchId") ?? "";
  const role = searchParams.get("role") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 30;
  const skip = (page - 1) * limit;

  // Branch filter: non-SUPER_ADMIN locked to their branch
  const effectiveBranchId =
    session.user.role === "SUPER_ADMIN"
      ? branchId || undefined
      : session.user.branchId ?? undefined;

  const where: any = {};
  if (effectiveBranchId) where.branchId = effectiveBranchId;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
    ];
  }
  // Filter by role via relation
  if (role && Object.values(EmployeeRoleType).includes(role as EmployeeRoleType)) {
    where.roles = { some: { role: role as EmployeeRoleType } };
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        branch: { select: { code: true, name: true } },
        roles: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { displayName: "asc" },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({
    employees,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// ─── POST /api/employees ──────────────────────────────────────────────────────
const CreateSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(1).max(120),
  displayName: z.string().min(1).max(60),
  roles: z.array(z.nativeEnum(EmployeeRoleType)).min(1, "At least one role required"),
  joinDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Resolve branch code for auto-generated employeeCode
  const branch = await prisma.branch.findUnique({
    where: { id: data.branchId },
    select: { code: true },
  });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 400 });

  // Primary role determines the code prefix
  const primaryRole = data.roles[0];
  const prefix = `${branch.code}-${ROLE_PREFIX[primaryRole] ?? "OTH"}`;

  // Find last code with this prefix to get next sequence
  const last = await prisma.employee.findFirst({
    where: { employeeCode: { startsWith: prefix } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });

  let seq = 1;
  if (last) {
    const parts = last.employeeCode.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  const employeeCode = `${prefix}-${String(seq).padStart(3, "0")}`;

  // Create employee + roles in a transaction
  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        branchId: data.branchId,
        employeeCode,
        fullName: data.fullName,
        displayName: data.displayName.toUpperCase(),
        isActive: data.isActive,
        joinDate: data.joinDate ? new Date(data.joinDate) : null,
        notes: data.notes || null,
      },
    });

    await tx.employeeRole.createMany({
      data: data.roles.map((role) => ({
        employeeId: emp.id,
        role,
      })),
    });

    return emp;
  });

  const full = await prisma.employee.findUnique({
    where: { id: employee.id },
    include: {
      branch: { select: { code: true, name: true } },
      roles: true,
    },
  });

  return NextResponse.json(full, { status: 201 });
}