const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyInterestSignal, decayedTrend, emptyInterest, hasPersonalization, rankCandidates, scoreCandidate, similarityScore,
} = require("../lib/intelligence-domain.js");

const now = new Date("2026-09-20T00:00:00.000Z");
const listing = (id, changes = {}) => ({ id, sellerId: "seller", title: "Vintage camera kit", description: "A complete working camera with accessories and case.", categoryId: "electronics", price: 250, location: "Kuala Lumpur", listingType: "buy_now", condition: "Good", imageUrls: ["image"], status: "active", createdAt: "2026-09-19T00:00:00.000Z", ...changes });
const candidate = (item, source = "recent", trendScore = 0) => ({ listing: item, source, trendScore });

test("interest signals accumulate with bounded positive scores and time decay", () => {
  let profile = emptyInterest(now);
  profile = applyInterestSignal(profile, { type: "CATEGORY_VIEW", categoryId: "electronics" }, now);
  profile = applyInterestSignal(profile, { type: "SEARCH", query: "Vintage Camera" }, now);
  profile = applyInterestSignal(profile, { type: "SAVE_LISTING", categoryId: "electronics", price: 250, listingType: "buy_now", condition: "Good", location: "Kuala Lumpur" }, now);
  assert.equal(profile.category.electronics, 7);
  assert.equal(profile.priceBand["100_299"], 6);
  assert.deepEqual(profile.recentQueries, ["vintage camera"]);
  assert.equal(hasPersonalization(profile, now), true);
  const after = applyInterestSignal(profile, { type: "CATEGORY_VIEW", categoryId: "fashion" }, new Date(now.getTime() + 30 * 86_400_000));
  assert.ok(after.category.electronics <= 3.51 && after.category.electronics >= 3.49);
  assert.equal(after.category.fashion, 1);
});

test("negative and repeated-exposure signals are gradual and bounded", () => {
  let profile = emptyInterest(now);
  profile = applyInterestSignal(profile, { type: "SAVE_LISTING", categoryId: "electronics" }, now);
  profile = applyInterestSignal(profile, { type: "NOT_INTERESTED", listingId: "a", categoryId: "electronics" }, now);
  assert.equal(profile.category.electronics, 6, "listing dismissal must not poison its category");
  assert.equal(scoreCandidate(candidate(listing("a")), profile, now, new Set()), null);
  assert.ok(scoreCandidate(candidate(listing("b")), profile, now, new Set()));
  profile = applyInterestSignal(profile, { type: "INTEREST_RESTORED", listingId: "a" }, now);
  assert.ok(scoreCandidate(candidate(listing("a")), profile, now, new Set()));
  for (let index = 0; index < 10; index += 1) profile = applyInterestSignal(profile, { type: "RECOMMENDATION_IMPRESSION", exposedListingIds: ["a"] }, now);
  assert.equal(profile.exposureCount.a, 5);
  const result = scoreCandidate(candidate(listing("a")), profile, now, new Set());
  assert.equal(result.components.repetition, 10);
  profile = applyInterestSignal(profile, { type: "RECOMMENDATION_CLICK", listingId: "a" }, now);
  assert.equal(profile.exposureCount.a, undefined);
});

test("ranking is deterministic, bounded, relevant, fresh, diverse and excludes inactive items", () => {
  let profile = emptyInterest(now);
  profile = applyInterestSignal(profile, { type: "SAVE_LISTING", categoryId: "electronics", price: 250, location: "Kuala Lumpur", listingType: "buy_now", condition: "Good" }, now);
  const preferred = scoreCandidate(candidate(listing("preferred")), profile, now, new Set());
  const unrelated = scoreCandidate(candidate(listing("unrelated", { categoryId: "fashion", price: 2000, location: "Penang", createdAt: "2025-01-01T00:00:00.000Z" })), profile, now, new Set());
  assert.ok(preferred.score > unrelated.score);
  assert.ok(Object.values(preferred.components).every((value) => Number.isFinite(value) && Math.abs(value) <= 18));
  assert.equal(scoreCandidate(candidate(listing("inactive", { status: "removed" })), profile, now, new Set()), null);
  assert.ok(scoreCandidate(candidate(listing("preferred")), profile, now, new Set(["preferred"])).score < preferred.score);
  const inventory = [candidate(listing("a")), candidate(listing("b")), candidate(listing("c")), candidate(listing("d", { categoryId: "fashion" }))];
  const ranked = rankCandidates(inventory, profile, now, new Set(), 4);
  assert.equal(ranked.length, 4);
  assert.ok(ranked.findIndex((item) => item.listing.categoryId === "fashion") <= 2);
  assert.deepEqual(rankCandidates(inventory, profile, now, new Set(), 4).map((item) => item.listing.id), ranked.map((item) => item.listing.id));
  const sellerInventory = [candidate(listing("s1")), candidate(listing("s2")), candidate(listing("s3")), candidate(listing("other", { sellerId: "another", categoryId: "fashion" }))];
  assert.ok(rankCandidates(sellerInventory, profile, now, new Set(), 4).findIndex((item) => item.listing.id === "other") <= 2);
  assert.equal(rankCandidates(sellerInventory, profile, now, new Set(), 4).length, 4);
});

test("cold start favors fresh quality and recent trends decay", () => {
  assert.equal(hasPersonalization(emptyInterest(now)), false);
  const fresh = scoreCandidate(candidate(listing("fresh")), null, now, new Set());
  const stale = scoreCandidate(candidate(listing("stale", { createdAt: "2025-01-01T00:00:00.000Z" })), null, now, new Set());
  assert.ok(fresh.score > stale.score);
  assert.ok(decayedTrend(20, new Date(now.getTime() - 86_400_000).toISOString(), now) > decayedTrend(20, new Date(now.getTime() - 30 * 86_400_000).toISOString(), now));
  assert.ok(decayedTrend(20, new Date(now.getTime() - 30 * 86_400_000).toISOString(), now) < 2);
});

test("similarity uses category, price and title while excluding current listing", () => {
  const reference = listing("camera");
  assert.equal(similarityScore(reference, reference), Number.NEGATIVE_INFINITY);
  assert.equal(similarityScore(reference, listing("same-seller")), Number.NEGATIVE_INFINITY);
  const close = similarityScore(reference, listing("close", { sellerId: "another", title: "Vintage camera lens", price: 270 }));
  const distant = similarityScore(reference, listing("distant", { sellerId: "another", title: "Running shoes", categoryId: "fashion", price: 2500 }));
  assert.ok(close > distant);
  assert.equal(similarityScore(reference, listing("removed", { status: "removed" })), Number.NEGATIVE_INFINITY);
});

test("recent views are bounded and only live auctions rank", () => {
  let profile = emptyInterest(now);
  for (let index = 0; index < 20; index += 1) profile = applyInterestSignal(profile, { type: "VIEW_LISTING", listingId: `item-${index}` }, now);
  assert.equal(profile.recentlyViewed.length, 12);
  assert.equal(profile.recentlyViewed[0], "item-19");
  const auction = { listingType: "auction", auctionStatus: "active", auctionEndAt: "2026-09-21T00:00:00.000Z" };
  assert.ok(scoreCandidate(candidate(listing("live", { ...auction, sellerId: "other" })), profile, now, new Set()));
  assert.equal(scoreCandidate(candidate(listing("ended", { ...auction, auctionEndAt: "2026-09-19T00:00:00.000Z" })), profile, now, new Set()), null);
});
