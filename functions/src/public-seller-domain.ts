export const PUBLIC_SELLER_BATCH_LIMIT = 40;

export type PublicSellerTier = "bronze" | "silver" | "gold" | "platinum";

type RecordLike = Record<string, unknown> | undefined;

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function publicTier(value: unknown): PublicSellerTier | null {
  return ["bronze", "silver", "gold", "platinum"].includes(String(value)) ? value as PublicSellerTier : null;
}

/**
 * The only public projection used by marketplace discovery. Never spread source
 * documents here: user profiles and trust summaries may gain private fields.
 */
export function publicSellerSummary(userId: string, profile: RecordLike, trust: RecordLike) {
  if (!profile || typeof profile.displayName !== "string" || !profile.displayName.trim()) return null;
  const seller = trust?.seller && typeof trust.seller === "object" ? trust.seller as Record<string, unknown> : undefined;
  const reviewCount = nonNegativeInteger(seller?.reviewCount);
  const averageRating = reviewCount > 0 && typeof seller?.averageRating === "number" && Number.isFinite(seller.averageRating) && seller.averageRating >= 1 && seller.averageRating <= 5
    ? seller.averageRating
    : null;
  return {
    uid: userId,
    displayName: profile.displayName.trim().slice(0, 80),
    photoURL: typeof profile.photoURL === "string" && profile.photoURL.length <= 2048 ? profile.photoURL : null,
    sellerRating: averageRating,
    sellerReviewCount: reviewCount,
    sellerCompletedTransactionCount: nonNegativeInteger(seller?.completedCount),
    sellerTier: publicTier(seller?.tier),
    verificationStatus: trust?.verificationStatus === "verified" ? "verified" as const : "unverified" as const,
  };
}

export function publicSellerIds(value: unknown) {
  if (!Array.isArray(value) || value.length > PUBLIC_SELLER_BATCH_LIMIT) throw new Error(`Provide up to ${PUBLIC_SELLER_BATCH_LIMIT} seller IDs.`);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const valueId of value) {
    if (typeof valueId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(valueId)) throw new Error("A seller ID is invalid.");
    if (!seen.has(valueId)) { seen.add(valueId); ids.push(valueId); }
  }
  return ids;
}
