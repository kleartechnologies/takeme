import { getAuth } from "firebase-admin/auth";
import { AggregateField, getFirestore, Timestamp, type DocumentData, type Query } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { ADMIN_SECTIONS, adminRange, averageSen, ctr, tierDistribution, type AdminRange, type AdminSection } from "./admin-domain";

const db = getFirestore();
const CATEGORIES = ["electronics", "fashion", "home-living", "games", "toys-hobbies", "sports", "automotive", "books", "collectibles", "tools", "baby-kids", "tv-home-appliances", "health-nutrition", "others"];
const TIER_IDS = ["bronze", "silver", "gold", "platinum"];
type Card = { label: string; value: number | null; unit?: "money" | "percent" | "count"; scope: "current" | "period" | "lifetime"; note?: string };
type Breakdown = { label: string; count: number; amountSen?: number };
type Series = { label: string; points: { label: string; count: number; amountSen?: number }[] };
interface Metrics { section: AdminSection; range: { label: string; start: string | null; end: string }; cards: Card[]; breakdowns: { label: string; items: Breakdown[] }[]; series: Series[]; unavailable: string[]; note?: string }

function requireAdmin(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to access admin operations.");
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Administrator access is required.");
  return request.auth.uid;
}
function requiredId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid record ID.");
  return value;
}
function section(value: unknown): AdminSection {
  if (!ADMIN_SECTIONS.includes(value as AdminSection)) throw new HttpsError("invalid-argument", "Unknown admin section.");
  return value as AdminSection;
}
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : typeof value === "string" ? value : null;
const count = async (query: Query) => (await query.count().get()).data().count;
const sum = async (query: Query, field: string) => {
  const data = (await query.aggregate({ count: AggregateField.count(), value: AggregateField.sum(field) }).get()).data();
  return { count: data.count, value: Number(data.value ?? 0) };
};
function dated(query: Query, field: string, range: AdminRange): Query {
  return range.start ? query.where(field, ">=", Timestamp.fromDate(range.start)).where(field, "<", Timestamp.fromDate(range.end)) : query;
}
function activityDated(query: Query, range: AdminRange): Query {
  return range.start ? query.where("updatedAt", ">=", range.start.toISOString()) : query;
}
function base(sectionName: AdminSection, range: AdminRange): Metrics {
  return { section: sectionName, range: { label: range.label, start: range.start?.toISOString() ?? null, end: range.end.toISOString() }, cards: [], breakdowns: [], series: [], unavailable: [] };
}
function card(label: string, value: number | null, scope: Card["scope"], unit: Card["unit"] = "count", note?: string): Card { return { label, value, scope, unit, note }; }

async function timeSeries(query: Query, field: string, range: AdminRange, amountField?: string): Promise<Series> {
  if (!range.start) return { label: "All-time trend", points: [] };
  const start = range.start.getTime();
  const end = range.end.getTime();
  const steps = Math.min(8, Math.max(1, Math.ceil((end - start) / 86_400_000)));
  const points = await Promise.all(Array.from({ length: steps }, async (_, index) => {
    const from = new Date(start + Math.floor((end - start) * index / steps));
    const to = new Date(start + Math.floor((end - start) * (index + 1) / steps));
    const slice = query.where(field, ">=", Timestamp.fromDate(from)).where(field, "<", Timestamp.fromDate(to));
    const result = amountField ? await sum(slice, amountField) : { count: await count(slice), value: 0 };
    return { label: from.toISOString().slice(0, 10), count: result.count, ...(amountField ? { amountSen: result.value } : {}) };
  }));
  return { label: "Selected-period activity", points };
}

async function userMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("users", range);
  const users = db.collection("users");
  const summaries = db.collection("trustSummaries");
  const historicalCustom = range.preset === "custom" && range.end.getTime() < Date.now() - 60_000;
  const [total, fresh, active, buyers, sellers, both, buyerTiers, sellerTiers] = await Promise.all([
    count(users), count(dated(users, "createdAt", range)), historicalCustom ? Promise.resolve(null) : count(activityDated(db.collection("userInterests"), range)),
    count(summaries.where("buyer.completedCount", ">", 0)), count(summaries.where("seller.completedCount", ">", 0)),
    count(summaries.where("buyer.completedCount", ">", 0).where("seller.completedCount", ">", 0)),
    Promise.all(TIER_IDS.map((tier) => count(summaries.where("buyer.tier", "==", tier)))),
    Promise.all(TIER_IDS.map((tier) => count(summaries.where("seller.tier", "==", tier)))),
  ]);
  result.cards = [card("Registered users", total, "current"), card("New users", fresh, "period"), card("Active users", active, range.start ? "period" : "lifetime", "count", "Users whose interest profile was updated by an accepted marketplace event."), card("Completed buyers", buyers, "current"), card("Completed sellers", sellers, "current"), card("Both roles", both, "current")];
  result.breakdowns = [
    { label: "Buyer tiers · current snapshot", items: TIER_IDS.map((tier, index) => ({ label: tier, count: buyerTiers[index] ?? 0 })) },
    { label: "Seller tiers · current snapshot", items: TIER_IDS.map((tier, index) => ({ label: tier, count: sellerTiers[index] ?? 0 })) },
  ];
  result.series = [await timeSeries(users, "createdAt", range)];
  result.unavailable.push("Historical distinct active users are not reconstructed from overwritten interest profiles.");
  return result;
}

async function listingMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("listings", range);
  const listings = db.collection("listings");
  const [total, active, sold, removed, auctions, fixed, withBids, fresh, categories] = await Promise.all([
    count(listings), count(listings.where("status", "==", "active")), count(listings.where("status", "==", "sold")), count(listings.where("status", "==", "removed")),
    count(listings.where("listingType", "==", "auction")), count(listings.where("listingType", "==", "buy_now")), count(listings.where("bidCount", ">", 0)),
    count(dated(listings, "createdAt", range)), Promise.all(CATEGORIES.map((category) => count(dated(listings.where("categoryId", "==", category), "createdAt", range)))),
  ]);
  result.cards = [card("All listings", total, "current"), card("New listings", fresh, "period"), card("Active listings", active, "current"), card("Sold listings", sold, "current"), card("Removed listings", removed, "current"), card("Auctions", auctions, "current"), card("Buy Now", fixed, "current"), card("Listings with bids", withBids, "current")];
  result.breakdowns = [{ label: "Listings by category · selected period", items: CATEGORIES.map((category, index) => ({ label: category, count: categories[index] ?? 0 })).sort((a, b) => b.count - a.count) }];
  result.series = [await timeSeries(listings, "createdAt", range)];
  result.unavailable.push("Distinct listings with offers need a server-owned per-listing counter; raw offers are not scanned.");
  return result;
}

async function transactionMetrics(range: AdminRange, revenue = false): Promise<Metrics> {
  const result = base(revenue ? "revenue" : "transactions", range);
  const collection = db.collection("transactions");
  const completedQuery = dated(collection.where("status", "==", "completed"), "completedAt", range);
  const [all, created, completed, inProgress, cancelled, disputed, category, types] = await Promise.all([
    count(collection), count(dated(collection, "createdAt", range)), sum(completedQuery, "amountSen"),
    count(collection.where("status", "==", "in_progress")), count(collection.where("status", "==", "cancelled")), count(collection.where("status", "==", "disputed")),
    Promise.all(CATEGORIES.map((item) => sum(dated(collection.where("status", "==", "completed").where("categoryId", "==", item), "completedAt", range), "amountSen"))),
    Promise.all(["buy_now", "offer", "auction"].map((item) => sum(dated(collection.where("status", "==", "completed").where("type", "==", item), "completedAt", range), "amountSen"))),
  ]);
  result.cards = [card("All agreed transactions", all, "current"), card("New agreements", created, "period"), card("Completed transactions", completed.count, "period"),
    card("GMV", completed.value, "period", "money", "Completed transactions only; distinct from promotion revenue."), card("Average completed value", averageSen(completed.value, completed.count), "period", "money"),
    card("In progress", inProgress, "current"), card("Cancelled", cancelled, "current"), card("Disputed", disputed, "current")];
  result.breakdowns = [
    { label: "Completed value by category · selected period", items: CATEGORIES.map((label, index) => ({ label, count: category[index]?.count ?? 0, amountSen: category[index]?.value ?? 0 })).sort((a, b) => (b.amountSen ?? 0) - (a.amountSen ?? 0)) },
    { label: "Completed value by agreement type · selected period", items: ["Buy Now", "Offer", "Auction"].map((label, index) => ({ label, count: types[index]?.count ?? 0, amountSen: types[index]?.value ?? 0 })) },
  ];
  result.series = [await timeSeries(collection.where("status", "==", "completed"), "completedAt", range, "amountSen")];
  result.unavailable.push("Location breakdown is unavailable: transactions do not snapshot a verified exchange location.", "Completion rate by agreement cohort is unavailable without cohort tracking; a cross-period ratio would be misleading.");
  return result;
}

async function promotionMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("promotions", range);
  const promotions = db.collection("promotions");
  const [boostRequests, featuredRequests, activeBoost, activeFeatured, boostEngagement, featuredEngagement] = await Promise.all([
    count(dated(promotions.where("type", "==", "boost"), "createdAt", range)), count(dated(promotions.where("type", "==", "featured"), "createdAt", range)),
    count(promotions.where("type", "==", "boost").where("status", "==", "active").where("paymentStatus", "==", "paid")),
    count(promotions.where("type", "==", "featured").where("status", "==", "active").where("paymentStatus", "==", "paid")),
    Promise.all(["impressions", "clicks"].map((field) => sum(promotions.where("type", "==", "boost"), field))),
    Promise.all(["impressions", "clicks"].map((field) => sum(promotions.where("type", "==", "featured"), field))),
  ]);
  const boostImpressions = boostEngagement[0]?.value ?? 0; const boostClicks = boostEngagement[1]?.value ?? 0;
  const featuredImpressions = featuredEngagement[0]?.value ?? 0; const featuredClicks = featuredEngagement[1]?.value ?? 0;
  result.cards = [card("Boost requests", boostRequests, "period"), card("Featured requests", featuredRequests, "period"), card("Active Boost", activeBoost, "current"), card("Active Featured", activeFeatured, "current"),
    card("Boost impressions", boostImpressions, "lifetime"), card("Boost clicks", boostClicks, "lifetime"), card("Boost CTR", ctr(boostClicks, boostImpressions), "lifetime", "percent"),
    card("Featured impressions", featuredImpressions, "lifetime"), card("Featured clicks", featuredClicks, "lifetime"), card("Featured CTR", ctr(featuredClicks, featuredImpressions), "lifetime", "percent"),
    card("Boost purchases", null, "period"), card("Boost revenue", null, "period", "money"), card("Featured purchases", null, "period"), card("Featured revenue", null, "period", "money")];
  result.unavailable.push("Purchases and promotion revenue require a verified payment integration; pending requests are not sales.", "Historical promotion revenue charts cannot be produced without a verified payment timestamp.");
  return result;
}

async function intelligenceMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("intelligence", range);
  const events = db.collection("marketplaceEvents");
  const types = ["VIEW_LISTING", "AUCTION_VIEW", "SEARCH", "CATEGORY_VIEW", "SAVE_LISTING", "BID", "MESSAGE_STARTED", "MESSAGE_SENT", "SHARE_LISTING", "SELLER_VIEW", "PROFILE_VIEW", "RECOMMENDATION_IMPRESSION", "RECOMMENDATION_CLICK", "NOT_INTERESTED"];
  const [counts, categories] = await Promise.all([
    Promise.all(types.map((type) => count(dated(events.where("eventType", "==", type), "createdAt", range)))),
    Promise.all(CATEGORIES.map((category) => count(dated(events.where("eventType", "==", "CATEGORY_VIEW").where("categoryId", "==", category), "createdAt", range)))),
  ]);
  result.cards = types.map((type, index) => card(type.replaceAll("_", " ").toLowerCase(), counts[index] ?? 0, "period"));
  result.breakdowns = [{ label: "Recorded event types · selected period", items: types.map((label, index) => ({ label, count: counts[index] ?? 0 })).sort((a, b) => b.count - a.count) },
    { label: "Category views · selected period", items: CATEGORIES.map((label, index) => ({ label, count: categories[index] ?? 0 })).sort((a, b) => b.count - a.count) }];
  result.unavailable.push("Recommendation CTR is unavailable: impressions are recorded in batches of up to eight listings, while clicks are per listing.", "Top searches, exact top viewed/saved listings and post-recommendation conversion require server-owned group aggregates.", "Raw events have a 90-day TTL policy; older activity is not an all-time total.");
  return result;
}

async function reviewMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("reviews", range);
  const reviews = db.collection("publicReviews");
  const period = dated(reviews, "publishedAt", range);
  const [all, selected, stars, roleCounts, tiers] = await Promise.all([
    count(reviews), sum(period, "rating"), Promise.all([5, 4, 3, 2, 1].map((rating) => count(dated(reviews.where("rating", "==", rating), "publishedAt", range)))),
    Promise.all(["buyer", "seller"].map((role) => sum(dated(reviews.where("reviewerRole", "==", role), "publishedAt", range), "rating"))),
    Promise.all(["buyer", "seller"].map((role) => Promise.all(TIER_IDS.map((tier) => count(db.collection("trustSummaries").where(`${role}.tier`, "==", tier)))))),
  ]);
  result.cards = [card("Published reviews", all, "current"), card("Reviews published", selected.count, "period"), card("Average rating", selected.count ? Math.round(selected.value / selected.count * 10) / 10 : null, "period"),
    card("Buyer-to-seller average", roleCounts[0]?.count ? Math.round((roleCounts[0]?.value ?? 0) / roleCounts[0]!.count * 10) / 10 : null, "period"),
    card("Seller-to-buyer average", roleCounts[1]?.count ? Math.round((roleCounts[1]?.value ?? 0) / roleCounts[1]!.count * 10) / 10 : null, "period")];
  result.breakdowns = [{ label: "Rating distribution · selected period", items: [5, 4, 3, 2, 1].map((rating, index) => ({ label: `${rating} stars`, count: stars[index] ?? 0 })) },
    ...(["buyer", "seller"] as const).map((role, index) => ({ label: `${role} tiers · current snapshot`, items: Object.entries(tierDistribution(Object.fromEntries(TIER_IDS.map((tier, tierIndex) => [tier, tiers[index]?.[tierIndex] ?? 0])))).map(([label, count]) => ({ label, count })) }))];
  result.series = [await timeSeries(reviews, "publishedAt", range)];
  result.unavailable.push("Top review tags require a bounded server-owned group aggregate; private unreleased reviews are never included.");
  return result;
}

async function reportMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("reports", range);
  const reports = db.collection("reports");
  const [all, fresh, submitted, reviewing, resolved, dismissed, disputes] = await Promise.all([
    count(reports), count(dated(reports, "createdAt", range)), ...["submitted", "reviewing", "resolved", "dismissed"].map((status) => count(reports.where("status", "==", status))),
    count(db.collection("transactions").where("status", "==", "disputed")),
  ]);
  result.cards = [card("All reports", all, "current"), card("New reports", fresh, "period"), card("Open reports", (submitted ?? 0) + (reviewing ?? 0), "current"), card("Submitted", submitted ?? 0, "current"), card("Reviewing", reviewing ?? 0, "current"), card("Resolved", resolved ?? 0, "current"), card("Dismissed", dismissed ?? 0, "current"), card("Unresolved disputes", disputes ?? 0, "current")];
  result.unavailable.push("Moderation actions and automated dispute resolution are not implemented; this dashboard is read-only.");
  return result;
}

async function overviewMetrics(range: AdminRange): Promise<Metrics> {
  const result = base("overview", range);
  const historicalCustom = range.preset === "custom" && range.end.getTime() < Date.now() - 60_000;
  const completedQuery = dated(db.collection("transactions").where("status", "==", "completed"), "completedAt", range);
  const [users, newUsers, activeUsers, activeListings, newListings, completed, pending, buyers, sellers, both, reviews, disputes] = await Promise.all([
    count(db.collection("users")), count(dated(db.collection("users"), "createdAt", range)),
    historicalCustom ? Promise.resolve(null) : count(activityDated(db.collection("userInterests"), range)),
    count(db.collection("listings").where("status", "==", "active")), count(dated(db.collection("listings"), "createdAt", range)),
    sum(completedQuery, "amountSen"), count(db.collection("transactions").where("status", "==", "in_progress")),
    count(db.collection("trustSummaries").where("buyer.completedCount", ">", 0)), count(db.collection("trustSummaries").where("seller.completedCount", ">", 0)),
    count(db.collection("trustSummaries").where("buyer.completedCount", ">", 0).where("seller.completedCount", ">", 0)),
    sum(dated(db.collection("publicReviews"), "publishedAt", range), "rating"), count(db.collection("transactions").where("status", "==", "disputed")),
  ]);
  result.cards = [card("Registered users", users, "current"), card("New users", newUsers, "period"), card("Active users", activeUsers, "period"),
    card("Active listings", activeListings, "current"), card("New listings", newListings, "period"), card("Completed transactions", completed.count, "period"), card("In progress", pending, "current"),
    card("Completed buyers", buyers, "current"), card("Completed sellers", sellers, "current"), card("Both roles", both, "current"),
    card("Published reviews", reviews.count, "period"), card("Average rating", reviews.count ? Math.round(reviews.value / reviews.count * 10) / 10 : null, "period"),
    card("GMV", completed.value, "period", "money"), card("Average completed value", averageSen(completed.value, completed.count), "period", "money"),
    card("Boost revenue", null, "period", "money"), card("Featured revenue", null, "period", "money"), card("Unresolved disputes", disputes, "current")];
  result.unavailable = ["Promotion revenue is unavailable until verified payments exist.", "Active users reflect accepted marketplace activity, not app-open telemetry."];
  return result;
}

export const getAdminMetrics = onCall(async (request) => {
  requireAdmin(request);
  const selected = section(request.data?.section);
  let range: AdminRange;
  try { range = adminRange(request.data ?? {}); } catch (error) { throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Invalid date range."); }
  if (selected === "users") return userMetrics(range);
  if (selected === "listings") return listingMetrics(range);
  if (selected === "transactions" || selected === "revenue") return transactionMetrics(range, selected === "revenue");
  if (selected === "intelligence") return intelligenceMetrics(range);
  if (selected === "promotions") return promotionMetrics(range);
  if (selected === "reviews") return reviewMetrics(range);
  if (selected === "reports") return reportMetrics(range);
  if (selected === "settings") { const result = base(selected, range); result.unavailable = ["Admin settings are read-only until an audited configuration workflow exists."]; return result; }
  return overviewMetrics(range);
});

const PAGE_COLLECTIONS = { users: "users", listings: "listings", transactions: "transactions", promotions: "promotions", reviews: "publicReviews", reports: "reports" } as const;
type PageSection = keyof typeof PAGE_COLLECTIONS;
function pageSection(value: unknown): PageSection {
  if (!(typeof value === "string" && value in PAGE_COLLECTIONS)) throw new HttpsError("invalid-argument", "Unsupported admin list.");
  return value as PageSection;
}
function publicRow(sectionName: PageSection, id: string, data: DocumentData) {
  const common = { id, createdAt: iso(data.createdAt) };
  if (sectionName === "users") return { ...common, displayName: data.displayName ?? "TAKEME member", location: data.location ?? "" };
  if (sectionName === "listings") return { ...common, title: data.title, categoryId: data.categoryId, sellerId: data.sellerId, listingType: data.listingType, status: data.status, price: data.price };
  if (sectionName === "transactions") return { ...common, listingTitle: data.listingTitle, buyerId: data.buyerId, sellerId: data.sellerId, status: data.status, type: data.type, amountSen: data.amountSen, completedAt: iso(data.completedAt) };
  if (sectionName === "promotions") return { ...common, listingId: data.listingId, type: data.type, status: data.status, paymentStatus: data.paymentStatus, impressions: data.impressions ?? 0, clicks: data.clicks ?? 0 };
  if (sectionName === "reviews") return { ...common, reviewedUserId: data.reviewedUserId, reviewerRole: data.reviewerRole, rating: data.rating, tags: data.tags ?? [], publishedAt: iso(data.publishedAt) };
  return { ...common, targetType: data.targetType, targetId: data.targetId, reason: data.reason, status: data.status, reporterId: data.reporterId };
}

export const getAdminPage = onCall(async (request) => {
  requireAdmin(request);
  const selected = pageSection(request.data?.section);
  const cursor = request.data?.cursor ? requiredId(request.data.cursor) : null;
  const status = request.data?.status;
  if (status !== undefined && (selected !== "reports" || !["submitted", "reviewing", "resolved", "dismissed"].includes(status))) throw new HttpsError("invalid-argument", "Invalid report filter.");
  const collection = db.collection(PAGE_COLLECTIONS[selected]);
  let query: Query = status ? collection.where("status", "==", status) : collection;
  query = query.orderBy("createdAt", "desc").limit(21);
  if (cursor) {
    const anchor = await collection.doc(cursor).get();
    if (!anchor.exists) throw new HttpsError("invalid-argument", "Page cursor expired. Refresh this list.");
    query = query.startAfter(anchor);
  }
  const page = await query.get();
  return { rows: page.docs.slice(0, 20).map((item) => publicRow(selected, item.id, item.data())), nextCursor: page.docs.length > 20 ? page.docs[19]?.id ?? null : null };
});

export const getAdminRecord = onCall(async (request) => {
  requireAdmin(request);
  const selected = pageSection(request.data?.section);
  const recordId = requiredId(request.data?.id);
  const ref = db.collection(PAGE_COLLECTIONS[selected]).doc(recordId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Record not found.");
  const data = snapshot.data()!;
  const row = publicRow(selected, recordId, data);
  if (selected === "users") {
    const authUser = await getAuth().getUser(recordId).catch(() => null);
    const [listings, buying, selling, summary, reviews, reports] = await Promise.all([
      count(db.collection("listings").where("sellerId", "==", recordId)),
      sum(db.collection("transactions").where("buyerId", "==", recordId).where("status", "==", "completed"), "amountSen"),
      sum(db.collection("transactions").where("sellerId", "==", recordId).where("status", "==", "completed"), "amountSen"),
      db.collection("trustSummaries").doc(recordId).get(),
      count(db.collection("publicReviews").where("reviewedUserId", "==", recordId)),
      count(db.collection("reports").where("targetType", "==", "user").where("targetId", "==", recordId)),
    ]);
    return { row, detail: { email: authUser?.email ?? null, listings, completedPurchases: buying.count, completedSales: selling.count, completedBuyerValueSen: buying.value, completedSellerValueSen: selling.value, buyerTier: summary.data()?.buyer?.tier ?? null, sellerTier: summary.data()?.seller?.tier ?? null, reviews, reports } };
  }
  if (selected === "listings") {
    const [views, saves, bids, offers, promotions, reports] = await Promise.all([
      count(db.collection("marketplaceEvents").where("listingId", "==", recordId).where("eventType", "==", "VIEW_LISTING")),
      count(db.collection("marketplaceEvents").where("listingId", "==", recordId).where("eventType", "==", "SAVE_LISTING")),
      count(ref.collection("bids")), count(db.collection("offers").where("listingId", "==", recordId)),
      db.collection("promotions").where("listingId", "==", recordId).orderBy("createdAt", "desc").limit(5).get(),
      count(db.collection("reports").where("targetType", "==", "listing").where("targetId", "==", recordId)),
    ]);
    return { row, detail: { views, saves, bids, offers, reports, promotions: promotions.docs.map((item) => publicRow("promotions", item.id, item.data())) } };
  }
  if (selected === "transactions") {
    const [buyerReview, sellerReview] = await Promise.all([ref.collection("reviews").doc(data.buyerId).get(), ref.collection("reviews").doc(data.sellerId).get()]);
    return { row, detail: { listingId: data.listingId, categoryId: data.categoryId, paymentMethod: data.paymentMethod, buyerConfirmedAt: iso(data.buyerConfirmedAt), sellerConfirmedAt: iso(data.sellerConfirmedAt), completedAt: iso(data.completedAt), cancelledAt: iso(data.cancelledAt), cancellationReason: data.cancellationReason ?? null, disputeReason: data.disputeReason ?? null, reviewWindowEndAt: iso(data.reviewWindowEndAt), reviewsVisibleAt: iso(data.reviewsVisibleAt), buyerReviewed: buyerReview.exists, sellerReviewed: sellerReview.exists } };
  }
  if (selected === "reports") return { row, detail: { details: data.details ?? "", updatedAt: iso(data.updatedAt), moderationActionAvailable: false } };
  if (selected === "promotions") return { row, detail: { packageId: data.packageId, priceSen: data.priceSen, currency: data.currency, startAt: iso(data.startAt), endAt: iso(data.endAt), refundReviewRequired: data.refundReviewRequired ?? false } };
  return { row, detail: { tags: data.tags ?? [], comment: data.comment ?? "", publishedAt: iso(data.publishedAt) } };
});
