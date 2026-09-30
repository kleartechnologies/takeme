import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("existing auction draft uses its own listing ID and the authoritative publish callable", () => {
  const service = readFileSync("src/lib/services/listings.ts", "utf8");
  const resume = service.slice(service.indexOf("export async function publishExistingAuctionDraft"));
  assert.match(resume, /listing\.sellerId !== services\.user\.uid/);
  assert.match(resume, /listing\.status !== "draft"/);
  assert.match(resume, /updateListing\(id, input, orderedPhotos\)/);
  assert.match(resume, /publishAuction\(id, imageUrls\)/);
  assert.doesNotMatch(resume, /createAuctionDraft|createListing/);
});

test("seller UI exposes resume only for unpublished zero-bid auctions", () => {
  const edit = readFileSync("src/components/forms/edit-listing-view.tsx", "utf8");
  const form = readFileSync("src/components/forms/sell-form.tsx", "utf8");
  const profile = readFileSync("src/components/profile/profile-view.tsx", "utf8");
  assert.match(edit, /state\.listing\.status === "draft"/);
  assert.match(edit, /state\.listing\.bidCount \?\? 0\) === 0/);
  assert.match(form, /publishExistingAuctionDraft\(listing\.id, input, photos\)/);
  assert.match(form, /Publish draft auction/);
  assert.match(profile, /Resume draft/);
});
