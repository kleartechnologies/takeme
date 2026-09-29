const assert = require("node:assert/strict");
const test = require("node:test");
const { publicListing } = require("../lib/intelligence.js");

test("public listing projection omits raw bidder and winner UIDs while retaining auction display fields", () => {
  const listing = publicListing({
    sellerId: "seller-uid",
    title: "Camera auction",
    description: "A camera",
    categoryId: "electronics",
    condition: "Good",
    listingType: "auction",
    status: "active",
    privacyVersion: 2,
    publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" },
    location: "Jitra, Kedah",
    currentBid: 2500,
    currentBidderId: "bidder-uid",
    bidCount: 3,
    minimumBidIncrement: 100,
    auctionStatus: "active",
    winnerId: "winner-uid",
    finalBid: 2500,
  }, "listing-id");

  assert.equal(Object.hasOwn(listing, "currentBidderId"), false);
  assert.equal(Object.hasOwn(listing, "winnerId"), false);
  assert.equal(JSON.stringify(listing).includes("bidder-uid"), false);
  assert.equal(JSON.stringify(listing).includes("winner-uid"), false);
  assert.equal(listing.currentBid, 2500);
  assert.equal(listing.bidCount, 3);
  assert.equal(listing.auctionStatus, "active");
  assert.equal(listing.finalBid, 2500);
});
