import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auctionTimeRemaining, discoveryPrice, listingCardPrice, listingAge } from "../src/lib/listing-display.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const now = Date.parse("2026-10-02T06:00:00Z");

test("Home price presentation preserves MYR vs sen and starting/current bid semantics", () => {
  assert.equal(discoveryPrice({ listingType: "buy_now", price: 25.5 }), 25.5);
  assert.equal(discoveryPrice({ listingType: "auction", price: 0, startingBid: 1000, currentBid: 0, bidCount: 0 }), 10);
  assert.equal(discoveryPrice({ listingType: "auction", price: 0, startingBid: 1000, currentBid: 1100, bidCount: 1 }), 11);
});

test("auction cards never substitute starting/current amounts for a missing final bid", () => {
  const auction = { listingType: "auction", price: 0, startingBid: 1000, currentBid: 1100 };
  assert.equal(listingCardPrice({ listingType: "buy_now", price: 25.5 }), 25.5);
  assert.equal(listingCardPrice({ ...auction, auctionStatus: "scheduled", bidCount: 0 }), 10);
  assert.equal(listingCardPrice({ ...auction, auctionStatus: "active", bidCount: 1 }), 11);
  assert.equal(listingCardPrice({ ...auction, auctionStatus: "ended", bidCount: 0, finalBid: null }), null);
  assert.equal(listingCardPrice({ ...auction, status: "ended", bidCount: 1 }), null);
  assert.equal(listingCardPrice({ ...auction, auctionStatus: "ended", bidCount: 1, finalBid: 1200 }), 12);
  assert.equal(listingCardPrice({ ...auction, auctionStatus: "ended", finalBid: Number.NaN }), null);
});

test("listing age and auction urgency derive only from actual timestamps", () => {
  assert.equal(listingAge("2026-10-02T05:52:00Z", now), "8 min ago");
  assert.equal(listingAge("invalid", now), "");
  assert.equal(listingAge("2026-10-03T06:00:00Z", now), "");
  assert.equal(auctionTimeRemaining("2026-10-02T08:15:00Z", now), "2h 15m left");
  assert.equal(auctionTimeRemaining("2026-10-02T05:00:00Z", now), "Awaiting finalization");
  assert.equal(auctionTimeRemaining("invalid", now), "");
});

test("Home reuses authoritative discovery, saved controls and recommendation tracking", () => {
  const home = source("src/components/home/home-marketplace.tsx");
  assert.match(home, /getHomeRecommendations\(\)/);
  assert.match(home, /getActiveListings\(\{ location, sort: "newest", pageSize: 8 \}/);
  assert.match(home, /variant="discovery"/);
  assert.doesNotMatch(home, /navigator\.geolocation|marketplace-rail/);
  const card = source("src/components/listings/listing-card.tsx");
  assert.match(card, /variant = "default"/);
  assert.match(card, /<SaveButton listingId=\{listing.id\}/);
  assert.match(card, /RECOMMENDATION_IMPRESSION/);
  assert.match(card, /PROMOTION_CLICK/);
  const content = source("src/components/listings/discovery-card-content.tsx");
  assert.ok(content.indexOf('className="discovery-price"') < content.indexOf('className="discovery-product-title"'));
  assert.match(content, /clearInterval\(timer\)/);
  assert.doesNotMatch(content, /winnerId|currentBidderId|meetupLocation/);
});

test("Home shell has filters, two-column inventory, safe-area navigation and compact states", () => {
  const css = source("src/app/globals.css");
  assert.match(css, /\.home-product-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source("src/components/layout/header.tsx"), /aria-label="Browse with filters"/);
  assert.match(source("src/components/layout/footer.tsx"), /pathname === "\/" \|\| pathname === "\/explore".*\? "hidden lg:block "/);
  assert.match(source("src/components/layout/mobile-nav.tsx"), /env\(safe-area-inset-bottom\)/);
  assert.match(source("src/components/home/discovery-section.tsx"), /mascot-2d-happy.png/);
});

test("Home discovery previews stay one compact row without changing inventory queries", () => {
  const css = source("src/app/globals.css");
  assert.match(css, /\.home-discovery-preview > :nth-child\(n \+ 3\) \{ display: none; \}/);
  assert.match(css, /\.home-discovery-preview > :nth-child\(-n \+ 3\)/);
  assert.match(css, /\.home-discovery-preview > :nth-child\(-n \+ 4\)/);
  assert.match(css, /\.discovery-product-image \{ aspect-ratio: 4 \/ 3; \}/);
  const home = source("src/components/home/home-marketplace.tsx");
  assert.match(source("src/lib/firebase/public-catalogue-server.ts"), /filters: \{ sort: "newest", pageSize: 8 \}/);
  assert.match(home, /getHomeRecommendations\(\)/);
  assert.match(home, /href="\/explore"/);
  assert.doesNotMatch(home, /Load more|Top Picks|Saved searches|listings loaded/);
});

test("compact Home cards leave detailed seller trust and auction history on detail routes", () => {
  const content = source("src/components/listings/discovery-card-content.tsx");
  assert.doesNotMatch(content, /PublicSellerSummary|completedSales|sellerId/);
  assert.match(content, /auctionBidLabel\(listing, now \?\? 0\)/);
  assert.match(content, /auctionTimeRemaining\(listing.auctionEndAt, now\)/);
  const card = source("src/components/listings/listing-card.tsx");
  assert.match(card, /variant === "discovery" \? <DiscoveryCardContent listing=\{listing\} \/> : <>/);
  assert.match(card, /<PublicSellerSummary uid=\{listing.sellerId\}/);
});

test("Home's general-area picker collapses after applying an area and never uses GPS", () => {
  const home = source("src/components/home/home-marketplace.tsx");
  assert.match(home, /setLocation\(next\);\s+setAreaPickerOpen\(false\);/);
  assert.match(home, /open=\{areaPickerOpen\}/);
  assert.match(home, /onToggle=.*event.currentTarget.open/);
  assert.match(home, /getActiveListings\(\{ location, sort: "newest", pageSize: 8 \}/);
  assert.doesNotMatch(home, /geolocation|discovery=nearby/);
});
