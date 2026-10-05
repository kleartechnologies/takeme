import { marketplaceCall as onCall, marketplaceMutationCall, runGuardedTransaction, accountIsActive } from "./account-lifecycle";
import { marketplaceAccountIsEligible } from "./account-eligibility";
import { createHash } from "node:crypto";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { createDiscoverySession, verifyDiscoverySession } from "./discovery-session";
import { displayPublicLocation, isPublicListingSafe, publishableLocation } from "./general-location";
import { listingCategoryId } from "./engagement-domain";
import {
  applyInterestSignal,
  decayedTrend,
  EVENT_WEIGHTS,
  hasPersonalization,
  rankCandidates,
  RECOMMENDATION_VERSION,
  type Candidate,
  type CandidateSource,
  type InterestProfile,
  type MarketplaceEventType,
  type RankableListing,
  type Signal,
} from "./intelligence-domain";

const CLIENT_TYPES = new Set<MarketplaceEventType>(["VIEW_LISTING", "AUCTION_VIEW", "SEARCH", "CATEGORY_VIEW", "FILTER_APPLIED", "SHARE_LISTING", "PROFILE_VIEW", "SELLER_VIEW", "RECOMMENDATION_IMPRESSION", "RECOMMENDATION_CLICK", "NOT_INTERESTED", "INTEREST_RESTORED"]);
const LISTING_TYPES = new Set<MarketplaceEventType>(["VIEW_LISTING", "AUCTION_VIEW", "SHARE_LISTING", "RECOMMENDATION_CLICK", "NOT_INTERESTED", "INTEREST_RESTORED"]);
const dailyClientCap = 100;
const nowIso = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");

function string(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return value.trim();
}

function eventWindowMs(type: MarketplaceEventType) {
  if (type === "NOT_INTERESTED" || type === "INTEREST_RESTORED") return 1;
  if (type === "VIEW_LISTING" || type === "AUCTION_VIEW") return 30 * 60_000;
  if (type === "RECOMMENDATION_CLICK") return 10 * 60_000;
  return 60 * 60_000;
}

interface EventEnvelope { source: "client" | "saved" | "bid" | "conversation" | "message"; sellerId?: string; context?: string; candidateSource?: CandidateSource; sectionId?: string; reasonId?: string; promotionId?: string }

export async function recordMarketplaceSignal(uid: string, signal: Signal, dedupeKey: string, envelope: EventEnvelope, now = new Date()) {
  // Legacy listing/deal metadata may have no real category. Generic activity
  // still counts, but invalid values cannot become interest-map keys.
  signal = { ...signal, categoryId: listingCategoryId(signal.categoryId) ?? undefined };
  const db = getFirestore();
  const eventId = hash(`${uid}|${signal.type}|${dedupeKey}`);
  const eventRef = db.collection("marketplaceEvents").doc(eventId);
  const interestRef = db.collection("userInterests").doc(uid);
  const trendRef = signal.listingId && EVENT_WEIGHTS[signal.type] > 0 ? db.collection("listingTrends").doc(signal.listingId) : null;
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const quotaRef = envelope.source === "client" ? db.collection("intelligenceQuotas").doc(`${uid}_${day}`) : null;
  const promotionRef = envelope.promotionId ? db.collection("promotions").doc(envelope.promotionId) : null;
  const attributionRef = signal.type === "RECOMMENDATION_CLICK" && signal.listingId && envelope.sectionId
    ? db.collection("discoveryAttributions").doc(hash(`${uid}|${signal.listingId}`)) : null;
  const promotionListingRef = promotionRef && signal.listingId ? db.collection("listings").doc(signal.listingId) : null;
  return runGuardedTransaction(db, async (transaction) => {
    if (!(await accountIsActive(uid, transaction)) || !(await marketplaceAccountIsEligible(uid, transaction))) return { accepted: false, reason: "account_unavailable" as const };
    const [existing, interest, trend, quota, promotion, promotionListing] = await Promise.all([
      transaction.get(eventRef), transaction.get(interestRef), trendRef ? transaction.get(trendRef) : null, quotaRef ? transaction.get(quotaRef) : null,
      promotionRef ? transaction.get(promotionRef) : null, promotionListingRef ? transaction.get(promotionListingRef) : null,
    ]);
    if (existing.exists) return { accepted: false, reason: "duplicate" as const };
    if (quotaRef && Number(quota?.data()?.count ?? 0) >= dailyClientCap) return { accepted: false, reason: "daily_limit" as const };
    if (promotionRef) {
      const data = promotion?.data();
      const listing = promotionListing?.data();
      if (!data || !listing || data.listingId !== signal.listingId || data.sellerId === uid || listing.sellerId !== data.sellerId
        || data.status !== "active" || data.paymentStatus !== "paid" || listing.status !== "active"
        || !(data.startAt instanceof Timestamp) || !(data.endAt instanceof Timestamp)
        || data.startAt.toMillis() > now.getTime() || data.endAt.toMillis() <= now.getTime()
        || (listing.listingType !== "buy_now" && (!["active", "scheduled"].includes(listing.auctionStatus) || !(listing.auctionEndAt instanceof Timestamp) || listing.auctionEndAt.toMillis() <= now.getTime()))) {
        return { accepted: false, reason: "promotion_unavailable" as const };
      }
    }
    const profile = applyInterestSignal((interest.data() as InterestProfile | undefined) ?? null, signal, now);
    const categoryId = signal.categoryId ?? listingCategoryId(promotionListing?.data()?.categoryId);
    const timestamp = Timestamp.fromDate(now);
    transaction.create(eventRef, {
      userId: uid, eventType: signal.type, source: envelope.source,
      ...(signal.listingId ? { listingId: signal.listingId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(envelope.sellerId || promotion?.data()?.sellerId ? { sellerId: envelope.sellerId ?? promotion?.data()?.sellerId } : {}),
      ...(signal.query ? { query: signal.query } : {}),
      ...(signal.price !== undefined ? { price: signal.price } : {}),
      ...(signal.listingType ? { listingType: signal.listingType, auction: signal.listingType !== "buy_now" } : {}),
      ...(signal.exposedListingIds ? { exposedListingIds: signal.exposedListingIds } : {}),
      ...(envelope.context ? { context: envelope.context } : {}),
      ...(envelope.candidateSource ? { candidateSource: envelope.candidateSource } : {}),
      ...(envelope.sectionId ? { sectionId: envelope.sectionId } : {}),
      ...(envelope.reasonId ? { reasonId: envelope.reasonId } : {}),
      ...(envelope.promotionId ? { promotionId: envelope.promotionId } : {}),
      createdAt: timestamp, expiresAt: Timestamp.fromMillis(now.getTime() + 90 * 86_400_000),
    });
    transaction.set(interestRef, { ...profile, userId: uid });
    if (trendRef && trend) {
      const prior = trend.data();
      const priorScore = decayedTrend(Number(prior?.score ?? 0), typeof prior?.updatedAt === "string" ? prior.updatedAt : now.toISOString(), now);
      transaction.set(trendRef, { listingId: signal.listingId, score: Math.min(100, priorScore + Math.min(8, EVENT_WEIGHTS[signal.type])), updatedAt: now.toISOString(), eventCount: Math.min(1_000_000, Number(prior?.eventCount ?? 0) + 1) });
    }
    if (quotaRef) transaction.set(quotaRef, { userId: uid, day, count: Number(quota?.data()?.count ?? 0) + 1, expiresAt: Timestamp.fromMillis(now.getTime() + 3 * 86_400_000) });
    if (attributionRef) transaction.set(attributionRef, { userId: uid, listingId: signal.listingId, sectionId: envelope.sectionId,
      reasonId: envelope.reasonId, candidateSource: envelope.candidateSource, clickedAt: timestamp,
      expiresAt: Timestamp.fromMillis(now.getTime() + 7 * 86_400_000) });
    if (promotionRef && promotion) transaction.update(promotionRef, { [signal.type === "PROMOTION_IMPRESSION" ? "impressions" : "clicks"]: Math.min(1_000_000_000, Number(promotion.data()?.[signal.type === "PROMOTION_IMPRESSION" ? "impressions" : "clicks"] ?? 0) + 1) });
    return { accepted: true, reason: "recorded" as const };
  });
}

export function publicListing(data: DocumentData, id: string): RankableListing & Record<string, unknown> {
  const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : typeof value === "string" ? value : null;
  return {
    id, sellerId: String(data.sellerId ?? ""), title: String(data.title ?? ""), description: String(data.description ?? ""), categoryId: String(data.categoryId ?? ""),
    condition: String(data.condition ?? ""), price: Number(data.price ?? 0), listingType: String(data.listingType ?? "buy_now"), location: publishableLocation(data) ? displayPublicLocation(publishableLocation(data)!) : "",
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [], status: String(data.status ?? ""), createdAt: iso(data.createdAt) ?? "", updatedAt: iso(data.updatedAt),
    auctionStartAt: iso(data.auctionStartAt), auctionEndAt: iso(data.auctionEndAt), startingBid: data.startingBid ?? null, currentBid: data.currentBid ?? null,
    bidCount: data.bidCount ?? null, minimumBidIncrement: data.minimumBidIncrement ?? null,
    auctionStatus: data.auctionStatus ?? null, finalBid: data.finalBid ?? null, endedAt: iso(data.endedAt),
  };
}

async function listingSignal(listingId: string, type: MarketplaceEventType, extra: Partial<Signal> = {}) {
  const snapshot = await getFirestore().collection("listings").doc(listingId).get();
  const data = snapshot.data();
  if (!data || !["active", "ended"].includes(data.status) || !isPublicListingSafe(data)) return null;
  const amount = data.listingType === "buy_now" ? Number(data.price) : Number(data.currentBid || data.startingBid || 0) / 100;
  const categoryId = listingCategoryId(data.categoryId);
  return { signal: { type, listingId, ...(categoryId ? { categoryId } : {}), price: amount, location: displayPublicLocation(publishableLocation(data)!), listingType: String(data.listingType ?? ""), condition: String(data.condition ?? ""), ...extra } as Signal, sellerId: String(data.sellerId ?? "") };
}

export const trackMarketplaceEvent = marketplaceMutationCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to record marketplace activity.");
  const input = request.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpsError("invalid-argument", "Event data is required.");
  const data = input as Record<string, unknown>;
  const type = data.type as MarketplaceEventType;
  if (!CLIENT_TYPES.has(type)) throw new HttpsError("permission-denied", "This event must come from an authoritative marketplace record.");
  if (Object.keys(data).some((key) => !["type", "listingId", "categoryId", "query", "targetId", "context", "listingIds", "filterKey", "sessionId"].includes(key))) throw new HttpsError("invalid-argument", "Unexpected event field.");
  const now = new Date();
  let signal: Signal = { type };
  let sellerId: string | undefined;
  let scope: string;
  let served: Awaited<ReturnType<typeof verifyDiscoverySession>> = [];
  if (LISTING_TYPES.has(type)) {
    const listingId = string(data.listingId, "Listing", 1, 128);
    if (type === "RECOMMENDATION_CLICK") served = await verifyDiscoverySession(uid, data.sessionId, [listingId], now);
    const detail = await listingSignal(listingId, type);
    if (!detail || (type !== "NOT_INTERESTED" && detail.signal.type === "AUCTION_VIEW" && detail.signal.listingType === "buy_now")) throw new HttpsError("failed-precondition", "Listing is unavailable for this event.");
    if (detail.sellerId === uid) return { accepted: false, reason: "own_listing" };
    signal = detail.signal; sellerId = detail.sellerId; scope = listingId;
  } else if (type === "SEARCH") {
    const query = clean(string(data.query, "Search", 2, 60));
    if (query.length < 2) throw new HttpsError("invalid-argument", "Search must contain at least two characters.");
    signal = { type, query }; scope = query;
  } else if (type === "CATEGORY_VIEW") {
    const categoryId = string(data.categoryId, "Category", 1, 60);
    signal = { type, categoryId }; scope = categoryId;
  } else if (type === "FILTER_APPLIED") {
    const filterKey = string(data.filterKey, "Filter", 1, 120);
    const categoryId = typeof data.categoryId === "string" && data.categoryId.length <= 60 ? data.categoryId : undefined;
    signal = { type, categoryId }; scope = hash(filterKey);
  } else if (type === "PROFILE_VIEW" || type === "SELLER_VIEW") {
    const targetId = string(data.targetId, "Profile", 1, 128);
    if (type === "SELLER_VIEW" && targetId === uid) return { accepted: false, reason: "own_profile" };
    if (!(await getFirestore().collection("users").doc(targetId).get()).exists) throw new HttpsError("not-found", "Profile is unavailable.");
    scope = targetId;
  } else if (type === "RECOMMENDATION_IMPRESSION") {
    if (!Array.isArray(data.listingIds) || data.listingIds.length !== 1 || data.listingIds.some((id) => typeof id !== "string" || id.length > 128 || id.length < 1)) throw new HttpsError("invalid-argument", "A card impression must contain one listing.");
    const ids = [...new Set(data.listingIds as string[])];
    served = await verifyDiscoverySession(uid, data.sessionId, ids, now);
    signal = { type, exposedListingIds: ids, ...(ids.length === 1 ? { listingId: ids[0] } : {}) };
    scope = ids.join(",");
  } else throw new HttpsError("invalid-argument", "Unsupported event.");
  const context = typeof data.context === "string" && ["home", "detail", "explore", "profile"].includes(data.context) ? data.context : undefined;
  const attribution = served.length === 1 ? served[0] : undefined;
  const candidateSource = attribution?.source;
  const bucket = Math.floor(now.getTime() / eventWindowMs(type));
  return recordMarketplaceSignal(uid, signal, `${type}|${scope}|${bucket}`, { source: "client", sellerId, context: attribution ? "discovery" : context, candidateSource, sectionId: attribution?.sectionId, reasonId: attribution?.reasonId }, now);
});

export const onSavedListingCreated = onDocumentCreated("users/{uid}/saved/{listingId}", async (event) => {
  const uid = event.params.uid;
  const listingId = event.params.listingId;
  const detail = await listingSignal(listingId, "SAVE_LISTING");
  if (!detail || detail.sellerId === uid) return;
  const attribution = (await getFirestore().collection("discoveryAttributions").doc(hash(`${uid}|${listingId}`)).get()).data();
  const valid = attribution?.userId === uid && attribution?.listingId === listingId && attribution?.expiresAt instanceof Timestamp
    && attribution.expiresAt.toMillis() > Date.now();
  await recordMarketplaceSignal(uid, detail.signal, `saved-create|${event.id}`, { source: "saved", sellerId: detail.sellerId,
    ...(valid ? { sectionId: attribution.sectionId, reasonId: attribution.reasonId, candidateSource: attribution.candidateSource } : {}) });
});

export const onSavedListingDeleted = onDocumentDeleted("users/{uid}/saved/{listingId}", async (event) => {
  const uid = event.params.uid;
  const listingId = event.params.listingId;
  const detail = await listingSignal(listingId, "UNSAVE_LISTING");
  await recordMarketplaceSignal(uid, detail?.signal ?? { type: "UNSAVE_LISTING", listingId }, `saved-delete|${event.id}`, { source: "saved", sellerId: detail?.sellerId });
});

export const onAuctionBidCreated = onDocumentCreated("listings/{listingId}/bids/{bidId}", async (event) => {
  const data = event.data?.data();
  if (!data || typeof data.bidderId !== "string") return;
  const detail = await listingSignal(event.params.listingId, "BID");
  if (!detail || detail.sellerId === data.bidderId) return;
  await recordMarketplaceSignal(data.bidderId, detail.signal, `bid|${event.params.bidId}`, { source: "bid", sellerId: detail.sellerId });
});

export const onConversationStarted = onDocumentCreated("conversations/{conversationId}", async (event) => {
  const data = event.data?.data();
  if (!data || typeof data.buyerId !== "string" || typeof data.listingId !== "string") return;
  const detail = await listingSignal(data.listingId, "MESSAGE_STARTED");
  if (!detail || detail.sellerId !== data.sellerId) return;
  await recordMarketplaceSignal(data.buyerId, detail.signal, `conversation|${event.params.conversationId}`, { source: "conversation", sellerId: detail.sellerId });
});

export const onConversationMessageCreated = onDocumentCreated("conversations/{conversationId}/messages/{messageId}", async (event) => {
  const data = event.data?.data();
  if (!data || typeof data.senderId !== "string") return;
  const conversation = (await getFirestore().collection("conversations").doc(event.params.conversationId).get()).data();
  // A seller's replies are not evidence of the seller's interest in their own listing.
  if (!conversation || data.senderId !== conversation.buyerId) return;
  const detail = await listingSignal(String(conversation.listingId), "MESSAGE_SENT");
  if (!detail) return;
  await recordMarketplaceSignal(data.senderId, detail.signal, `message|${event.params.messageId}`, { source: "message", sellerId: detail.sellerId });
});

/** Transaction completion is minted by the transaction callable, never by the browser. */
export const onCompletedTransactionInterest = onDocumentCreated("marketplaceEvents/{eventId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.eventType !== "TRANSACTION_COMPLETED" || data.source !== "transaction"
    || typeof data.transactionId !== "string" || typeof data.userId !== "string") return;
  const db = getFirestore();
  const transactionRef = db.collection("transactions").doc(data.transactionId);
  const ledgerRef = db.collection("intelligenceCompletions").doc(data.transactionId);
  const interestRef = db.collection("userInterests").doc(data.userId);
  await runGuardedTransaction(db, async (tx) => {
    if (!(await accountIsActive(data.userId, tx)) || !(await marketplaceAccountIsEligible(data.userId, tx))) return;
    const [transaction, ledger, interest] = await Promise.all([tx.get(transactionRef), tx.get(ledgerRef), tx.get(interestRef)]);
    const deal = transaction.data();
    if (ledger.exists || !deal || deal.status !== "completed" || deal.buyerId !== data.userId
      || deal.listingId !== data.listingId || deal.categoryId !== data.categoryId || !Number.isSafeInteger(deal.amountSen)) return;
    const now = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
    const profile = applyInterestSignal((interest.data() as InterestProfile | undefined) ?? null,
      { type: "TRANSACTION_COMPLETED", listingId: deal.listingId, categoryId: deal.categoryId, price: deal.amountSen / 100,
        listingType: deal.type === "auction" ? "auction" : "buy_now" }, now);
    tx.set(interestRef, { ...profile, userId: data.userId });
    tx.create(ledgerRef, { transactionId: data.transactionId, userId: data.userId, createdAt: Timestamp.fromDate(now) });
  });
});

export const getMarketplaceRecommendations = onCall(async (request) => {
  const db = getFirestore();
  const uid = request.auth?.uid;
  const now = new Date();
  const profileSnapshot = uid ? await db.collection("userInterests").doc(uid).get() : null;
  const profile = (profileSnapshot?.data() as InterestProfile | undefined) ?? null;
  const personalized = hasPersonalization(profile, now);
  const effectiveProfile = personalized ? profile : null;
  const savedIds = new Set<string>();
  if (uid) {
    const saved = await db.collection("users").doc(uid).collection("saved").orderBy("savedAt", "desc").limit(12).get();
    for (const entry of saved.docs) savedIds.add(entry.id);
  }
  const recent = await db.collection("listings").where("status", "==", "active").where("facetKeys", "array-contains", "*|*|*|*").orderBy("createdAt", "desc").limit(16).get();
  const sources = new Map<string, Candidate>();
  for (const item of recent.docs) if (isPublicListingSafe(item.data())) sources.set(item.id, { listing: publicListing(item.data(), item.id), source: "recent", trendScore: 0 });
  if (personalized && profile) {
    const categories = Object.entries(profile.category).filter(([, score]) => score > 1).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const pages = await Promise.all(categories.map(([categoryId]) => db.collection("listings").where("status", "==", "active").where("facetKeys", "array-contains", `${categoryId}|*|*|*`).orderBy("createdAt", "desc").limit(8).get()));
    for (const page of pages) for (const item of page.docs) if (isPublicListingSafe(item.data())) sources.set(item.id, { listing: publicListing(item.data(), item.id), source: "personalized", trendScore: 0 });
  }
  const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const trends = await db.collection("listingTrends").where("updatedAt", ">=", cutoff).orderBy("updatedAt", "desc").limit(12).get();
  const trendRefs = trends.docs.map((item) => db.collection("listings").doc(item.id));
  if (trendRefs.length) {
    const trendListings = await db.getAll(...trendRefs);
    for (let index = 0; index < trendListings.length; index += 1) {
      const listing = trendListings[index];
      const trend = trends.docs[index];
      if (!listing?.exists || !trend || !isPublicListingSafe(listing.data()!)) continue;
      const previous = sources.get(listing.id);
      const score = decayedTrend(Number(trend.data().score ?? 0), String(trend.data().updatedAt ?? nowIso()), now);
      sources.set(listing.id, { listing: previous?.listing ?? publicListing(listing.data()!, listing.id), source: previous?.source === "personalized" ? "personalized" : "trending", trendScore: score });
    }
  }
  const eligible = [...sources.values()].filter((candidate) => (!uid || candidate.listing.sellerId !== uid)
    && (!profile?.hiddenListings?.[candidate.listing.id] || now.getTime() - Date.parse(profile.hiddenListings[candidate.listing.id]!) >= 30 * 86_400_000));
  const ranked = rankCandidates(eligible, effectiveProfile, now, savedIds, 8);
  const sessionId = uid ? await createDiscoverySession(uid, ranked.map((candidate) => ({ id: candidate.listing.id, source: candidate.source, sectionId: "home", reasonId: personalized ? "for_you" : "cold_start" })), now) : null;
  return { version: RECOMMENDATION_VERSION, mode: personalized ? "personalized" : "discovery", sessionId, items: ranked.map((candidate) => ({ listing: candidate.listing, candidateSource: candidate.source })) };
});
