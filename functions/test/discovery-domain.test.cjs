const assert = require("node:assert/strict");
const test = require("node:test");
const { planSections } = require("../lib/discovery.js");
const { applyInterestSignal, emptyInterest, scoreCandidate } = require("../lib/intelligence-domain.js");

const now = new Date("2026-09-20T00:00:00.000Z");
const listing = (id, changes = {}) => ({ id, sellerId: `seller-${id}`, title: `Camera ${id}`, description: "A working item with original accessories and clear details.", categoryId: "electronics", price: 240, location: "Kuala Lumpur", listingType: "buy_now", condition: "Good", imageUrls: ["image"], status: "active", createdAt: "2026-09-19T00:00:00.000Z", ...changes });
const candidate = (id, changes = {}, trendScore = 0, source = "recent") => ({ listing: listing(id, changes), trendScore, source });

test("cold discovery does not claim preference or local knowledge", () => {
  const sections = planSections([candidate("a"), candidate("b", { location: "Penang" }, 5)], null, now, new Set(), [], "", []);
  assert.equal(sections[0].id, "for_you");
  assert.match(sections[0].reason, /gets to know/i);
  assert.equal(sections.some((section) => section.id === "because_you_like" || section.id === "trending_near_you"), false);
  assert.ok(sections.some((section) => section.id === "popular"));
});

test("category and price preference produce bounded personalization", () => {
  let profile = emptyInterest(now);
  profile = applyInterestSignal(profile, { type: "VIEW_LISTING", listingId: "a", categoryId: "electronics", price: 240 }, now);
  profile = applyInterestSignal(profile, { type: "SEARCH", query: "camera", categoryId: "electronics" }, now);
  profile = applyInterestSignal(profile, { type: "SAVE_LISTING", categoryId: "electronics", price: 240 }, now);
  const desired = scoreCandidate(candidate("desired"), profile, now, new Set());
  const expensive = scoreCandidate(candidate("expensive", { price: 2400 }), profile, now, new Set());
  assert.ok(desired.score > expensive.score);
  const sections = planSections([candidate("a"), candidate("b", { categoryId: "fashion" })], profile, now, new Set(), ["electronics"], "", ["a"]);
  assert.ok(sections.some((section) => section.id === "because_you_like"));
  assert.ok(sections.some((section) => section.id === "recently_viewed"));
});

test("local and auction lanes require true supporting data", () => {
  const auction = candidate("live", { listingType: "auction", auctionStatus: "active", auctionEndAt: "2026-09-21T00:00:00.000Z" }, 2, "auction");
  const elapsed = candidate("elapsed", { listingType: "auction", auctionStatus: "active", auctionEndAt: "2026-09-19T00:00:00.000Z" }, 10, "auction");
  const sections = planSections([auction, elapsed, candidate("far", { location: "Penang" }, 5)], null, now, new Set(), [], "Kuala Lumpur", []);
  assert.deepEqual(sections.find((section) => section.id === "auctions").items.map((item) => item.listing.id), ["live"]);
  assert.deepEqual(sections.find((section) => section.id === "trending_near_you").items.map((item) => item.listing.id), ["live"]);
  assert.equal(sections.some((section) => section.items.some((item) => item.listing.id === "elapsed")), false);
});
