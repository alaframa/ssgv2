// lib/gasback-settings.ts

import { prisma } from "@/lib/prisma";

export const GASBACK_DEFAULTS = {
  gasback_rate_kg12:        "0.5",
  gasback_rate_kg50:        "0.5",
  redemption_threshold_kg:  "240",
  free_refill_size:         "12",
  return_ratio_denominator: "20",
};

export type GasbackSettingKey = keyof typeof GASBACK_DEFAULTS;

/**
 * Reads gasback settings from SystemSetting table.
 * Falls back to GASBACK_DEFAULTS if:
 *  - The SystemSetting model hasn't been migrated yet (table doesn't exist)
 *  - Any individual key is missing
 */
export async function getGasbackSettings(): Promise<typeof GASBACK_DEFAULTS> {
  const result = { ...GASBACK_DEFAULTS };

  // Guard: if prisma.systemSetting doesn't exist (schema not yet migrated), return defaults
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
 * Returns numeric gasback rates. Always safe to call — never throws.
 */
export async function getGasbackRates(): Promise<{ rateKg12: number; rateKg50: number }> {
  const s = await getGasbackSettings();
  return {
    rateKg12: parseFloat(s.gasback_rate_kg12) || 0.5,
    rateKg50: parseFloat(s.gasback_rate_kg50) || 0.5,
  };
}