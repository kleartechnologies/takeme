import assert from "node:assert/strict";
import test from "node:test";
import { auctionBidLabel, auctionClock, effectiveStatus, ENDING_SOON_MS, quickBidAmounts } from "../src/lib/auction-presentation.ts";

const start = Date.parse("2026-10-02T10:00:00Z");
const listing = { auctionStatus: "scheduled" as const, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(start + 3_600_000).toISOString() };

test("auction presentation uses authoritative times at exact boundaries, while terminal stored states win", () => {
  assert.equal(effectiveStatus(listing, 0), "scheduled");
  assert.equal(effectiveStatus(listing, start - 1), "scheduled");
  assert.equal(effectiveStatus(listing, start), "active");
  assert.equal(effectiveStatus(listing, start + 3_600_000), "ended");
  assert.equal(effectiveStatus({ ...listing, auctionStatus: "cancelled" }, start), "cancelled");
  assert.equal(effectiveStatus({ ...listing, auctionStatus: "ended" }, start - 1), "ended");
});

test("scheduled auctions use Starting bid and live auctions use Current bid even without bids", () => {
  const scheduled = { ...listing, status: "active" as const, bidCount: 0 };
  assert.equal(auctionBidLabel(scheduled), "Starting bid");
  assert.equal(auctionBidLabel({ ...scheduled, bidCount: 2 }, start - 1), "Starting bid");
  assert.equal(auctionBidLabel(scheduled, start), "Current bid");
  assert.equal(auctionBidLabel({ ...scheduled, auctionStatus: "active" }), "Current bid");
  assert.equal(auctionBidLabel({ ...scheduled, auctionStatus: "active", bidCount: 2 }), "Current bid");
});

test("ended auctions use Final bid regardless of bids, final amount availability or lifecycle field", () => {
  const ended = { ...listing, status: "ended" as const, bidCount: 2 };
  assert.equal(auctionBidLabel(ended), "Final bid");
  assert.equal(auctionBidLabel({ ...ended, bidCount: 0 }), "Final bid");
  assert.equal(auctionBidLabel({ ...ended, status: "active", auctionStatus: "ended" }, start - 1), "Final bid");
  assert.equal(auctionBidLabel({ ...ended, status: "sold", auctionStatus: "ended" }), "Final bid");
});

test("an elapsed auction switches bid copy at its exact end time before server finalization", () => {
  const active = { ...listing, status: "active" as const, auctionStatus: "active" as const, bidCount: 2 };
  assert.equal(auctionBidLabel(active, start + 3_600_000 - 1), "Current bid");
  assert.equal(auctionBidLabel(active, start + 3_600_000), "Final bid");
  assert.equal(auctionBidLabel({ ...active, bidCount: 0 }, start + 3_600_001), "Final bid");
  assert.equal(auctionBidLabel({ ...active, auctionStatus: "cancelled", bidCount: 0 }, start + 3_600_001), "Starting bid");
});

test("countdowns never become negative and survive reload with the same timestamp", () => {
  assert.equal(auctionClock(listing.auctionEndAt, 0), null);
  assert.equal(auctionClock("invalid", start), null);
  assert.deepEqual(auctionClock(listing.auctionEndAt, start), { remaining: 3_600_000, days: 0, hours: 1, minutes: 0, seconds: 0 });
  assert.equal(auctionClock(listing.auctionEndAt, start + 3_600_001)?.remaining, 0);
  assert.equal(auctionClock(listing.auctionEndAt, start + 3_600_000 - ENDING_SOON_MS)?.remaining, 300_000);
});

test("quick amounts derive from the current minimum and increment without exceeding the currency limit", () => {
  assert.deepEqual(quickBidAmounts(190000, 5000, 1_000_000_000), [190000, 195000, 200000]);
  assert.deepEqual(quickBidAmounts(999_999_999, 10, 1_000_000_000), [999_999_999]);
  assert.deepEqual(quickBidAmounts(100, 0, 1_000_000_000), []);
  assert.deepEqual(quickBidAmounts(0.1, 100, 1_000_000_000), []);
});
