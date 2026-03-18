// prisma/seed-cylinder-types.ts
//
// Seeds the two required CylinderType rows (KG12 and KG50).
// Safe to run multiple times — uses upsert.
//
// Run: npx tsx prisma/seed-cylinder-types.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CYLINDER_TYPES = [
  {
    size:          "KG12" as const,
    label:         "Tabung 12 Kg",
    // Standard Indonesian LPG 12kg cylinder:
    // Tare (shell only) ≈ 14.5 kg, gas ≈ 12 kg → full ≈ 26.5 kg
    nominalTareKg: 14.5,
    nominalFullKg: 26.5,
  },
  {
    size:          "KG50" as const,
    label:         "Tabung 50 Kg",
    // Standard Indonesian LPG 50kg cylinder:
    // Tare (shell only) ≈ 33.5 kg, gas ≈ 50 kg → full ≈ 83.5 kg
    nominalTareKg: 33.5,
    nominalFullKg: 83.5,
  },
];

async function main() {
  console.log("🌱 Seeding CylinderType — defaults...\n");

  for (const ct of CYLINDER_TYPES) {
    const result = await prisma.cylinderType.upsert({
      where:  { size: ct.size },
      update: {}, // don't overwrite if already customised
      create: ct,
    });
    const gasNominal = Number(result.nominalFullKg) - Number(result.nominalTareKg);
    console.log(`  ✓ ${result.size} (${result.label})`);
    console.log(`    Tare: ${Number(result.nominalTareKg).toFixed(3)} kg`);
    console.log(`    Full: ${Number(result.nominalFullKg).toFixed(3)} kg`);
    console.log(`    Gas:  ${gasNominal.toFixed(3)} kg (nominal)\n`);
  }

  console.log("✅ Done. CylinderType seeded.");
  console.log("   To customise: visit /settings/cylinder-types in the app.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());