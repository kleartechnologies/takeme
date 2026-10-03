import { marketplaceCall as onCall } from "./account-lifecycle";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createDiscoverySession, type ServedListing } from "./discovery-session";
import { publicListing } from "./intelligence";
import { displayPublicLocation, isPublicListingSafe, validatePublicLocation } from "./general-location";
import { decayedTrend, hasPersonalization, rankCandidates, RECOMMENDATION_VERSION, similarityScore,
  type Candidate, type CandidateSource, type InterestProfile, type RankedCandidate, type RankableListing } from "./intelligence-domain";

const PAGE_SIZE = 4;
const MAX_OFFSET = 16;
const normalize = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");
type SectionId = "for_you" | "because_you_like" | "trending_near_you" | "popular" | "just_listed" | "auctions" | "recently_viewed";
const sectionIds = new Set<SectionId>(["for_you", "because_you_like", "trending_near_you", "popular", "just_listed", "auctions", "recently_viewed"]);
interface SectionPlan { id: SectionId; title: string; reason: string; source: CandidateSource; items: RankedCandidate[] }

/** Bounded source fetches are independent of ranking and never query the entire marketplace. */
async function generateCandidates(uid: string, profile: InterestProfile | null, now: Date) {
  const db = getFirestore();
  const categories = profile && hasPersonalization(profile, now)
    ? Object.entries(profile.category).filter(([, score]) => score >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id) : [];
  const recentIds = (profile?.recentlyViewed ?? []).slice(0, 12);
  const [recent, auction, trends, user, saved, categoryPages] = await Promise.all([
    db.collection("listings").where("status", "==", "active").where("facetKeys", "array-contains", "*|*|*|*").orderBy("createdAt", "desc").limit(24).get(),
    db.collection("listings").where("status", "==", "active").where("auctionStatus", "==", "active").orderBy("auctionEndAt", "asc").limit(16).get(),
    db.collection("listingTrends").where("updatedAt", ">=", new Date(now.getTime() - 7 * 86_400_000).toISOString()).orderBy("updatedAt", "desc").limit(16).get(),
    db.collection("users").doc(uid).get(),
    db.collection("users").doc(uid).collection("saved").orderBy("savedAt", "desc").limit(12).get(),
    Promise.all(categories.map((id) => db.collection("listings").where("status", "==", "active").where("facetKeys", "array-contains", `${id}|*|*|*`).orderBy("createdAt", "desc").limit(12).get())),
  ]);
  const ids = [...new Set([...trends.docs.map((item) => item.id), ...recentIds])].slice(0, 28);
  const extra = ids.length ? await db.getAll(...ids.map((id) => db.collection("listings").doc(id))) : [];
  const map = new Map<string, Candidate>();
  const add = (listing: RankableListing, source: CandidateSource, trendScore = 0) => {
    if (listing.sellerId === uid || listing.status !== "active") return;
    const prior = map.get(listing.id);
    map.set(listing.id, { listing, source: prior?.source === "personalized" ? "personalized" : source, trendScore: Math.max(prior?.trendScore ?? 0, trendScore) });
  };
  for (const item of recent.docs) if (isPublicListingSafe(item.data())) add(publicListing(item.data(), item.id), "recent");
  for (const page of categoryPages) for (const item of page.docs) if (isPublicListingSafe(item.data())) add(publicListing(item.data(), item.id), "personalized");
  for (const item of auction.docs) if (isPublicListingSafe(item.data())) add(publicListing(item.data(), item.id), "auction");
  const trendMap = new Map(trends.docs.map((item) => [item.id, decayedTrend(Number(item.data().score ?? 0), String(item.data().updatedAt ?? ""), now)]));
  for (const item of extra) if (item.exists && isPublicListingSafe(item.data()!)) add(publicListing(item.data()!, item.id), trendMap.has(item.id) ? "trending" : "viewed", trendMap.get(item.id) ?? 0);
  const savedIds = new Set(saved.docs.map((item) => item.id));
  const profileLocation = user.data()?.location;
  const parts = typeof profileLocation === "string" ? profileLocation.split(", ") : [];
  const general = parts.length === 2 ? validatePublicLocation({ districtOrCity: parts[0], state: parts[1], country: "Malaysia" }) : null;
  const location = general ? displayPublicLocation(general) : "";
  return { candidates: [...map.values()], categories, savedIds, location, recentIds };
}

export function planSections(candidates: Candidate[], profile: InterestProfile | null, now: Date, savedIds: Set<string>, categories: string[], location: string, recentIds: string[]): SectionPlan[] {
  const personalized = hasPersonalization(profile, now);
  const ranked = (items: Candidate[], useProfile = false, max = 20) => rankCandidates(items.filter((item) => {
    const dismissed = profile?.hiddenListings?.[item.listing.id];
    return !dismissed || now.getTime() - Date.parse(dismissed) >= 30 * 86_400_000;
  }), useProfile ? profile : null, now, savedIds, max);
  const all = ranked(candidates, personalized);
  const trending = ranked(candidates.filter((item) => item.trendScore >= 1));
  const local = location ? ranked(candidates.filter((item) => item.trendScore >= 1 && normalize(item.listing.location) === normalize(location))) : [];
  const auctions = ranked(candidates.filter((item) => item.listing.listingType !== "buy_now" && item.listing.auctionStatus === "active"), personalized);
  const recentlyViewed = recentIds.map((id) => candidates.find((item) => item.listing.id === id)).filter((item): item is Candidate => Boolean(item));
  const recentRanked = ranked(recentlyViewed, false, 12).sort((a, b) => recentIds.indexOf(a.listing.id) - recentIds.indexOf(b.listing.id));
  const justListed = ranked(candidates.filter((item) => item.source === "recent")).sort((a, b) => b.listing.createdAt.localeCompare(a.listing.createdAt));
  const liked = personalized && categories.length ? ranked(candidates.filter((item) => categories.includes(item.listing.categoryId)), true) : [];
  return [
    { id: "for_you", title: personalized ? "For You" : "Discover something good", reason: personalized ? "Based on what you explore, save and search for." : "Fresh marketplace picks while TAKEME gets to know you.", source: personalized ? "personalized" : "recent", items: all },
    { id: "because_you_like", title: "Because You Like", reason: "More from categories you have explored.", source: "personalized", items: liked },
    { id: "trending_near_you", title: `Popular in ${location}`, reason: "Real recent interest in your profile location.", source: "nearby", items: local },
    { id: "popular", title: "Popular Right Now", reason: "Listings with recent marketplace interest.", source: "trending", items: trending },
    { id: "just_listed", title: "Just Listed", reason: "New active listings from TAKEME sellers.", source: "recent", items: justListed },
    { id: "auctions", title: "Auctions You May Like", reason: "Live auctions you can still bid on.", source: "auction", items: auctions },
    { id: "recently_viewed", title: "Recently Viewed", reason: "Items you opened recently.", source: "viewed", items: recentRanked },
  ].filter((section) => section.items.length > 0) as SectionPlan[];
}

export const getMarketplaceDiscovery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to see discovery.");
  const input = request.data && typeof request.data === "object" && !Array.isArray(request.data) ? request.data as Record<string, unknown> : {};
  if (Object.keys(input).some((key) => !["sectionId", "cursor"].includes(key))) throw new HttpsError("invalid-argument", "Unexpected discovery input.");
  const sectionId = input.sectionId;
  if (sectionId !== undefined && (typeof sectionId !== "string" || !sectionIds.has(sectionId as SectionId))) throw new HttpsError("invalid-argument", "Section is invalid.");
  const offset = input.cursor === undefined ? 0 : Number(input.cursor);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET || (offset > 0 && !sectionId)) throw new HttpsError("invalid-argument", "Cursor is invalid.");
  const now = new Date();
  const profile = (await getFirestore().collection("userInterests").doc(uid).get()).data() as InterestProfile | undefined;
  const { candidates, categories, savedIds, location, recentIds } = await generateCandidates(uid, profile ?? null, now);
  const plans = planSections(candidates, profile ?? null, now, savedIds, categories, location, recentIds);
  const seen = new Set<string>();
  const pools = plans.map((plan) => {
    const eligible = plan.items.filter((item) => !seen.has(item.listing.id));
    eligible.slice(0, PAGE_SIZE).forEach((item) => seen.add(item.listing.id));
    return { plan, eligible };
  });
  const firstPageIds = new Set(pools.flatMap(({ eligible }) => eligible.slice(0, PAGE_SIZE).map((item) => item.listing.id)));
  const sections = pools.filter(({ plan }) => !sectionId || plan.id === sectionId).map(({ plan, eligible }) => {
    const unique = [...eligible.slice(0, PAGE_SIZE), ...eligible.slice(PAGE_SIZE).filter((item) => !firstPageIds.has(item.listing.id))];
    const page = unique.slice(offset, offset + PAGE_SIZE);
    return { id: plan.id, title: plan.title, reason: plan.reason, type: "listing_rail" as const,
      listings: page.map((item) => ({ listing: item.listing, candidateSource: plan.source })),
      nextCursor: unique.length > offset + PAGE_SIZE && offset + PAGE_SIZE <= MAX_OFFSET ? String(offset + PAGE_SIZE) : null };
  }).filter((section) => section.listings.length > 0);
  const served: ServedListing[] = sections.flatMap((section) => section.listings.map((item) => ({ id: item.listing.id, source: item.candidateSource, sectionId: section.id, reasonId: section.id })));
  const sessionId = await createDiscoverySession(uid, served, now);
  return { sections, sessionId, metadata: { personalized: hasPersonalization(profile ?? null, now), generatedAt: now.toISOString(), version: RECOMMENDATION_VERSION } };
});

export const getMarketplaceSimilar = onCall(async (request) => {
  const listingId = request.data?.listingId;
  if (typeof listingId !== "string" || listingId.length < 1 || listingId.length > 128) throw new HttpsError("invalid-argument", "Listing is invalid.");
  const db = getFirestore();
  const referenceDoc = await db.collection("listings").doc(listingId).get();
  if (!referenceDoc.exists || !["active", "ended", "sold"].includes(String(referenceDoc.data()?.status)) || !isPublicListingSafe(referenceDoc.data()!)) throw new HttpsError("not-found", "Listing is unavailable.");
  const reference = publicListing(referenceDoc.data()!, referenceDoc.id);
  const now = new Date();
  const page = await db.collection("listings").where("status", "==", "active").where("facetKeys", "array-contains", `${reference.categoryId}|*|*|*`).orderBy("createdAt", "desc").limit(24).get();
  const listings = page.docs.filter((item) => isPublicListingSafe(item.data())).map((item) => publicListing(item.data(), item.id))
    .filter((item) => item.sellerId !== request.auth?.uid && similarityScore(reference, item, now) > Number.NEGATIVE_INFINITY)
    .sort((a, b) => similarityScore(reference, b, now) - similarityScore(reference, a, now) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 8);
  const sessionId = request.auth?.uid ? await createDiscoverySession(request.auth.uid, listings.map((item) => ({ id: item.id, source: "similar", sectionId: "more_like_this", reasonId: "same_category" }))) : null;
  return { listings, sessionId, version: RECOMMENDATION_VERSION };
});
