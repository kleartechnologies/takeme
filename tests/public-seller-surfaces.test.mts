import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("the shared listing card renders seller trust for every card type", () => {
  const card = source("src/components/listings/listing-card.tsx");
  assert.match(card, /<PublicSellerSummary uid=\{listing\.sellerId\} variant="card"/);
  assert.match(card, /const isAuction =/);
  assert.match(card, /promotion &&/);
});

test("Explore, For You, Saved and related listing surfaces reuse the trusted card", () => {
  for (const path of [
    "src/components/listings/explore-browser.tsx",
    "src/components/intelligence/for-you-feed.tsx",
    "src/components/saved/saved-view.tsx",
    "src/components/home/home-marketplace.tsx",
    "src/components/listings/listing-section.tsx",
  ]) assert.match(source(path), /<ListingCard/);
});

test("listing detail uses the expanded seller trust panel and handles unavailable data", () => {
  assert.match(source("src/components/listings/listing-detail-view.tsx"), /<SellerTrustSignal uid=\{listing\.sellerId\}/);
  const summary = source("src/components/profile/public-seller-summary.tsx");
  assert.match(summary, /Seller details are unavailable right now/);
  assert.match(summary, /How seller tiers work/);
  assert.match(summary, /Buyer reputation is tracked separately/);
});
