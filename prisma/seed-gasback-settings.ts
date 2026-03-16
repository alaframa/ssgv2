// prisma/seed-gasback-settings.ts
// Run: npx tsx prisma/seed-gasback-settings.ts
//
// Seeds the default gasback configuration into SystemSetting table.
// Safe to run multiple times — uses upsert.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULTS = [
  {
    key:   "gasback_rate_kg12",
    value: "0.5",
    label: "Gasback rate per tabung 12kg yang dikirim (satuan: kg)",
    notes: "Setiap tabung 12kg yang dikirim dan diterima pelanggan menghasilkan 0.5 kg gasback",
  },
  {
    key:   "gasback_rate_kg50",
    value: "0.5",
    label: "Gasback rate per tabung 50kg yang dikirim (satuan: kg)",
    notes: "Setiap tabung 50kg yang dikirim dan diterima pelanggan menghasilkan 0.5 kg gasback",
  },
  {
    key:   "redemption_threshold_kg",
    value: "240",
    label: "Threshold saldo gasback untuk 1x redemption (satuan: kg)",
    notes: "Pelanggan harus memiliki minimal 240 kg gasback untuk bisa klaim 1 tabung gratis",
  },
  {
    key:   "free_refill_size",
    value: "12",
    label: "Ukuran tabung yang diberikan gratis saat redemption",
    notes: "12 = tabung 12kg gratis, 50 = tabung 50kg gratis",
  },
  {
    key:   "return_ratio_denominator",
    value: "20",
    label: "Penyebut rasio return gas (catatan manual)",
    notes: "Setiap 20kg gas sisa yang dikembalikan = 1kg gasback (hitung manual, bukan otomatis). Jadi 240kg threshold = 240×20 = 4.800kg return gas total.",
  },
];

async function main() {
  console.log("🌱 Seeding SystemSetting — gasback defaults...");

  for (const d of DEFAULTS) {
    await prisma.systemSetting.upsert({
      where:  { key: d.key },
      update: {}, // don't overwrite existing values
      create: d,
    });
    console.log(`  ✓ ${d.key} = ${d.value}`);
  }

  console.log("\n✅ Done. All gasback settings seeded.");
  console.log("   To change settings: visit /settings/gasback in the app");
  console.log("   Or update directly: npx prisma studio → SystemSetting table");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());