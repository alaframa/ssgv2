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

export async function getGasbackSettings(): Promise<typeof GASBACK_DEFAULTS> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(GASBACK_DEFAULTS) } },
    select: { key: true, value: true },
  });
  const result = { ...GASBACK_DEFAULTS };
  for (const row of rows) {
    if (row.key in result) {
      (result as Record<string, string>)[row.key] = row.value;
    }
  }
  return result;
}

export async function getGasbackRates(): Promise<{ rateKg12: number; rateKg50: number }> {
  const s = await getGasbackSettings();
  return {
    rateKg12: parseFloat(s.gasback_rate_kg12) || 0.5,
    rateKg50: parseFloat(s.gasback_rate_kg50) || 0.5,
  };
}