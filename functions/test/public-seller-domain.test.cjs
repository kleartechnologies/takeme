const assert = require("node:assert/strict");
const test = require("node:test");
const { PUBLIC_SELLER_BATCH_LIMIT, publicSellerIds, publicSellerSummary } = require("../lib/public-seller-domain.js");

test("public seller projection exposes only seller-safe fields", () => {
  const projection = publicSellerSummary("seller-1", { displayName: "  Aminah  ", photoURL: "https://example.test/a.jpg", email: "private@example.test" }, {
    verificationStatus: "verified",
    seller: { completedCount: 18, reviewCount: 4, averageRating: 4.75, tier: "silver", lifetimeValueSen: 999999 },
    buyer: { completedCount: 80, reviewCount: 20, averageRating: 5, tier: "platinum" },
    internalRiskScore: 99,
  });
  assert.deepEqual(projection, { uid: "seller-1", displayName: "Aminah", photoURL: "https://example.test/a.jpg", sellerRating: 4.75, sellerReviewCount: 4, sellerCompletedTransactionCount: 18, sellerTier: "silver", verificationStatus: "verified" });
  assert.equal(JSON.stringify(projection).includes("999999"), false);
  assert.equal(JSON.stringify(projection).includes("buyer"), false);
  assert.equal(JSON.stringify(projection).includes("risk"), false);
});

test("new sellers have a neutral, non-fabricated projection", () => {
  assert.deepEqual(publicSellerSummary("seller-2", { displayName: "New seller", photoURL: null }, undefined), {
    uid: "seller-2", displayName: "New seller", photoURL: null, sellerRating: null, sellerReviewCount: 0,
    sellerCompletedTransactionCount: 0, sellerTier: null, verificationStatus: "unverified",
  });
});

test("promotion fields never affect seller trust", () => {
  const profile = { displayName: "Seller", photoURL: null };
  const trust = { seller: { completedCount: 5, reviewCount: 1, averageRating: 5, tier: "bronze" } };
  assert.deepEqual(publicSellerSummary("seller-3", profile, { ...trust, promotion: { status: "active", priceSen: 9000 } }), publicSellerSummary("seller-3", profile, trust));
});

test("seller batches are unique, validated and capped at forty", () => {
  assert.equal(PUBLIC_SELLER_BATCH_LIMIT, 40);
  assert.deepEqual(publicSellerIds(["a", "b", "a"]), ["a", "b"]);
  assert.equal(publicSellerIds(Array.from({ length: 40 }, (_, index) => `seller-${index}`)).length, 40);
  assert.throws(() => publicSellerIds(Array.from({ length: 41 }, (_, index) => `seller-${index}`)), /up to 40/);
  assert.throws(() => publicSellerIds(["not/a/uid"]), /invalid/);
});
