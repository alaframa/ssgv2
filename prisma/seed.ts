// prisma/seed.ts

import { PrismaClient, CustomerType, GasbackTxType } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const seedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf-8")
);

const OPENING_DATE = new Date("2026-03-02");

async function main() {
  console.log("🌱 Seeding SSG V2 database...");

  // ── 1. Branches ──────────────────────────────────────────────────────────────
  const branchMap: Record<string, string> = {};
  for (const b of seedData.static_seed.branches) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {},
      create: { code: b.code, name: b.name },
    });
    branchMap[b.code] = branch.id;
  }
  console.log(`  ✓ Branches: ${Object.keys(branchMap).join(", ")}`);

  // ── 2. Supplier ──────────────────────────────────────────────────────────────
  const sup = seedData.static_seed.supplier;
  const supplier = await prisma.supplier.upsert({
    where: { code: sup.code },
    update: {},
    create: { code: sup.code, name: sup.name },
  });
  console.log(`  ✓ Supplier: ${supplier.name}`);

  // ── 3. HMT Quotas (March 2026) ───────────────────────────────────────────────
  const quota = seedData.static_seed.hmt_quota_march_2026;
  for (const [branchCode, sizes] of Object.entries(quota) as any) {
    for (const [size, data] of Object.entries(sizes) as any) {
      await prisma.supplierHmtQuota.upsert({
        where: {
          supplierId_branchId_cylinderSize_periodMonth_periodYear: {
            supplierId: supplier.id,
            branchId: branchMap[branchCode],
            cylinderSize: size as any,
            periodMonth: 3,
            periodYear: 2026,
          },
        },
        update: {},
        create: {
          supplierId: supplier.id,
          branchId: branchMap[branchCode],
          cylinderSize: size as any,
          periodMonth: 3,
          periodYear: 2026,
          quotaQty: data.quotaQty,
          pricePerUnit: 0,
        },
      });
    }
  }
  console.log("  ✓ HMT Quotas (March 2026)");

  // ── 4. Customers ─────────────────────────────────────────────────────────────
  const customerMap: Record<string, Record<string, string>> = { SBY: {}, YOG: {} };

  for (const branchCode of ["SBY", "YOG"] as const) {
    const customers: any[] = seedData.gasback_opening[branchCode].customers;
    let seq = 1;
    for (const c of customers) {
      const code = `${branchCode}-RET-${String(seq).padStart(4, "0")}`;
      const customer = await prisma.customer.upsert({
        where: { code },
        update: {},
        create: {
          branchId: branchMap[branchCode],
          code,
          name: c.name,
          customerType: CustomerType.RETAIL,
        },
      });
      customerMap[branchCode][c.name] = customer.id;
      seq++;
    }
    console.log(`  ✓ Customers ${branchCode}: ${customers.length} rows`);
  }

  // ── 5. GasbackLedger — opening ADJUSTMENT entries ────────────────────────────
  // Delete then re-create so re-runs stay clean
  await prisma.gasbackLedger.deleteMany({
    where: { txType: GasbackTxType.ADJUSTMENT, txDate: OPENING_DATE },
  });

  let gasbackCount = 0;
  for (const branchCode of ["SBY", "YOG"] as const) {
    const customers: any[] = seedData.gasback_opening[branchCode].customers;
    for (const c of customers) {
      if (!c.gasback_opening_balance) continue;
      const customerId = customerMap[branchCode][c.name];
      if (!customerId) continue;
      const bal = c.gasback_opening_balance;
      await prisma.gasbackLedger.create({
        data: {
          branchId: branchMap[branchCode],
          customerId,
          txType: GasbackTxType.ADJUSTMENT,
          qty: bal,
          amount: bal,
          runningBalance: bal,
          txDate: OPENING_DATE,
          notes: "Opening balance — seeded from March 2026 Gasback sheet",
        },
      });
      gasbackCount++;
    }
  }
  console.log(`  ✓ GasbackLedger ADJUSTMENT entries: ${gasbackCount} rows`);

  // ── 6. CustomerCylinderHolding — opening snapshot ────────────────────────────
  let holdingCount = 0;
  for (const branchCode of ["SBY", "YOG"] as const) {
    const holdings: any[] = seedData.stock_tabung_opening[branchCode].customer_holdings;
    for (const h of holdings) {
      const customerId = customerMap[branchCode][h.name];
      if (!customerId) continue;
      if (!h.held_kg12 && !h.held_kg50) continue;
      await prisma.customerCylinderHolding.upsert({
        where: { customerId_date: { customerId, date: OPENING_DATE } },
        update: {},
        create: {
          branchId: branchMap[branchCode],
          customerId,
          date: OPENING_DATE,
          kg12HeldQty: h.held_kg12 ?? 0,
          kg50HeldQty: h.held_kg50 ?? 0,
        },
      });
      holdingCount++;
    }
  }
  console.log(`  ✓ CustomerCylinderHolding opening rows: ${holdingCount}`);

  // ── 7. WarehouseStock — opening snapshot ─────────────────────────────────────
  for (const branchCode of ["SBY", "YOG"] as const) {
    const s = seedData.stock_tabung_opening[branchCode];
    await prisma.warehouseStock.upsert({
      where: { branchId_date: { branchId: branchMap[branchCode], date: OPENING_DATE } },
      update: {},
      create: {
        branchId: branchMap[branchCode],
        date: OPENING_DATE,
        kg12HmtQty: s.hmt.KG12,
        kg12KuotaWo: s.kuota_wo.KG12,
        kg50HmtQty: s.hmt.KG50,
        kg50KuotaWo: s.kuota_wo.KG50,
      },
    });
  }
  console.log("  ✓ WarehouseStock opening snapshot");

  // ── 8. Employees ─────────────────────────────────────────────────────────────
  const employees: any[] = seedData.employees.records;
  const rolePrefix: Record<string, string> = {
    DRIVER: "DRV", KENEK: "KNK", WAREHOUSE: "WRH", ADMIN: "ADM",
  };
  const empSeq: Record<string, number> = {};

  for (const e of employees) {
    const role = e.roles[0];
    const prefix = rolePrefix[role] ?? "OTH";
    const branchCode = e.branch as string;
    empSeq[`${branchCode}-${prefix}`] = (empSeq[`${branchCode}-${prefix}`] ?? 0) + 1;
    const empCode = `${branchCode}-${prefix}-${String(empSeq[`${branchCode}-${prefix}`]).padStart(3, "0")}`;

    const emp = await prisma.employee.upsert({
      where: { employeeCode: empCode },
      update: {},
      create: {
        branchId: branchMap[branchCode],
        employeeCode: empCode,
        fullName: e.fullName,
        displayName: e.displayName,
      },
    });

    // Only insert roles if none exist yet (idempotent)
    const existingRoles = await prisma.employeeRole.findMany({
      where: { employeeId: emp.id },
    });
    if (existingRoles.length === 0) {
      for (const r of e.roles) {
        await prisma.employeeRole.create({
          data: { employeeId: emp.id, role: r },
        });
      }
    }
  }
  console.log(`  ✓ Employees: ${employees.length} rows`);

  // ── 9. Default Users ─────────────────────────────────────────────────────────
  const PASSWORD = "ssg2026";
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const u of seedData.static_seed.default_users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: hash,
        branchId: u.branch ? branchMap[u.branch] : null,
      },
    });
  }
  console.log(`  ✓ Users: admin@ssg.id, manager.sby@ssg.id, manager.yog@ssg.id`);
  console.log(`  ✓ Default password: ssg2026`);

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });