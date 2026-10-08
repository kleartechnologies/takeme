import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("V1 discovery exposes supported rails without a Free listing control", () => {
  const home = source("src/components/home/home-marketplace.tsx");
  const explore = source("src/components/listings/explore-browser.tsx");
  const page = source("src/components/home/published-home.tsx");
  const endingSoon = source("src/components/home/ending-soon-marketplace.tsx");
  assert.match(home, /Fresh Finds/);
  assert.match(home, /Near You/);
  assert.match(page, /<HomeMarketplace[\s\S]*<NearYouMarketplace[\s\S]*<EndingSoonMarketplace/);
  assert.match(endingSoon, /auctionStatus: "active"/);
  assert.doesNotMatch(home, /id: "free"|tab === "free"|Free Items/);
  assert.match(explore, /All listing types/);
  assert.match(explore, /Fixed price/);
  assert.match(explore, /Auctions<\/button>/);
  assert.doesNotMatch(explore, /Free listings|>Free<\/button>/);
});

test("V1 profile does not mount the absent protected-payment callable", () => {
  const profile = source("src/components/profile/profile-view.tsx");
  assert.doesNotMatch(profile, /SellerPaymentStatus|getSellerPaymentOnboarding/);
  assert.match(profile, /<ReputationView/);
  assert.match(profile, /<TransactionHistory/);
  assert.match(profile, /My Listings/);
});

test("brand slogan and truthful free-to-list copy remain intact", () => {
  const promotions = source("src/data/promotions.ts");
  assert.match(promotions, /Buy\. Sell\. Give\. Reuse\./);
  assert.match(promotions, /List your items for free on TAKEME\./);
});
