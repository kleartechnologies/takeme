const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_AUCTION_DURATION_MS,
  MIN_AUCTION_DURATION_MS,
  effectiveAuctionStatus,
  minimumNextBid,
  validateAuctionSettings,
  validateBidAmount,
} = require("../lib/auction-domain.js");

const now = new Date("2026-09-19T00:00:00.000Z");
const valid = {
  startingBid: 10_000,
  minimumBidIncrement: 1_000,
  auctionStartAt: new Date(now.getTime() + 60_000),
  auctionEndAt: new Date(now.getTime() + 60_000 + MIN_AUCTION_DURATION_MS),
};

test("accepts a valid auction and rejects invalid money", () => {
  assert.deepEqual(validateAuctionSettings(valid, now), []);
  assert.match(validateAuctionSettings({ ...valid, startingBid: 0 }, now)[0], /positive/);
  assert.match(validateAuctionSettings({ ...valid, minimumBidIncrement: Number.NaN }, now)[0], /positive/);
});

test("rejects invalid dates and duration", () => {
  assert.ok(validateAuctionSettings({ ...valid, auctionEndAt: valid.auctionStartAt }, now).length > 0);
  assert.ok(validateAuctionSettings({ ...valid, auctionEndAt: new Date(valid.auctionStartAt.getTime() + MIN_AUCTION_DURATION_MS - 1) }, now).length > 0);
  assert.ok(validateAuctionSettings({ ...valid, auctionEndAt: new Date(valid.auctionStartAt.getTime() + MAX_AUCTION_DURATION_MS + 1) }, now).length > 0);
});

test("calculates deterministic bid minimums", () => {
  assert.equal(minimumNextBid(10_000, 0, 0, 1_000), 10_000);
  assert.equal(minimumNextBid(10_000, 10_000, 1, 1_000), 11_000);
  assert.equal(validateBidAmount(11_000, 11_000), null);
  assert.match(validateBidAmount(10_999, 11_000), /at least/);
  assert.match(validateBidAmount(-1, 11_000), /positive/);
  assert.match(validateBidAmount(Number.POSITIVE_INFINITY, 11_000), /positive/);
});

test("derives scheduled, active, ended, and cancelled lifecycle states", () => {
  const start = new Date(now.getTime() + 1_000);
  const end = new Date(now.getTime() + 2_000);
  assert.equal(effectiveAuctionStatus("scheduled", start, end, now), "scheduled");
  assert.equal(effectiveAuctionStatus("scheduled", start, end, new Date(now.getTime() + 1_500)), "active");
  assert.equal(effectiveAuctionStatus("active", start, end, new Date(now.getTime() + 2_000)), "ended");
  assert.equal(effectiveAuctionStatus("cancelled", start, end, now), "cancelled");
});
