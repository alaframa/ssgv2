// app/api/settings/gasback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GASBACK_DEFAULTS } from "@/lib/gasback-settings";

// GET /api/settings/gasback
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(GASBACK_DEFAULTS) } },
  });

  const result: Record<string, string> = { ...GASBACK_DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }

  return NextResponse.json(result);
}

// PUT /api/settings/gasback — SUPER_ADMIN + BRANCH_MANAGER + FINANCE only
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"];
  if (!allowed.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const keys = Object.keys(GASBACK_DEFAULTS);
  const updater = session.user.name ?? session.user.email ?? "unknown";

  await prisma.$transaction(
    keys
      .filter((k) => body[k] !== undefined)
      .map((k) =>
        prisma.systemSetting.upsert({
          where:  { key: k },
          update: { value: String(body[k]), updatedBy: updater },
          create: { key: k, value: String(body[k]), label: k, updatedBy: updater },
        })
      )
  );

  return NextResponse.json({ ok: true });
}