import type { ReputationTier, RoleReputation } from "../types/marketplace";

const tiers: ReputationTier[] = ["bronze", "silver", "gold", "platinum"];
export function reputationProgress(role: "buyer" | "seller", data: RoleReputation | undefined, thresholds: Record<ReputationTier, number>) {
  const count = data?.completedCount ?? 0;
  const tier = data?.tier ?? null;
  const currentThreshold = tier ? thresholds[tier] : 0;
  const nextTier = tiers.find(item => count < thresholds[item]);
  const nextThreshold = nextTier ? thresholds[nextTier] : thresholds.platinum;
  const percent = nextTier ? Math.max(0, Math.min(100, (count - currentThreshold) / Math.max(1, nextThreshold - currentThreshold) * 100)) : 100;
  const name = (value: string) => value[0].toUpperCase() + value.slice(1);
  return { count, tier, currentThreshold, nextTier, nextThreshold, percent,
    status: tier ? name(tier) : role === "buyer" ? "New Buyer" : "New Seller",
    nextMessage: nextTier ? `${nextThreshold - count} ${role === "buyer" ? "purchases" : "sales"} to unlock ${name(nextTier)}` : "You’ve reached Platinum" };
}
