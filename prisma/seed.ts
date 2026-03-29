// prisma/seed.ts
//
// Each seedXxx() function is independent. Comment out any call in main()
// to skip that section when testing specific features.

import { PrismaClient, CustomerType, GasbackTxType } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const seedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf-8")
);

const OPENING_DATE = new Date("2026-03-02");

// ─── Shared state (populated by earlier seed fns, consumed by later ones) ────
const branchMap: Record<string, string> = {};         // branchCode → branch.id
const customerMap: Record<string, Record<string, string>> = { SBY: {}, YOG: {} }; // branchCode → name → customer.id
let supplierId = "";

// ─────────────────────────────────────────────────────────────────────────────

async function seedBranches() {
  for (const b of seedData.static_seed.branches) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {},
      create: { code: b.code, name: b.name },
    });
    branchMap[b.code] = branch.id;
  }
  console.log(`  ✓ Branches: ${Object.keys(branchMap).join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedSupplier() {
  const sup = seedData.static_seed.supplier;
  const supplier = await prisma.supplier.upsert({
    where: { code: sup.code },
    update: {},
    create: { code: sup.code, name: sup.name },
  });
  supplierId = supplier.id;
  console.log(`  ✓ Supplier: ${supplier.name}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedHmtQuotas() {
  const quota = seedData.static_seed.hmt_quota_march_2026;
  for (const [branchCode, sizes] of Object.entries(quota) as any) {
    for (const [size, data] of Object.entries(sizes) as any) {
      await prisma.supplierHmtQuota.upsert({
        where: {
          supplierId_branchId_cylinderSize_periodMonth_periodYear: {
            supplierId,
            branchId: branchMap[branchCode],
            cylinderSize: size as any,
            periodMonth: 3,
            periodYear: 2026,
          },
        },
        update: {},
        create: {
          supplierId,
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
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedCustomers() {
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
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedGasbackOpeningBalances() {
// Wipe previous ADJUSTMENT entries for this date before re-seeding
  await prisma.gasbackLedger.deleteMany({
    where: { txType: GasbackTxType.ADJUSTMENT, txDate: OPENING_DATE },
  });

  let count = 0;
  for (const branchCode of ["SBY", "YOG"] as const) {
    const customers: any[] = seedData.gasback_opening[branchCode].customers;
    for (const c of customers) {
      if (!c.gasback_opening_balance) continue;
      const customerId = customerMap[branchCode][c.name];
      if (!customerId) {
        console.warn(`    ⚠ Gasback: customer not found — "${c.name}" (${branchCode})`);
        continue;
      }
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
      count++;
    }
  }
  console.log(`  ✓ GasbackLedger ADJUSTMENT entries: ${count} rows`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedCylinderHoldings() {
  let count = 0;
  for (const branchCode of ["SBY", "YOG"] as const) {
    const holdings: any[] = seedData.stock_tabung_opening[branchCode].customer_holdings;
    for (const h of holdings) {
      const customerId = customerMap[branchCode][h.name];
      if (!customerId) {
        console.warn(`    ⚠ Holding: customer not found — "${h.name}" (${branchCode})`);
        continue;
      }
      if (!h.held_kg12 && !h.held_kg50) continue;
      await prisma.customerCylinderHolding.upsert({
        where: {
          customerId_branchId: {
            customerId,
            branchId: branchMap[branchCode],
          },
        },
        update: {},
        create: {
          branchId: branchMap[branchCode],
          customerId,
          date: OPENING_DATE,
          kg12HeldQty: h.held_kg12 ?? 0,
          kg50HeldQty: h.held_kg50 ?? 0,
        },
      });
      count++;
    }
  }
  console.log(`  ✓ CustomerCylinderHolding: ${count} rows`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedWarehouseStockOpening() {
  for (const branchCode of ["SBY", "YOG"] as const) {
    const s = seedData.stock_tabung_opening[branchCode];
    await prisma.warehouseStock.upsert({
      where: {
        branchId_date: {
          branchId: branchMap[branchCode],
          date: OPENING_DATE,
        },
      },
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
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedEmployees() {
  const employees: any[] = seedData.employees.records;
  const rolePrefix: Record<string, string> = {
    DRIVER: "DRV",
    KENEK: "KNK",
    WAREHOUSE: "WRH",
    ADMIN: "ADM",
  };
  const empSeq: Record<string, number> = {};

  for (const e of employees) {
    const role = e.roles[0];
    const prefix = rolePrefix[role] ?? "OTH";
    const branchCode = e.branch as string;
    const seqKey = `${branchCode}-${prefix}`;
    empSeq[seqKey] = (empSeq[seqKey] ?? 0) + 1;
    const empCode = `${branchCode}-${prefix}-${String(empSeq[seqKey]).padStart(3, "0")}`;

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
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedDefaultUsers() {
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
  console.log("  ✓ Users: admin@ssg.id, manager.sby@ssg.id, manager.yog@ssg.id  (pw: ssg2026)");
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedCylinderTypes() {
  const cylinderTypes = [
    { size: "KG12" as const, label: "Tabung 12 Kg", nominalTareKg: 14.5, nominalFullKg: 26.5 },
    { size: "KG50" as const, label: "Tabung 50 Kg", nominalTareKg: 33.5, nominalFullKg: 83.5 },
  ];

  for (const ct of cylinderTypes) {
    await (prisma as any).cylinderType.upsert({
      where:  { size: ct.size },
      update: { label: ct.label, nominalTareKg: ct.nominalTareKg, nominalFullKg: ct.nominalFullKg },
      create: ct,
    });
  }
  console.log("  ✓ CylinderType: KG12 (tare 14.5 / full 26.5), KG50 (tare 33.5 / full 83.5)");
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedSystemSettings() {
  const settings = [
    { key: "gasback_mode",             value: "LEGACY", label: "Mode Gasback (LEGACY | WEIGHT)" },
    { key: "gasback_rate_kg12",        value: "0.5",    label: "Gasback rate per tabung 12kg (kg)" },
    { key: "gasback_rate_kg50",        value: "0.5",    label: "Gasback rate per tabung 50kg (kg)" },
    { key: "redemption_threshold_kg",  value: "240",    label: "Threshold saldo minimum untuk klaim (kg)" },
    { key: "free_refill_size",         value: "12",     label: "Ukuran isi gratis saat klaim (kg)" },
    { key: "return_ratio_denominator", value: "20",     label: "Rasio return manual (per kg gasback)" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where:  { key: s.key },
      update: {}, // don't overwrite values already customised
      create: { key: s.key, value: s.value, label: s.label },
    });
  }
  console.log("  ✓ SystemSettings: gasback defaults");
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery Orders
// Each raw DO record → 1 CustomerPo (keyed on po_ref) + 1 DeliveryOrder.
// Records with non-PO po_ref values (e.g. "Kg") are driver weight entries
// and are skipped.
// ─────────────────────────────────────────────────────────────────────────────

async function seedDeliveryOrders() {
  const records: any[] = seedData.delivery_orders.records;
  const branchCode = seedData.delivery_orders.branch as "SBY" | "YOG";
  const branchId = branchMap[branchCode];

  // Build a reverse-lookup: customer name → customerId (SBY branch)
  // We also need a fallback "unknown" customer for records that don't match.
  let unknownCustomerId: string | null = null;

  const getOrCreateCustomer = async (name: string): Promise<string> => {
    if (customerMap[branchCode][name]) return customerMap[branchCode][name];

    // Try a case-insensitive partial match among already-seeded customers
    const existing = await prisma.customer.findFirst({
      where: {
        branchId,
        name: { contains: name, mode: "insensitive" },
      },
    });
    if (existing) {
      customerMap[branchCode][name] = existing.id;
      return existing.id;
    }

    // Create on the fly with a generated code
    const code = `${branchCode}-RET-NEW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await prisma.customer.create({
      data: { branchId, code, name, customerType: CustomerType.RETAIL },
    });
    customerMap[branchCode][name] = created.id;
    return created.id;
  };

  // po_ref values that are not real PO numbers — skip these rows
  const isDriverWeightRow = (r: any) =>
    !r.po_ref ||
    r.po_ref === "Kg" ||
    typeof r.p12 === "string" ||
    typeof r.p50 === "string";

  let poCount = 0;
  let doCount = 0;
  // Cache po_ref → CustomerPo.id so we don't create duplicates
  const poCache: Record<string, string> = {};

  for (const r of records) {
    if (isDriverWeightRow(r)) continue;

    const customerId = await getOrCreateCustomer(r.customer);
    const poRef: string = r.po_ref;

    // ── CustomerPo ────────────────────────────────────────────────────────────
    if (!poCache[poRef]) {
      const existing = await prisma.customerPo.findUnique({ where: { poNumber: poRef } });
      if (existing) {
        poCache[poRef] = existing.id;
      } else {
        const po = await prisma.customerPo.create({
          data: {
            branchId,
            customerId,
            poNumber: poRef,
            kg12Qty: r.p12 ?? 0,
            kg50Qty: r.p50 ?? 0,
          },
        });
        poCache[poRef] = po.id;
        poCount++;
      }
    }

    const customerPoId = poCache[poRef];

    // ── DeliveryOrder ─────────────────────────────────────────────────────────
    // Some rows in the JSON share the same do_num (e.g. 03-860 appears twice
    // on different dates). Append the po_ref as a disambiguator when needed.
    const rawDoNum: string | undefined = r.do_num;
    const doNumber = rawDoNum
      ? rawDoNum
      : `AUTO-${branchCode}-${r.date.replace(/-/g, "")}-${poRef.replace(/[^A-Za-z0-9]/g, "")}`;

    // Skip if a DO with this number already exists
    const existingDo = await prisma.deliveryOrder.findUnique({ where: { doNumber } });
    if (existingDo) continue;

    await prisma.deliveryOrder.create({
      data: {
        branchId,
        customerPoId,
        doNumber,
        doDate: new Date(r.date),
        driverName: r.driver ?? null,
        kg12Released: r.p12 ?? 0,
        kg50Released: r.p50 ?? 0,
        kg12Delivered: r.r12 ?? 0,
        kg50Delivered: r.r50 ?? 0,
        notes: r.notes ?? null,
        status: "DELIVERED",
      },
    });
    doCount++;
  }

  console.log(`  ✓ CustomerPo: ${poCount} new rows`);
  console.log(`  ✓ DeliveryOrder: ${doCount} new rows`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — comment out any line to skip that section
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding SSG V2 database...\n");

  await seedBranches();
// await seedSupplier();
// await seedHmtQuotas();
// await seedCustomers();
// await seedGasbackOpeningBalances();
// await seedCylinderHoldings();
// await seedWarehouseStockOpening();
// await seedEmployees();
// await seedDefaultUsers();
// await seedCylinderTypes();
// await seedSystemSettings();
// await seedDeliveryOrders();

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