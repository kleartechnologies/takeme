import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase/client";
import type { Listing } from "@/types/marketplace";

export type CandidateSource = "personalized" | "trending" | "recent" | "similar" | "nearby" | "auction" | "viewed";
export type ClientMarketplaceEvent =
  | { type: "VIEW_LISTING" | "AUCTION_VIEW" | "SHARE_LISTING" | "NOT_INTERESTED" | "INTEREST_RESTORED"; listingId: string; context?: "home" | "detail" | "explore" | "profile" }
  | { type: "RECOMMENDATION_CLICK"; listingId: string; sessionId: string }
  | { type: "SEARCH"; query: string; context?: "home" | "explore" }
  | { type: "CATEGORY_VIEW"; categoryId: string; context?: "home" | "explore" }
  | { type: "FILTER_APPLIED"; categoryId?: string; filterKey: string; context?: "explore" }
  | { type: "SELLER_VIEW" | "PROFILE_VIEW"; targetId: string; context?: "profile" | "detail" }
  | { type: "RECOMMENDATION_IMPRESSION"; listingIds: string[]; sessionId: string };

export interface RecommendationPage {
  listings: Listing[];
  candidateSources: Record<string, CandidateSource>;
  personalized: boolean;
  sessionId: string | null;
}

export interface DiscoverySection {
  id: string;
  title: string;
  reason: string;
  type: "listing_rail";
  listings: { listing: Listing; candidateSource: CandidateSource }[];
  nextCursor: string | null;
}
export interface DiscoveryResponse {
  sections: DiscoverySection[];
  sessionId: string | null;
  metadata: { personalized: boolean; generatedAt: string; version: string };
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
  const callable = httpsCallable<void, { version: string; mode: "personalized" | "discovery"; sessionId: string | null; items: { listing: Listing; candidateSource: CandidateSource }[] }>(functions, "getMarketplaceRecommendations");
  const result = (await callable()).data;
  if (!["v1", "v2"].includes(result.version) || !Array.isArray(result.items)) throw new Error("Recommendation response is unavailable.");
  return { listings: result.items.map((item) => item.listing).filter((listing) => listing.status === "active"), candidateSources: Object.fromEntries(result.items.map((item) => [item.listing.id, item.candidateSource])), personalized: result.mode === "personalized", sessionId: result.version === "v2" ? result.sessionId : null };
}

export async function getMarketplaceDiscovery(sectionId?: string, cursor?: string): Promise<DiscoveryResponse> {
  if (!functions || !auth?.currentUser) throw new Error("Sign in to discover listings.");
  const callable = httpsCallable<{ sectionId?: string; cursor?: string }, DiscoveryResponse>(functions, "getMarketplaceDiscovery");
  const result = (await callable({ ...(sectionId ? { sectionId } : {}), ...(cursor ? { cursor } : {}) })).data;
  if (result.metadata?.version !== "v2" || !Array.isArray(result.sections)) throw new Error("Discovery response is unavailable.");
  return result;
}

export async function getSimilarListings(listing: Pick<Listing, "id">): Promise<{ listings: Listing[]; sessionId: string | null }> {
  if (!functions) throw new Error("Similar listings require Functions.");
  const callable = httpsCallable<{ listingId: string }, { listings: Listing[]; sessionId: string | null; version: string }>(functions, "getMarketplaceSimilar");
  const result = (await callable({ listingId: listing.id })).data;
  if (result.version !== "v2") throw new Error("Similar listings are unavailable.");
  return { listings: result.listings, sessionId: result.sessionId };
}
