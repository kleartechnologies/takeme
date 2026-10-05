const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseUploadRequests, mayUploadListing } = require("../lib/upload-permit-domain");
const request = path => ({ path, contentType: "image/webp", sizeBytes: 300 });
test("only caller-owned exact profile/listing paths are valid", () => {
  assert.equal(parseUploadRequests("owner", [request("users/owner/profile/photo.webp")])[0].listingId, null);
  assert.equal(parseUploadRequests("owner", [request("users/owner/listings/listing/photo.webp")])[0].listingId, "listing");
  for (const path of ["users/other/profile/photo", "users/owner/profile/../photo", "users/owner/profile/a..b", "users/owner/profile/%2f", "users/owner/listings/a/photo/nested", "users/owner/evidence/photo", "users/owner/listings/../photo"]) assert.throws(() => parseUploadRequests("owner", [request(path)]));
});
test("duplicate paths, over-large batches, unsupported type/size and extra fields are denied", () => {
  const value = request("users/owner/profile/photo");
  for (const batch of [[], Array.from({ length: 9 }, (_, i) => request(`users/owner/profile/${i}`)), [value, value], [{ ...value, contentType: "image/svg+xml" }], [{ ...value, sizeBytes: 0 }], [{ ...value, sizeBytes: 8 * 1024 * 1024 + 1 }], [{ ...value, uid: "other" }]]) assert.throws(() => parseUploadRequests("owner", batch));
});
test("listing media remains locked after auction starts, bid, removal or wrong ownership", () => {
  const fixed = { sellerId: "owner", listingType: "buy_now", status: "active" };
  assert.equal(mayUploadListing(fixed, "owner", 100), true);
  assert.equal(mayUploadListing({ ...fixed, status: "removed" }, "owner", 100), false);
  assert.equal(mayUploadListing(fixed, "other", 100), false);
  const auction = { sellerId: "owner", listingType: "auction", status: "active", auctionStatus: "scheduled", auctionStartAt: 200, bidCount: 0 };
  assert.equal(mayUploadListing(auction, "owner", 100), true);
  assert.equal(mayUploadListing(auction, "owner", 200), false);
  assert.equal(mayUploadListing({ ...auction, bidCount: 1 }, "owner", 100), false);
});
