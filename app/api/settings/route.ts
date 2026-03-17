// app/api/settings/route.ts
// GET /api/settings?key=gasback_mode
// Returns a single SystemSetting value by key, with fallback to defaults.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GASBACK_DEFAULTS } from "@/lib/gasback-settings";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    // Return all settings
    try {
      const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
      return NextResponse.json(rows);
    } catch {
      return NextResponse.json([]);
    }
  }

  // Return specific key with fallback
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row) return NextResponse.json({ key: row.key, value: row.value });
    // Fall back to GASBACK_DEFAULTS
    const defaultVal = (GASBACK_DEFAULTS as Record<string, string>)[key];
    if (defaultVal !== undefined) {
      return NextResponse.json({ key, value: defaultVal, isDefault: true });
    }
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  } catch {
    const defaultVal = (GASBACK_DEFAULTS as Record<string, string>)[key];
    if (defaultVal !== undefined) {
      return NextResponse.json({ key, value: defaultVal, isDefault: true });
    }
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { key, value, label, notes } = body as Record<string, string>;
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value required" }, { status: 422 });
  }

  const row = await prisma.systemSetting.upsert({
    where:  { key },
    update: { value, label: label ?? undefined, notes: notes ?? undefined, updatedBy: session.user.name ?? undefined },
    create: { key, value, label: label ?? undefined, notes: notes ?? undefined, updatedBy: session.user.name ?? undefined },
  });

  return NextResponse.json(row);
}