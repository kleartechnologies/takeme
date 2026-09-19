import assert from "node:assert/strict";
import test from "node:test";
import { MIN_AUCTION_DURATION_MS, createFacetKey, createFacetKeys, createSearchTokens, getMinimumNextBid, normalizeSearch, ringgitToSen, validateImageFiles, validateListingInput } from "../src/lib/listing-validation.ts";

const validInput = {
  title: "Fujifilm mirrorless camera",
  description: "A carefully used camera with charger and two batteries included.",
  categoryId: "electronics",
  condition: "Good" as const,
  price: 1280,
  listingType: "buy_now" as const,
  location: "Bangsar, Kuala Lumpur",
};

test("normalizes and tokenizes searchable titles", () => {
  assert.equal(normalizeSearch("  Sony  XM5!  "), "sony xm5");
  const tokens = createSearchTokens("Fujifilm Camera");
  assert.ok(tokens.includes("fuji"));
  assert.ok(tokens.includes("camera"));
  assert.ok(tokens.includes("fujifilm cam"));
});

test("builds every facet wildcard combination", () => {
  const keys = createFacetKeys({ categoryId: "electronics", condition: "Good", listingType: "buy_now", location: "Kuala Lumpur" });
  assert.equal(keys.length, 16);
  assert.ok(keys.includes(createFacetKey({ categoryId: "electronics", condition: "Good" })));
  assert.ok(keys.includes("*|*|*|*"));
});

test("accepts valid buy-now listing data", () => {
  assert.deepEqual(validateListingInput(validInput), []);
});

test("rejects invalid buy-now price", () => {
  const errors = validateListingInput({ ...validInput, price: 0 });
  assert.ok(errors.some((error) => error.includes("positive")));
});

test("accepts a valid auction and rejects invalid auction settings", () => {
  const start = new Date(Date.now() + 60_000);
  const auction = { ...validInput, listingType: "auction" as const, startingBid: 10_000, minimumBidIncrement: 1_000, auctionStartAt: start.toISOString(), auctionEndAt: new Date(start.getTime() + MIN_AUCTION_DURATION_MS).toISOString() };
  const { price: _price, ...validAuction } = auction;
  void _price;
  assert.deepEqual(validateListingInput(validAuction), []);
  assert.ok(validateListingInput({ ...validAuction, startingBid: 0 }).some((error) => error.includes("Starting bid")));
  assert.ok(validateListingInput({ ...validAuction, minimumBidIncrement: Number.NaN }).some((error) => error.includes("increment")));
  assert.ok(validateListingInput({ ...validAuction, auctionEndAt: start.toISOString() }).some((error) => error.includes("after")));
});

test("stores currency as integer sen and calculates the next minimum", () => {
  assert.equal(ringgitToSen("100.00"), 10_000);
  assert.equal(ringgitToSen("10.1"), 1_010);
  assert.equal(ringgitToSen("10.123"), null);
  assert.equal(ringgitToSen("NaN"), null);
  assert.equal(getMinimumNextBid({ startingBid: 10_000, currentBid: 0, bidCount: 0, minimumBidIncrement: 1_000 }), 10_000);
  assert.equal(getMinimumNextBid({ startingBid: 10_000, currentBid: 10_000, bidCount: 1, minimumBidIncrement: 1_000 }), 11_000);
});

test("enforces image type and size constraints", () => {
  const valid = new File([new Uint8Array(128)], "camera.webp", { type: "image/webp" });
  const invalid = new File([new Uint8Array(128)], "notes.txt", { type: "text/plain" });
  assert.deepEqual(validateImageFiles([valid]), []);
  assert.ok(validateImageFiles([invalid])[0].includes("not a JPEG"));
});
