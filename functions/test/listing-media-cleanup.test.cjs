const assert = require("node:assert/strict");
const test = require("node:test");
const { deleteListingMedia, listingMediaPrefix } = require("../lib/listing-media-cleanup.js");

test("listing media cleanup deletes every file in the authenticated seller's exact listing prefix", async () => {
  const prefix = listingMediaPrefix("seller-one", "listing-one");
  const deleted = [];
  const files = ["first.webp", "second.webp"].map((name) => ({
    name: `${prefix}${name}`,
    async delete(options) { assert.deepEqual(options, { ignoreNotFound: true }); deleted.push(name); },
  }));
  await deleteListingMedia({ async getFiles(options) { assert.deepEqual(options, { prefix }); return [files]; } }, "seller-one", "listing-one");
  assert.deepEqual(deleted, ["first.webp", "second.webp"]);
});

test("listing media cleanup succeeds with no files or already-missing files", async () => {
  const prefix = listingMediaPrefix("seller-one", "listing-one");
  await deleteListingMedia({ async getFiles() { return [[]]; } }, "seller-one", "listing-one");
  await deleteListingMedia({ async getFiles() { return [[{
    name: `${prefix}missing.webp`,
    async delete(options) { assert.equal(options.ignoreNotFound, true); },
  }]]; } }, "seller-one", "listing-one");
});

test("listing media cleanup refuses a path outside the seller's listing", async () => {
  let deleted = false;
  await assert.rejects(() => deleteListingMedia({ async getFiles() { return [[{
    name: "users/seller-two/listings/listing-two/foreign.webp",
    async delete() { deleted = true; },
  }]]; } }, "seller-one", "listing-one"), /outside the listing media path/);
  assert.equal(deleted, false);
});
