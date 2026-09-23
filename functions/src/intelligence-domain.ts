/** Pure, deterministic intelligence policy. No Firestore or UI dependencies. */
export const INTEREST_HALF_LIFE_DAYS = 30;
export const TREND_HALF_LIFE_DAYS = 7;
export const RECOMMENDATION_VERSION = "v2";
export const MIN_PERSONALIZATION_EVENTS = 3;
export const MIN_MEANINGFUL_EVENTS = 1;

export const EVENT_WEIGHTS = {
  VIEW_LISTING: 1,
  AUCTION_VIEW: 1,
  CATEGORY_VIEW: 1,
  SEARCH: 3,
  SAVE_LISTING: 6,
  UNSAVE_LISTING: -3,
  BID: 8,
  MESSAGE_STARTED: 7,
  MESSAGE_SENT: 2,
  SHARE_LISTING: 3,
  FILTER_APPLIED: 1,
  SELLER_VIEW: 0,
  PROFILE_VIEW: 0,
  RECOMMENDATION_IMPRESSION: 0,
  RECOMMENDATION_CLICK: 3,
  PROMOTION_IMPRESSION: 0,
  PROMOTION_CLICK: 0,
  BOOST_CREATED: 0,
  BOOST_STARTED: 0,
  BOOST_EXPIRED: 0,
  FEATURED_CREATED: 0,
  FEATURED_STARTED: 0,
  FEATURED_EXPIRED: 0,
  NOT_INTERESTED: -4,
  INTEREST_RESTORED: 0,
  TRANSACTION_COMPLETED: 12,
  REVIEW_SUBMITTED: 0,
  PURCHASE: 0,
  BOOST_PURCHASED: 0,
  FEATURED_PURCHASED: 0,
} as const;
export type MarketplaceEventType = keyof typeof EVENT_WEIGHTS;
export type CandidateSource = "personalized" | "trending" | "recent" | "similar" | "nearby" | "auction" | "viewed";

export interface InterestProfile {
  category: Record<string, number>;
  priceBand: Record<string, number>;
  location: Record<string, number>;
  listingType: Record<string, number>;
  condition: Record<string, number>;
  recentQueries: string[];
  exposureCount: Record<string, number>;
  hiddenListings: Record<string, string>;
  recentlyViewed: string[];
  eventCount: number;
  meaningfulEventCount: number;
  updatedAt: string;
}

export interface Signal {
  type: MarketplaceEventType;
  listingId?: string;
  categoryId?: string;
  price?: number;
  location?: string;
  listingType?: string;
  condition?: string;
  query?: string;
  exposedListingIds?: string[];
}

export interface RankableListing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  price: number;
  location: string;
  listingType: string;
  condition: string;
  imageUrls: string[];
  status: string;
  createdAt: string;
  auctionStatus?: string | null;
  auctionEndAt?: string | null;
}

export interface Candidate {
  listing: RankableListing;
  source: CandidateSource;
  trendScore: number;
}

export interface RankedCandidate extends Candidate {
  score: number;
  components: Record<string, number>;
}

const dayMs = 86_400_000;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : 0));
const normalized = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");

export function decay(value: number, elapsedMs: number, halfLifeDays: number) {
  return clamp(value * Math.pow(0.5, Math.max(0, elapsedMs) / (halfLifeDays * dayMs)), -1000, 1000);
}

export function priceBand(price: number) {
  if (price < 100) return "under_100";
  if (price < 300) return "100_299";
  if (price < 700) return "300_699";
  if (price < 1500) return "700_1499";
  return "1500_plus";
}

export function emptyInterest(now: Date): InterestProfile {
  return { category: {}, priceBand: {}, location: {}, listingType: {}, condition: {}, recentQueries: [], exposureCount: {}, hiddenListings: {}, recentlyViewed: [], eventCount: 0, meaningfulEventCount: 0, updatedAt: now.toISOString() };
}

function decayMap(input: Record<string, number>, factorMs: number) {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    const next = decay(value, factorMs, INTEREST_HALF_LIFE_DAYS);
    if (Math.abs(next) >= 0.05) output[key] = Math.round(next * 100) / 100;
  }
  return output;
}

function add(map: Record<string, number>, key: string | undefined, amount: number, maxKeys: number) {
  if (!key || amount === 0) return map;
  const result = { ...map, [key]: clamp((map[key] ?? 0) + amount, -20, 40) };
  const entries = Object.entries(result).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, maxKeys);
  return Object.fromEntries(entries);
}

export function applyInterestSignal(previous: InterestProfile | null, signal: Signal, now: Date): InterestProfile {
  const base = previous ?? emptyInterest(now);
  const elapsed = Math.max(0, now.getTime() - Date.parse(base.updatedAt));
  const weight = EVENT_WEIGHTS[signal.type];
  // A listing-level dismissal must not suppress every item in its category.
  const score = signal.type === "NOT_INTERESTED" ? 0 : Math.min(8, Math.max(-8, weight));
  const hiddenListings = Object.fromEntries(Object.entries(base.hiddenListings ?? {}).filter(([, date]) => now.getTime() - Date.parse(date) < 30 * dayMs && Date.parse(date) <= now.getTime()).slice(-32));
  if (signal.type === "NOT_INTERESTED" && signal.listingId) hiddenListings[signal.listingId] = now.toISOString();
  if (signal.type === "INTEREST_RESTORED" && signal.listingId) delete hiddenListings[signal.listingId];
  const recentlyViewed = (signal.listingId && ["VIEW_LISTING", "AUCTION_VIEW"].includes(signal.type)
    ? [signal.listingId, ...(base.recentlyViewed ?? []).filter((id) => id !== signal.listingId)]
    : (base.recentlyViewed ?? [])).slice(0, 12);
  const exposureCount: Record<string, number> = {};
  for (const [id, count] of Object.entries(base.exposureCount ?? {})) {
    const recent = decay(count, elapsed, INTEREST_HALF_LIFE_DAYS);
    if (recent >= 0.05) exposureCount[id] = Math.round(recent * 100) / 100;
  }
  if (signal.type === "RECOMMENDATION_IMPRESSION") {
    for (const id of (signal.exposedListingIds ?? []).slice(0, 8)) exposureCount[id] = Math.min(5, (exposureCount[id] ?? 0) + 1);
  }
  if (signal.type === "RECOMMENDATION_CLICK" && signal.listingId) delete exposureCount[signal.listingId];
  const exposureEntries = Object.entries(exposureCount).slice(-32);
  const query = signal.type === "SEARCH" ? normalized(signal.query ?? "").slice(0, 60) : "";
  return {
    category: add(decayMap(base.category ?? {}, elapsed), signal.categoryId, score, 20),
    priceBand: add(decayMap(base.priceBand ?? {}, elapsed), signal.price === undefined ? undefined : priceBand(signal.price), score, 5),
    location: add(decayMap(base.location ?? {}, elapsed), signal.location ? normalized(signal.location).slice(0, 80) : undefined, score, 10),
    listingType: add(decayMap(base.listingType ?? {}, elapsed), signal.listingType, score, 3),
    condition: add(decayMap(base.condition ?? {}, elapsed), signal.condition, score, 4),
    recentQueries: query ? [query, ...base.recentQueries.filter((item) => item !== query)].slice(0, 5) : base.recentQueries.slice(0, 5),
    exposureCount: Object.fromEntries(exposureEntries),
    hiddenListings: Object.fromEntries(Object.entries(hiddenListings).slice(-32)),
    recentlyViewed,
    eventCount: Math.min(1_000_000, base.eventCount + (score === 0 && signal.type !== "NOT_INTERESTED" ? 0 : 1)),
    meaningfulEventCount: Math.min(1_000_000, base.meaningfulEventCount + (["SEARCH", "SAVE_LISTING", "BID", "MESSAGE_STARTED", "RECOMMENDATION_CLICK", "TRANSACTION_COMPLETED"].includes(signal.type) ? 1 : 0)),
    updatedAt: now.toISOString(),
  };
}

export function hasPersonalization(profile: InterestProfile | null, now = new Date()) {
  if (!profile || profile.eventCount < MIN_PERSONALIZATION_EVENTS || profile.meaningfulEventCount < MIN_MEANINGFUL_EVENTS) return false;
  const age = Math.max(0, now.getTime() - Date.parse(profile.updatedAt));
  return Object.values(profile.category).some((score) => decay(score, age, INTEREST_HALF_LIFE_DAYS) >= 1.5);
}

export function decayedTrend(score: number, updatedAt: string, now: Date) {
  return decay(score, Math.max(0, now.getTime() - Date.parse(updatedAt)), TREND_HALF_LIFE_DAYS);
}

export function scoreCandidate(candidate: Candidate, profile: InterestProfile | null, now: Date, savedIds: ReadonlySet<string>, ownedId?: string): RankedCandidate | null {
  const listing = candidate.listing;
  if (listing.status !== "active" || listing.id === ownedId || !Number.isFinite(listing.price) || listing.price <= 0
    || (listing.listingType !== "buy_now" && (listing.auctionStatus !== "active" || !listing.auctionEndAt || Date.parse(listing.auctionEndAt) <= now.getTime()))
    || (profile?.hiddenListings?.[listing.id] && now.getTime() - Date.parse(profile.hiddenListings[listing.id]!) < 30 * dayMs)) return null;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(listing.createdAt)) / dayMs);
  const profileAge = profile ? Math.max(0, now.getTime() - Date.parse(profile.updatedAt)) : 0;
  const affinity = (values: Record<string, number> | undefined, key: string) => decay(values?.[key] ?? 0, profileAge, INTEREST_HALF_LIFE_DAYS);
  const category = clamp(affinity(profile?.category, listing.categoryId) * 0.65, -8, 18);
  const price = clamp(affinity(profile?.priceBand, priceBand(listing.price)) * 0.35, -4, 8);
  const location = clamp(affinity(profile?.location, normalized(listing.location)) * 0.4, -4, 8);
  const listingType = clamp(affinity(profile?.listingType, listing.listingType) * 0.3, -3, 5);
  const condition = clamp(affinity(profile?.condition, listing.condition) * 0.25, -2, 4);
  const title = normalized(listing.title);
  const search = clamp((profileAge <= 30 * dayMs ? profile?.recentQueries ?? [] : []).reduce((best, query) => Math.max(best, query.split(" ").some((word) => word.length >= 3 && title.includes(word)) ? 6 : 0), 0), 0, 6);
  const freshness = clamp(10 * Math.pow(0.5, ageDays / 14), 0, 10);
  const quality = clamp((listing.imageUrls?.length ? 3 : 0) + (listing.description?.length >= 50 ? 2 : 0) + (listing.location ? 1 : 0), 0, 6);
  const trend = clamp(candidate.trendScore * 0.65, 0, 10);
  const repetition = clamp(decay(profile?.exposureCount[listing.id] ?? 0, profileAge, INTEREST_HALF_LIFE_DAYS) * 2, 0, 10);
  const saved = savedIds.has(listing.id) ? 8 : 0;
  const components = { category, price, location, listingType, condition, search, freshness, quality, trend, repetition, saved, trust: 0 };
  const score = Math.round((category + price + location + listingType + condition + search + freshness + quality + trend - repetition - saved) * 100) / 100;
  return { ...candidate, score, components };
}

export function rankCandidates(candidates: Candidate[], profile: InterestProfile | null, now: Date, savedIds: ReadonlySet<string>, maxResults = 8) {
  const remaining = candidates.map((candidate) => scoreCandidate(candidate, profile, now, savedIds)).filter((candidate): candidate is RankedCandidate => candidate !== null);
  const output: RankedCandidate[] = [];
  const categoryCount = new Map<string, number>();
  const sellerCount = new Map<string, number>();
  while (remaining.length && output.length < maxResults) {
    const hasAlternative = remaining.some((item) => (categoryCount.get(item.listing.categoryId) ?? 0) < 2);
    const hasSellerAlternative = remaining.some((item) => (sellerCount.get(item.listing.sellerId) ?? 0) < 2);
    let eligible = remaining.filter((item) => (!hasAlternative || (categoryCount.get(item.listing.categoryId) ?? 0) < 2)
      && (!hasSellerAlternative || (sellerCount.get(item.listing.sellerId) ?? 0) < 2));
    if (!eligible.length) eligible = hasAlternative ? remaining.filter((item) => (categoryCount.get(item.listing.categoryId) ?? 0) < 2) : remaining;
    if (!eligible.length) eligible = remaining;
    eligible.sort((a, b) => {
      const aAdjusted = a.score - Math.min(8, (categoryCount.get(a.listing.categoryId) ?? 0) * 4);
      const bAdjusted = b.score - Math.min(8, (categoryCount.get(b.listing.categoryId) ?? 0) * 4);
      return bAdjusted - aAdjusted || b.listing.createdAt.localeCompare(a.listing.createdAt) || a.listing.id.localeCompare(b.listing.id);
    });
    const next = eligible[0]!;
    remaining.splice(remaining.indexOf(next), 1);
    output.push(next);
    categoryCount.set(next.listing.categoryId, (categoryCount.get(next.listing.categoryId) ?? 0) + 1);
    sellerCount.set(next.listing.sellerId, (sellerCount.get(next.listing.sellerId) ?? 0) + 1);
  }
  return output;
}

export function similarityScore(reference: RankableListing, candidate: RankableListing, now = new Date()): number {
  if (candidate.status !== "active" || candidate.id === reference.id || candidate.sellerId === reference.sellerId
    || (candidate.listingType !== "buy_now" && (candidate.auctionStatus !== "active" || !candidate.auctionEndAt || Date.parse(candidate.auctionEndAt) <= now.getTime()))) return Number.NEGATIVE_INFINITY;
  const category = candidate.categoryId === reference.categoryId ? 20 : 0;
  const priceRatio = Math.abs(Math.log(Math.max(1, candidate.price) / Math.max(1, reference.price)));
  const price = clamp(8 - priceRatio * 5, 0, 8);
  const words = new Set(normalized(reference.title).split(" ").filter((word) => word.length >= 3));
  const keyword = clamp(normalized(candidate.title).split(" ").filter((word) => words.has(word)).length * 2, 0, 6);
  return category + price + keyword + (candidate.listingType === reference.listingType ? 4 : 0) + (candidate.condition === reference.condition ? 2 : 0);
}
