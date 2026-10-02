import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const explore = source("src/components/listings/explore-browser.tsx");

test("Explore uses approved discovery cards and actual inventory, not reference products", () => {
  assert.match(explore, /<ListingCard[^>]*variant="discovery"/);
  assert.match(explore, /<CategoryGrid compact selectedId=\{filters.category\}/);
  assert.match(explore, /getActiveListings\(request\)/);
  assert.match(explore, /getPromotionPlacements\(state.page.listings/);
  assert.match(explore, /promotion=\{activePlacement\?\.badges\[listing.id\]\}/);
  assert.doesNotMatch(explore, /PublicSellerSummary|Local seller|Top Picks|listings loaded|MacBook|iPhone/);
});

test("Explore retains the supported query and cursor contracts", () => {
  for (const key of ["search: filters.q", "categoryId: filters.category", "condition: filters.condition", "listingType: filters.type", "location: filters.location", "maxPrice:", "sort: filters.sort", "pageSize: 12"]) assert.ok(explore.includes(key), key);
  assert.match(explore, /getActiveListings\(request, state.page.cursor\)/);
  assert.match(explore, /listings: \[\.\.\.current.page.listings, \.\.\.next.listings\]/);
  assert.match(explore, /window.history.replaceState/);
  assert.match(explore, /next.price && next.sort === "newest"/);
  assert.doesNotMatch(explore, /minPrice|verifiedOnly|navigator.geolocation|nearest|price_range/);
});

test("Explore exposes only supported conditions/sorts with truthful counts", () => {
  assert.match(explore, /\["New", "Like new", "Good", "Fair"\]/);
  for (const sort of ["newest", "price_low", "price_high"]) assert.ok(explore.includes(`value="${sort}"`));
  assert.match(explore, /state.page.listings.length/);
  assert.match(explore, /state.page.hasMore \? "\+" : ""/);
  assert.match(explore, /Search in \$\{selectedCategory\}/);
  assert.match(explore, /value.length === 1/);
});

test("filters reuse the named shared sheet and retain owner-only Saved Search flow", () => {
  assert.match(explore, /<ActionSheet title="Filters" description=/);
  assert.match(explore, /onClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(explore, /saveSearch\(/);
  assert.match(explore, /params.get\("savedSearch"\)/);
  assert.match(explore, /Log in to save search/);
  assert.match(explore, /className="explore-saved-searches"/);
  assert.doesNotMatch(explore, /window.confirm|HeroBannerCarousel/);
});

test("Explore scopes responsive changes and shares Home shell without changing Home cards", () => {
  const css = source("src/app/globals.css");
  assert.match(css, /\.explore-product-grid \{ display: grid; grid-template-columns: repeat\(2,/);
  assert.match(css, /\.explore-product-grid \{ grid-template-columns: repeat\(3,/);
  assert.match(css, /\.explore-product-grid \{ grid-template-columns: repeat\(4,/);
  assert.match(source("src/components/layout/header.tsx"), /const discoveryHeader = pathname === "\/" \|\| pathname === "\/explore"/);
  for (const file of ["footer", "mobile-nav"]) assert.match(source(`src/components/layout/${file}.tsx`), /pathname === "\/" \|\| pathname === "\/explore"/);
  assert.match(source("src/app/explore/page.tsx"), /<Suspense fallback=/);
  assert.match(explore, /<ListingSkeleton key=\{index\} discovery/);
  assert.match(explore, /mascot-2d-happy.png/);
  assert.match(explore, /No matches found/);
  assert.match(explore, /Clear filters/);
});
