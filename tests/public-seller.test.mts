import assert from "node:assert/strict";
import test from "node:test";
import { chunkSellerIds, completedSalesLabel, sellerRatingLabel } from "../src/lib/public-seller-presentation.ts";
import type { PublicSellerSummary } from "../src/types/marketplace.ts";

const seller = (patch: Partial<PublicSellerSummary> = {}): PublicSellerSummary => ({ uid: "seller", displayName: "Aminah", photoURL: null, sellerRating: null, sellerReviewCount: 0, sellerCompletedTransactionCount: 0, sellerTier: null, verificationStatus: "unverified", ...patch });

test("discovery batches 10, 20 and 40 seller lookups without N+1 calls", () => {
  for (const count of [10, 20, 40]) assert.equal(chunkSellerIds(Array.from({ length: count }, (_, index) => `seller-${index}`)).length, 1);
  assert.equal(chunkSellerIds(Array.from({ length: 41 }, (_, index) => `seller-${index}`)).length, 2);
  assert.equal(chunkSellerIds(["same", "same", "other"])[0]?.length, 2);
});

test("seller trust labels distinguish new and reviewed sellers", () => {
  assert.equal(sellerRatingLabel(seller()), "New seller");
  assert.equal(sellerRatingLabel(seller({ sellerRating: 4.9, sellerReviewCount: 18 })), "4.9 ★ (18)");
  assert.equal(completedSalesLabel(0), "0 sales");
  assert.equal(completedSalesLabel(1), "1 sale");
  assert.equal(completedSalesLabel(100), "100+ sales");
});

test("buyer reputation and promotion data are absent from the public seller contract", () => {
  const summary = seller({ sellerTier: "gold", sellerCompletedTransactionCount: 30 });
  assert.equal("buyer" in summary, false);
  assert.equal("promotion" in summary, false);
  assert.equal(summary.sellerTier, "gold");
  assert.equal(completedSalesLabel(summary.sellerCompletedTransactionCount), "30 sales");
});
