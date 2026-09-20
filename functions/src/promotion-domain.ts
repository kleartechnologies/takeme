/** Server-owned promotion policy. These are example MYR prices, not launch prices. */
export const PROMOTION_PAYMENT_GATEWAY = { id: "none", available: false } as const;
export const DEFAULT_PROMOTION_PACKAGES = [
  { id: "boost_24h", type: "boost", label: "24 hours", durationHours: 24, priceSen: 290, currency: "MYR", available: true },
  { id: "boost_72h", type: "boost", label: "3 days", durationHours: 72, priceSen: 490, currency: "MYR", available: true },
  { id: "featured_168h", type: "featured", label: "7 days", durationHours: 168, priceSen: 990, currency: "MYR", available: true },
] as const;

export type PromotionType = "boost" | "featured";
export type PromotionStatus = "pending_payment" | "scheduled" | "active" | "expired" | "cancelled";
export type PromotionPaymentStatus = "not_configured" | "pending" | "paid" | "refunded";
export interface PromotionPackage {
  id: string;
  type: PromotionType;
  label: string;
  durationHours: number;
  priceSen: number;
  currency: "MYR";
  available: boolean;
}
export interface PromotionListing {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  status: string;
  listingType: string;
  auctionStatus?: string | null;
  auctionEndAt?: string | null;
  searchTokens?: string[];
}
export interface PromotionRecord {
  id: string;
  listingId: string;
  sellerId: string;
  type: PromotionType;
  packageId: string;
  status: PromotionStatus;
  paymentStatus: PromotionPaymentStatus;
  startAt: string | null;
  endAt: string | null;
}

export function validPackage(input: unknown): input is PromotionPackage {
  if (!input || typeof input !== "object") return false;
  const item = input as Partial<PromotionPackage>;
  return typeof item.id === "string" && /^[a-z0-9_]{4,40}$/.test(item.id)
    && (item.type === "boost" || item.type === "featured")
    && typeof item.label === "string" && item.label.length >= 2 && item.label.length <= 40
    && Number.isInteger(item.durationHours) && item.durationHours! >= 1 && item.durationHours! <= 720
    && Number.isInteger(item.priceSen) && item.priceSen! >= 1 && item.priceSen! <= 100_000
    && item.currency === "MYR" && typeof item.available === "boolean";
}

export function listingPromotionEligible(listing: PromotionListing, now: Date): boolean {
  if (listing.status !== "active") return false;
  if (listing.listingType === "buy_now") return true;
  if (listing.listingType !== "auction" && listing.listingType !== "buy_now_and_auction") return false;
  return (listing.auctionStatus === "scheduled" || listing.auctionStatus === "active")
    && Boolean(listing.auctionEndAt && Date.parse(listing.auctionEndAt) > now.getTime());
}

export function effectivePromotionStatus(promotion: PromotionRecord, now: Date): PromotionStatus {
  if ((promotion.status === "active" || promotion.status === "scheduled") && promotion.endAt && Date.parse(promotion.endAt) <= now.getTime()) return "expired";
  return promotion.status;
}

export function canServePromotion(promotion: PromotionRecord, listing: PromotionListing, now: Date): boolean {
  return promotion.status === "active" && promotion.paymentStatus === "paid"
    && promotion.listingId === listing.id && promotion.sellerId === listing.sellerId
    && Boolean(promotion.startAt && promotion.endAt && Date.parse(promotion.startAt) <= now.getTime() && Date.parse(promotion.endAt) > now.getTime())
    && listingPromotionEligible(listing, now);
}

export function matchesPlacementContext(listing: PromotionListing, categoryId = "", search = ""): boolean {
  if (categoryId && listing.categoryId !== categoryId) return false;
  const normalized = search.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").slice(0, 40);
  return !normalized || normalized.length >= 2 && Boolean(listing.searchTokens?.includes(normalized));
}

/** Allocation changes positions, never organic relevance scores. No listing is duplicated. */
export function allocatePromotionPlacements(candidates: PromotionListing[], promotions: PromotionRecord[], now: Date) {
  const eligible = promotions.filter((promotion) => {
    const listing = candidates.find((item) => item.id === promotion.listingId);
    return Boolean(listing && canServePromotion(promotion, listing, now));
  }).sort((a, b) => Number(b.type === "featured") - Number(a.type === "featured")
    || candidates.findIndex((item) => item.id === a.listingId) - candidates.findIndex((item) => item.id === b.listingId));
  const cap = Math.min(2, Math.floor(candidates.length / 4));
  const selected: PromotionRecord[] = [];
  const sellerIds = new Set<string>();
  for (const item of eligible) {
    if (selected.length >= cap) break;
    if (selected.some((other) => other.listingId === item.listingId) || sellerIds.has(item.sellerId)) continue;
    selected.push(item);
    sellerIds.add(item.sellerId);
  }
  const rest = candidates.map((item) => item.id).filter((id) => !selected.some((promotion) => promotion.listingId === id));
  for (let index = 0; index < selected.length; index += 1) rest.splice(Math.min(index === 0 ? 2 : 6, rest.length), 0, selected[index]!.listingId);
  return { orderIds: rest, badges: Object.fromEntries(selected.map((item) => [item.listingId, { promotionId: item.id, type: item.type }])) };
}
