// lib/gasback-settings.ts
//
// Gasback settings — two modes:
//
// MODE 1 (LEGACY / BULK): Flat rate per cylinder delivered.
//   Used by the old DO DELIVERED flow.
//   Still used for DOs where individual cylinder tracking is NOT active.
//   gasback_rate_kg12 = kg of gasback per 12kg cylinder delivered
//   gasback_rate_kg50 = kg of gasback per 50kg cylinder delivered
//
// MODE 2 (INDIVIDUAL / WEIGHT-BASED): Actual gas remaining on return.
//   Used when cylinders have serial codes and are weighed on return.
//   gasback = weightReturnedKg - tare
//   This is the PREFERRED method per business requirement.
//   The calculation lives in /api/cylinders/[id]/weigh-return.
//
// The gasback_mode setting controls which mode is active:
//   "LEGACY"   = flat rate per DO (old behaviour)
//   "WEIGHT"   = per-cylinder weighing on return (new behaviour)

import { prisma } from "@/lib/prisma";

export const GASBACK_DEFAULTS = {
  // Mode: "LEGACY" or "WEIGHT"
  gasback_mode:             "LEGACY",
  // Legacy mode rates (still used if mode=LEGACY or for untracked cylinders)
  gasback_rate_kg12:        "0.5",
  gasback_rate_kg50:        "0.5",
  // Redemption settings
  redemption_threshold_kg:  "240",
  free_refill_size:         "12",
  return_ratio_denominator: "20",
};

export type GasbackSettingKey = keyof typeof GASBACK_DEFAULTS;

/**
 * Reads gasback settings from SystemSetting table.
 * Falls back to GASBACK_DEFAULTS if the table doesn't exist or key is missing.
 */
export async function getGasbackSettings(): Promise<typeof GASBACK_DEFAULTS> {
  const result = { ...GASBACK_DEFAULTS };

  if (!(prisma as any).systemSetting) {
    return result;
  }

  try {
    const rows = await (prisma as any).systemSetting.findMany({
      where: { key: { in: Object.keys(GASBACK_DEFAULTS) } },
      select: { key: true, value: true },
    });
    for (const row of rows as { key: string; value: string }[]) {
      if (row.key in result) {
        (result as Record<string, string>)[row.key] = row.value;
      }
    }
  } catch {
    // Table might not exist yet — silently use defaults
  }

  return result;
}

/**
 * Returns numeric gasback rates (legacy mode only).
 * Always safe to call — never throws.
 */
export async function getGasbackRates(): Promise<{ rateKg12: number; rateKg50: number; mode: string }> {
  const s = await getGasbackSettings();
  return {
    rateKg12: parseFloat(s.gasback_rate_kg12) || 0.5,
    rateKg50: parseFloat(s.gasback_rate_kg50) || 0.5,
    mode:     s.gasback_mode,
  };
}

/**
 * Whether the system is in weight-based gasback mode.
 * When true, gasback should NOT be auto-credited on DO DELIVERED —
 * instead it is credited when the cylinder is weighed on return.
 */
export async function isWeightBasedGasback(): Promise<boolean> {
  const s = await getGasbackSettings();
  return s.gasback_mode === "WEIGHT";
}