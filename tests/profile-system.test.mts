import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { listingActions, listingGroup, managementStatus, reviewDistribution } from "../src/lib/profile-presentation.ts";
import type { Listing, PublicReview } from "../src/types/marketplace.ts";
const source = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const now = Date.parse("2026-10-02T00:00:00Z");
const listing = (overrides: Partial<Listing>) => ({ listingType: "buy_now", status: "active", bidCount: 0, ...overrides } as Listing);

test("management groups preserve drafts, sold and non-public history", () => {
  assert.equal(listingGroup(listing({})), "active");
  assert.equal(listingGroup(listing({ status: "draft" })), "drafts");
  assert.equal(listingGroup(listing({ status: "sold" })), "sold");
  for (const status of ["ended", "cancelled"] as const) {
    const value = listing({ listingType: "auction", auctionStatus: status });
    assert.equal(listingGroup(value), "past");
    assert.equal(listingActions(value, now).removable, false);
  }
  assert.equal(listingGroup(listing({ status: "removed" })), "past");
  assert.equal(managementStatus(listing({ status: "removed" })), "Removed");
});

test("existing draft resumes by same ID; auction actions respect lifecycle/bids", () => {
  const draft = listing({ status: "draft", listingType: "auction", auctionStatus: "scheduled" });
  assert.deepEqual(listingActions(draft, now), { resumableDraft: true, editable: true, removable: false, promotable: false });
  const future = listing({ listingType: "auction", auctionStatus: "scheduled", auctionStartAt: "2026-10-03T00:00:00Z", auctionEndAt: "2026-10-04T00:00:00Z" });
  assert.equal(listingActions(future, now).editable, true);
  assert.equal(listingActions({ ...future, bidCount: 1 }, now).removable, false);
  assert.equal(listingActions({ ...future, auctionStartAt: "2026-10-01T00:00:00Z" }, now).editable, false);
  assert.deepEqual(listingActions(listing({}), now), { resumableDraft: false, editable: true, removable: true, promotable: true });
});

test("public seller view uses public projections and never private trust/progress", () => {
  const publicView = source("src/components/profile/seller-profile-view.tsx");
  assert.match(publicView, /getPublicSellerSummary\(uid\), getListingsBySeller\(uid\)/);
  assert.doesNotMatch(publicView, /getUserProfile|getTrustSummary|TransactionHistory|tier progress|nextThreshold|user.email/);
  assert.match(publicView, /parsePublicLocation\(item.publicLocation\)/);
  assert.match(publicView, /parseLegacyGeneralLocation\(item.location\)/);
  assert.match(publicView, /variant="discovery"/);
  assert.match(publicView, /MessageSellerAction listingId=\{chatListing\}/);
  const reviews = source("src/components/profile/seller-reviews.tsx");
  assert.match(reviews, /getPublicReviews\(uid, true\)/);
  assert.match(reviews, /review.reviewerRole === "buyer"/);
  assert.doesNotMatch(reviews, /getTrustSummary|purchaseCount|nextThreshold|reviewerId|transactionId/);
  assert.match(source("functions/src/transactions.ts"), /request.auth\?\.uid === userId && request.data\?\.sellerOnly !== true/);
  const reputation = source("src/components/profile/reputation-view.tsx");
  assert.match(reputation, /props.publicSellerOnly \? <SellerReviews/);
  assert.match(reputation, /if \(user\?\.uid !== uid\) return;/);
  assert.match(reputation, /if \(user\?\.uid !== uid\) return null;/);
});

test("review distribution is truthful about the bounded public page", () => {
  const reviews = [5, 4, 5].map((rating) => ({ rating } as PublicReview));
  assert.deepEqual(reviewDistribution(reviews), [{ rating: 5, count: 2 }, { rating: 4, count: 1 }, { rating: 3, count: 0 }, { rating: 2, count: 0 }, { rating: 1, count: 0 }]);
  assert.equal(reviewDistribution([]).reduce((sum, item) => sum + item.count, 0), 0);
  assert.match(source("src/components/profile/seller-reviews.tsx"), /Recent review ratings/);
});

test("private account routes retain owner access and existing management flows", () => {
  const view = source("src/components/profile/profile-view.tsx");
  assert.match(view, /getListingsBySeller\(user.uid, true\)/);
  assert.match(view, /getTrustSummary\(user.uid\)/);
  for (const route of ["/profile/listings", "/profile/settings", "/profile/transactions", "/saved", "/saved-searches", "/following", "/messages", "/updates"]) assert.ok(view.includes(route), route);
  const settings = source("src/components/profile/account-settings.tsx");
  assert.match(settings, /profile.uid === user.uid/);
  assert.match(settings, /<EditProfile/);
  assert.match(settings, /\/profile\/locations/);
  const listings = source("src/components/profile/my-listings-view.tsx");
  assert.match(listings, /ActionSheet title=/);
  assert.match(listings, /if \(!confirm \|\| !user \|\| inFlight.current\) return/);
  assert.match(listings, /deleteListing\(confirm.id\)/);
  assert.match(source("src/app/profile/layout.tsx"), /index: false/);
  assert.doesNotMatch(view, /Wallet|Normally replies|Active Bids|verified = true/);
});

test("owner density keeps tier requirements and moves reviews into the compact menu", () => {
  const view = source("src/components/profile/profile-view.tsx");
  const reputation = source("src/components/profile/reputation-view.tsx");
  assert.doesNotMatch(view, /How TAKEME tiers work/);
  assert.match(view, /<OwnerPublishedReviews key=\{user.uid\} uid=\{user.uid\}/);
  assert.equal((reputation.match(/How TAKEME tiers work/g) ?? []).length, 1);
  assert.match(reputation, /Private to you\./);
  assert.match(reputation, /aria-valuemin=\{currentThreshold\} aria-valuemax=\{nextThreshold\}/);
  assert.match(reputation, /nextThreshold - count/);
  assert.match(reputation, /getPublicReviews\(uid\)/);
  assert.match(reputation, /reportPublicReview\(reviewId, reason, details\)/);
  assert.doesNotMatch(reputation, /My published reviews/);
  assert.match(source("src/app/globals.css"), /\.owner-profile \.profile-menu-link \{ min-height: 56px; \}/);
});

test("fixed-price drafts can resume without exposing sold or removed items as editable", () => {
  const now = Date.parse("2026-10-03T00:00:00Z");
  assert.equal(listingActions(listing({ listingType: "buy_now", status: "draft" }), now).resumableDraft, true);
  assert.equal(listingActions(listing({ listingType: "buy_now", status: "draft" }), now).editable, true);
  for (const status of ["sold", "removed"] as const) assert.equal(listingActions(listing({ listingType: "buy_now", status }), now).editable, false);
});
