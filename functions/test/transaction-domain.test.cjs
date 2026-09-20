const assert = require("node:assert/strict");
const test = require("node:test");
const { REVIEW_WINDOW_DAYS, OFFER_WINDOW_DAYS, TIER_THRESHOLDS, tierFor, nextTier, ringgitToSen, validSen, reviewVisible, validTags, nextRatingSummary } = require("../lib/transaction-domain.js");

test("centralized windows and tiers use completed counts only", () => {
  assert.equal(REVIEW_WINDOW_DAYS, 14);
  assert.equal(OFFER_WINDOW_DAYS, 7);
  assert.deepEqual(TIER_THRESHOLDS, { bronze: 5, silver: 15, gold: 30, platinum: 75 });
  for (const [count, expected] of [[0, null], [4, null], [5, "bronze"], [14, "bronze"], [15, "silver"], [29, "silver"], [30, "gold"], [74, "gold"], [75, "platinum"]]) assert.equal(tierFor(count), expected);
  assert.deepEqual(nextTier(32), { tier: "platinum", threshold: 75, remaining: 43 });
  assert.equal(nextTier(75), null);
});

test("authoritative money is integer sen", () => {
  assert.equal(ringgitToSen(1500), 150000);
  assert.equal(ringgitToSen(2.9), 290);
  assert.equal(ringgitToSen(2.999), null);
  assert.equal(ringgitToSen(-2), null);
  assert.equal(validSen(150000), true);
  assert.equal(validSen(1500.5), false);
});

test("double-blind release waits for both reviews or deadline", () => {
  assert.equal(reviewVisible(1, 1000, 999), false);
  assert.equal(reviewVisible(2, 1000, 999), true);
  assert.equal(reviewVisible(1, 1000, 1000), true);
});

test("review tags are role-appropriate and ratings aggregate once", () => {
  assert.equal(validTags(["Item as described"], "buyer"), true);
  assert.equal(validTags(["Item as described"], "seller"), false);
  assert.equal(validTags(["Respectful", "Respectful"], "seller"), false);
  assert.deepEqual(nextRatingSummary(undefined, 5), { reviewCount: 1, ratingSum: 5, ratingDistribution: { "5": 1 }, averageRating: 5 });
  assert.equal(nextRatingSummary({ reviewCount: 1, ratingSum: 5, ratingDistribution: { "5": 1 } }, 4).averageRating, 4.5);
});
