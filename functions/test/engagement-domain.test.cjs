const assert = require("node:assert/strict");
const test = require("node:test");
const { matchesSearch, normalizeSearch, parseSearch, priceSen, stableId } = require("../lib/engagement-domain.js");

const criteria = { query: "camera", category: "electronics", condition: "Good", type: "buy_now", auction: "", price: 1500, location: "Kuala Lumpur", sort: "newest" };
const listing = { title: "Working vintage camera", searchTokens: ["camera", "working"], categoryId: "electronics", condition: "Good", listingType: "buy_now", status: "active", price: 1200, location: "Kuala Lumpur" };

test("price history only accepts canonical two-decimal MYR amounts", () => {
  assert.equal(priceSen(1500), 150000);
  assert.equal(priceSen(2.9), 290);
  assert.equal(priceSen(2.999), null);
  assert.equal(priceSen(-1), null);
  assert.equal(priceSen(Infinity), null);
  assert.equal(priceSen("1500"), null);
});

test("saved-search parsing restricts fields and requires explicit criteria", () => {
  assert.deepEqual(parseSearch(criteria), criteria);
  assert.throws(() => parseSearch({}), /Choose/);
  assert.throws(() => parseSearch({ ...criteria, query: "x" }), /two/);
  assert.throws(() => parseSearch({ ...criteria, query: "$$" }), /two/);
  assert.throws(() => parseSearch({ ...criteria, price: 2.999 }), /price/);
  assert.throws(() => parseSearch({ ...criteria, auction: "active" }), /Auction/);
  assert.throws(() => parseSearch({ ...criteria, category: "imaginary" }), /Category/);
});

test("saved-search matching agrees with existing search token semantics and filters", () => {
  assert.equal(matchesSearch(criteria, listing), true);
  for (const patch of [{ status: "sold" }, { categoryId: "games" }, { condition: "Fair" }, { listingType: "auction" }, { price: 1501 }, { location: "Penang" }, { searchTokens: ["camcorder"] }]) assert.equal(matchesSearch(criteria, { ...listing, ...patch }), false);
  assert.equal(normalizeSearch("  Kuala   Lumpur!  "), "kuala lumpur");
});

test("event IDs and notification dedupe keys are deterministic and distinct", () => {
  assert.equal(stableId("user", "price", "listing", "event"), stableId("user", "price", "listing", "event"));
  assert.notEqual(stableId("user", "price", "listing", "event"), stableId("user", "price", "listing", "event2"));
});
