export const ADMIN_SECTIONS = ["overview", "users", "listings", "transactions", "revenue", "intelligence", "engagement", "promotions", "reviews", "reports", "settings"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export const ADMIN_PRESETS = ["today", "7d", "30d", "90d", "year", "all", "custom"] as const;
export type AdminPreset = typeof ADMIN_PRESETS[number];

export interface AdminRange { preset: AdminPreset; start: Date | null; end: Date; label: string }
const DAY = 86_400_000;
const malaysiaDay = (date: Date) => new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
const atMalaysiaMidnight = (day: string) => new Date(`${day}T00:00:00+08:00`);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(atMalaysiaMidnight(value).getTime()) && malaysiaDay(atMalaysiaMidnight(value)) === value;

export function adminRange(input: { preset?: unknown; from?: unknown; to?: unknown }, now = new Date()): AdminRange {
  const preset = ADMIN_PRESETS.includes(input.preset as AdminPreset) ? input.preset as AdminPreset : "30d";
  const today = malaysiaDay(now);
  const midnight = atMalaysiaMidnight(today);
  if (preset === "all") return { preset, start: null, end: now, label: "All time" };
  if (preset === "custom") {
    if (!validDate(input.from) || !validDate(input.to) || input.from > input.to) throw new Error("Choose a valid custom date range.");
    const start = atMalaysiaMidnight(input.from);
    const end = new Date(atMalaysiaMidnight(input.to).getTime() + DAY);
    if (end.getTime() - start.getTime() > 366 * DAY || start > now) throw new Error("Custom range must be within 366 days and not in the future.");
    return { preset, start, end: end > now ? now : end, label: `${input.from} – ${input.to}` };
  }
  const start = preset === "today" ? midnight : preset === "year" ? atMalaysiaMidnight(`${today.slice(0, 4)}-01-01`) : new Date(midnight.getTime() - (Number.parseInt(preset, 10) - 1) * DAY);
  return { preset, start, end: now, label: preset === "year" ? "This year" : preset === "today" ? "Today" : `Last ${Number.parseInt(preset, 10)} days` };
}

export function validMoneySen(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
export function completedValue(records: { status: string; amountSen: unknown; buyerId?: string; sellerId?: string }[]) {
  return records.reduce((sum, item) => sum + (item.status === "completed" && validMoneySen(item.amountSen) && item.buyerId !== item.sellerId ? item.amountSen : 0), 0);
}
export function averageSen(totalSen: number, count: number): number | null { return count > 0 ? Math.round(totalSen / count) : null; }
export function ctr(clicks: number, impressions: number): number | null { return impressions > 0 ? Math.round(clicks / impressions * 10_000) / 100 : null; }
export function tierDistribution(counts: Record<string, number>) {
  return { bronze: counts.bronze ?? 0, silver: counts.silver ?? 0, gold: counts.gold ?? 0, platinum: counts.platinum ?? 0 };
}
