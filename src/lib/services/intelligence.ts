import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase/client";
import { getActiveListings } from "@/lib/services/listings";
import type { Listing } from "@/types/marketplace";

export type CandidateSource = "personalized" | "trending" | "recent" | "similar" | "nearby";
export type ClientMarketplaceEvent =
  | { type: "VIEW_LISTING" | "AUCTION_VIEW" | "SHARE_LISTING" | "RECOMMENDATION_CLICK" | "NOT_INTERESTED"; listingId: string; context?: "home" | "detail" | "explore" | "profile"; candidateSource?: CandidateSource }
  | { type: "SEARCH"; query: string; context?: "home" | "explore" }
  | { type: "CATEGORY_VIEW"; categoryId: string; context?: "home" | "explore" }
  | { type: "FILTER_APPLIED"; categoryId?: string; filterKey: string; context?: "explore" }
  | { type: "SELLER_VIEW" | "PROFILE_VIEW"; targetId: string; context?: "profile" | "detail" }
  | { type: "RECOMMENDATION_IMPRESSION"; listingIds: string[]; context: "home" | "detail"; candidateSource: CandidateSource };

export interface RecommendationPage {
  listings: Listing[];
  candidateSources: Record<string, CandidateSource>;
  personalized: boolean;
}

export async function trackMarketplaceEvent(event: ClientMarketplaceEvent) {
  if (!functions || !auth?.currentUser) return { accepted: false, reason: "not_signed_in" };
  const callable = httpsCallable<ClientMarketplaceEvent, { accepted: boolean; reason: string }>(functions, "trackMarketplaceEvent");
  return (await callable(event)).data;
}

/** Analytics must never block navigation or marketplace actions. */
export function trackMarketplaceIntent(event: ClientMarketplaceEvent) {
  void trackMarketplaceEvent(event).catch(() => undefined);
}

export async function getHomeRecommendations(): Promise<RecommendationPage> {
  if (!functions || !auth?.currentUser) throw new Error("Personalized discovery requires sign-in and Functions.");
  const callable = httpsCallable<void, { version: string; mode: "personalized" | "discovery"; items: { listing: Listing; candidateSource: CandidateSource }[] }>(functions, "getMarketplaceRecommendations");
  const result = (await callable()).data;
  if (result.version !== "v1" || !Array.isArray(result.items)) throw new Error("Recommendation response is unavailable.");
  return { listings: result.items.map((item) => item.listing).filter((listing) => listing.status === "active"), candidateSources: Object.fromEntries(result.items.map((item) => [item.listing.id, item.candidateSource])), personalized: result.mode === "personalized" };
}

const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter((word) => word.length >= 3);
export type SimilarityReference = Pick<Listing, "id" | "categoryId" | "price" | "currentBid" | "startingBid" | "listingType" | "condition" | "title">;

export function similarListingScore(reference: SimilarityReference, candidate: Listing) {
  if (candidate.id === reference.id || candidate.status !== "active") return Number.NEGATIVE_INFINITY;
  const referenceAmount = reference.listingType === "buy_now" ? reference.price : (reference.currentBid || reference.startingBid || 0) / 100;
  const candidateAmount = candidate.listingType === "buy_now" ? candidate.price : (candidate.currentBid || candidate.startingBid || 0) / 100;
  const price = Math.max(0, 8 - Math.abs(Math.log(Math.max(1, candidateAmount) / Math.max(1, referenceAmount))) * 5);
  const referenceWords = new Set(words(reference.title));
  const keywords = Math.min(6, words(candidate.title).filter((word) => referenceWords.has(word)).length * 2);
  return (candidate.categoryId === reference.categoryId ? 20 : 0) + price + keywords + (candidate.listingType === reference.listingType ? 4 : 0) + (candidate.condition === reference.condition ? 2 : 0);
}

export async function getSimilarListings(listing: SimilarityReference) {
  const page = await getActiveListings({ categoryId: listing.categoryId, sort: "newest", pageSize: 16 });
  return page.listings.filter((item) => item.id !== listing.id && item.status === "active").sort((a, b) => similarListingScore(listing, b) - similarListingScore(listing, a) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
}
