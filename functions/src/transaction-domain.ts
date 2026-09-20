/** Shared, server-owned transaction and reputation policy. Amounts are integer sen. */
export const REVIEW_WINDOW_DAYS = 14;
export const OFFER_WINDOW_DAYS = 7;
export const TIER_THRESHOLDS = Object.freeze({ bronze: 5, silver: 15, gold: 30, platinum: 75 });
export type Tier = keyof typeof TIER_THRESHOLDS;
export type DealStatus = "in_progress" | "completed" | "cancelled" | "disputed";
export type OfferStatus = "submitted" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";
export type PaymentMethod = "cod" | "bank_transfer" | "external" | "other";
export const BUYER_TO_SELLER_TAGS = ["Item as described", "Good communication", "Fast response", "Smooth transaction", "Friendly seller", "Good value", "Well packaged"] as const;
export const SELLER_TO_BUYER_TAGS = ["Easy to deal with", "Fast and decisive", "Good communication", "Punctual", "Payment completed", "Respectful", "Smooth transaction"] as const;

export function tierFor(count: number): Tier | null {
  if (!Number.isSafeInteger(count) || count < 0) return null;
  if (count >= TIER_THRESHOLDS.platinum) return "platinum";
  if (count >= TIER_THRESHOLDS.gold) return "gold";
  if (count >= TIER_THRESHOLDS.silver) return "silver";
  if (count >= TIER_THRESHOLDS.bronze) return "bronze";
  return null;
}

export function nextTier(count: number): { tier: Tier; threshold: number; remaining: number } | null {
  for (const [tier, threshold] of Object.entries(TIER_THRESHOLDS) as [Tier, number][]) {
    if (count < threshold) return { tier, threshold, remaining: threshold - count };
  }
  return null;
}

export function ringgitToSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && sen > 0 && sen <= 1_000_000_000 && Math.abs(value * 100 - sen) < 0.000001 ? sen : null;
}

export function validSen(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 1_000_000_000;
}

export function reviewVisible(reviewCount: number, windowEndMs: number, nowMs: number): boolean {
  return reviewCount >= 2 || nowMs >= windowEndMs;
}

export function validTags(tags: unknown, role: "buyer" | "seller"): tags is string[] {
  const allowed: readonly string[] = role === "buyer" ? BUYER_TO_SELLER_TAGS : SELLER_TO_BUYER_TAGS;
  return Array.isArray(tags) && tags.length <= 4 && new Set(tags).size === tags.length && tags.every((tag) => typeof tag === "string" && allowed.includes(tag));
}

export function nextRatingSummary(previous: { reviewCount?: number; ratingSum?: number; ratingDistribution?: Record<string, number> } | undefined, rating: number) {
  const reviewCount = Number(previous?.reviewCount ?? 0) + 1;
  const ratingSum = Number(previous?.ratingSum ?? 0) + rating;
  const ratingDistribution = { ...(previous?.ratingDistribution ?? {}) };
  ratingDistribution[String(rating)] = Number(ratingDistribution[String(rating)] ?? 0) + 1;
  return { reviewCount, ratingSum, ratingDistribution, averageRating: Math.round(ratingSum / reviewCount * 10) / 10 };
}
