const assert = require("node:assert/strict");
const test = require("node:test");
const { DEFAULT_PROMOTION_PACKAGES, PROMOTION_PAYMENT_GATEWAY, validPackage, listingPromotionEligible, effectivePromotionStatus, canServePromotion, matchesPlacementContext, allocatePromotionPlacements } = require("../lib/promotion-domain.js");
const { rankCandidates } = require("../lib/intelligence-domain.js");

const now = new Date("2026-09-20T00:00:00.000Z");
const item = (id, sellerId = id, categoryId = "electronics") => ({ id, sellerId, categoryId, title: "Vintage camera", status: "active", listingType: "buy_now", searchTokens: ["camera", "vintage"] });
const promotion = (listing, type = "boost", changes = {}) => ({ id: `promotion-${listing.id}`, listingId: listing.id, sellerId: listing.sellerId, type, packageId: "test", status: "active", paymentStatus: "paid", startAt: "2026-09-19T00:00:00.000Z", endAt: "2026-09-21T00:00:00.000Z", ...changes });

test("packages have centralized, valid example prices", () => {
  assert.equal(DEFAULT_PROMOTION_PACKAGES.length, 3);
  assert.equal(PROMOTION_PAYMENT_GATEWAY.available, false);
  assert.ok(DEFAULT_PROMOTION_PACKAGES.every(validPackage));
  assert.equal(validPackage({ ...DEFAULT_PROMOTION_PACKAGES[0], priceSen: -1 }), false);
});

test("eligibility rejects inactive and ended auctions", () => {
  assert.equal(listingPromotionEligible(item("a"), now), true);
  assert.equal(listingPromotionEligible({ ...item("a"), status: "removed" }, now), false);
  assert.equal(listingPromotionEligible({ ...item("a"), listingType: "auction", auctionStatus: "active", auctionEndAt: "2026-09-21T00:00:00.000Z" }, now), true);
  assert.equal(listingPromotionEligible({ ...item("a"), listingType: "auction", auctionStatus: "ended", auctionEndAt: "2026-09-19T00:00:00.000Z" }, now), false);
});

test("unpaid requests never serve, and elapsed promotions expire", () => {
  const listing = item("a");
  assert.equal(canServePromotion(promotion(listing, "boost", { paymentStatus: "not_configured" }), listing, now), false);
  assert.equal(canServePromotion(promotion(listing, "boost", { status: "pending_payment" }), listing, now), false);
  assert.equal(canServePromotion(promotion(listing), listing, now), true);
  assert.equal(effectivePromotionStatus(promotion(listing, "boost", { endAt: "2026-09-19T00:00:00.000Z" }), now), "expired");
});

test("placement stays in relevant candidate set and caps seller exposure", () => {
  const candidates = [item("one", "seller-a"), item("two", "seller-b"), item("three", "seller-c"), item("four", "seller-d"), item("five", "seller-a"), item("six", "seller-f"), item("seven", "seller-g"), item("eight", "seller-h")];
  const paid = [promotion(candidates[7], "boost"), promotion(candidates[4], "featured"), promotion(candidates[0], "boost")];
  const allocated = allocatePromotionPlacements(candidates, paid, now);
  assert.equal(allocated.orderIds.length, candidates.length);
  assert.equal(new Set(allocated.orderIds).size, candidates.length);
  assert.equal(Object.keys(allocated.badges).length, 2);
  assert.ok(allocated.badges.five);
  assert.equal(Boolean(allocated.badges.one), false);
  assert.equal(matchesPlacementContext(item("phone", "seller", "electronics"), "electronics", "camera"), true);
  assert.equal(matchesPlacementContext(item("washer", "seller", "appliances"), "electronics", "camera"), false);
  assert.equal(matchesPlacementContext({ ...item("washer"), searchTokens: ["washer"] }, "", "camera"), false);
});

test("paid allocation never mutates the organic ranking formula", () => {
  const candidates = [item("a"), item("b"), item("c"), item("d")];
  const organic = candidates.map((listing) => ({ listing: { ...listing, description: "A complete camera with accessories and case.", price: 250, location: "Kuala Lumpur", condition: "Good", imageUrls: ["image"], createdAt: "2026-09-19T00:00:00.000Z" }, source: "recent", trendScore: 0 }));
  const baseline = rankCandidates(organic, null, now, new Set()).map((entry) => [entry.listing.id, entry.score]);
  allocatePromotionPlacements(candidates, [promotion(candidates[3])], now);
  const after = rankCandidates(organic, null, now, new Set()).map((entry) => [entry.listing.id, entry.score]);
  assert.deepEqual(after, baseline);
});
