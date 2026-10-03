import { marketplaceCallable } from "@/lib/services/marketplace-call";
import { auth, functions } from "@/lib/firebase/client";
import type { Listing } from "@/types/marketplace";

export type PromotionType = "boost" | "featured";
export type PromotionStatus = "pending_payment" | "scheduled" | "active" | "expired" | "cancelled";
export interface PromotionPackage {
  id: string;
  type: PromotionType;
  label: string;
  durationHours: number;
  priceSen: number;
  currency: "MYR";
  available: boolean;
}
export interface SellerPromotion {
  id: string;
  listingId: string;
  sellerId: string;
  type: PromotionType;
  packageId: string;
  status: PromotionStatus;
  paymentStatus: "not_configured" | "pending" | "paid" | "refunded";
  paymentProvider: string;
  priceSen: number;
  currency: "MYR";
  durationHours: number;
  startAt: string | null;
  endAt: string | null;
  impressions: number;
  clicks: number;
  createdAt: string | null;
  updatedAt: string | null;
}
export interface PromotionBadge { promotionId: string; type: PromotionType }

function service() {
  if (!functions) throw new Error("Promotion service is not configured.");
  return functions;
}
function sellerService() {
  if (!auth?.currentUser) throw new Error("Sign in to manage promotions.");
  return service();
}

export async function getPromotionPackages() {
  return (await marketplaceCallable<void, { packages: PromotionPackage[]; paymentAvailable: boolean; pricingFinal: boolean }>(service(), "getPromotionPackages")()).data;
}
export async function getMyPromotionRequests(listingId: string) {
  return (await marketplaceCallable<{ listingId: string }, { promotions: SellerPromotion[] }>(sellerService(), "getMyPromotionRequests")({ listingId })).data.promotions;
}
export async function createPromotionRequest(listingId: string, packageId: string) {
  return (await marketplaceCallable<{ listingId: string; packageId: string }, { promotionId: string; status: PromotionStatus; paymentAvailable: boolean }>(sellerService(), "createPromotionRequest")({ listingId, packageId })).data;
}
export async function cancelPromotionRequest(promotionId: string) {
  return (await marketplaceCallable<{ promotionId: string }, { status: PromotionStatus }>(sellerService(), "cancelPromotionRequest")({ promotionId })).data;
}
export async function getPromotionPlacements(listings: Listing[], context: { categoryId?: string; search?: string }) {
  if (!listings.length) return { orderIds: [], badges: {} as Record<string, PromotionBadge> };
  const candidateIds = listings.slice(0, 24).map((listing) => listing.id);
  const result = (await marketplaceCallable<{ listingIds: string[]; categoryId?: string; search?: string }, { orderIds: string[]; badges: Record<string, PromotionBadge> }>(service(), "getPromotionPlacements")({ listingIds: candidateIds, ...context })).data;
  const known = new Set(candidateIds);
  const orderIds = [...new Set(result.orderIds.filter((id) => known.has(id)))];
  for (const listing of listings) if (!orderIds.includes(listing.id)) orderIds.push(listing.id);
  return { orderIds, badges: result.badges };
}
export async function getFeaturedPromotions() {
  return (await marketplaceCallable<void, { items: { listing: Listing; promotionId: string; type: PromotionType }[] }>(service(), "getFeaturedPromotions")()).data.items;
}
export function trackPromotionIntent(type: "PROMOTION_IMPRESSION" | "PROMOTION_CLICK", promotion: PromotionBadge, listingId: string, context: "home" | "explore") {
  if (!auth?.currentUser || !functions) return;
  void marketplaceCallable(service(), "trackPromotionEngagement")({ type, promotionId: promotion.promotionId, listingId, context }).catch(() => undefined);
}
