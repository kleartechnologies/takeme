import assert from "node:assert/strict";
import test from "node:test";
import { isActiveInventoryListing } from "../src/lib/active-inventory.ts";

const now = Date.parse("2026-09-24T00:00:00.000Z");
const auction = { id: "a", status: "active", listingType: "auction", auctionStatus: "active", startingBid: 10000, currentBid: 0, bidCount: 0, price: 100, auctionEndAt: "2026-09-25T00:00:00.000Z" };
const valid = (patch: Record<string, unknown> = {}) => isActiveInventoryListing({ ...auction, ...patch } as never, now);

test("active and scheduled valid auctions remain discoverable", () => {
  assert.equal(valid(), true);
  assert.equal(valid({ auctionStatus: "scheduled" }), true);
  assert.equal(valid({ currentBid: 12000, bidCount: 1, price: 120 }), true);
});
test("expired, finalized, cancelled and invalid auctions are not active inventory", () => {
  assert.equal(valid({ auctionEndAt: "2026-09-23T00:00:00.000Z" }), false);
  assert.equal(valid({ auctionStatus: "ended" }), false);
  assert.equal(valid({ auctionStatus: "cancelled" }), false);
  assert.equal(valid({ status: "ended" }), false);
  assert.equal(valid({ startingBid: 0, price: 0 }), false);
  assert.equal(valid({ currentBid: 1, bidCount: 1 }), false);
});
test("fixed-price inventory still requires a positive price", () => {
  assert.equal(valid({ listingType: "buy_now", price: 100 }), true);
  assert.equal(valid({ listingType: "buy_now", price: 0 }), false);
});
