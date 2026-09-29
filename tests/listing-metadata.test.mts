import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildListingMetadata, listingCanonicalUrl } from "../src/lib/listing-metadata.ts";

const siteUrl = "https://takeme.my";
const listing = {
  status: "active", title: "iPhone 15 Pro 256GB", description: "No 40 Jalan Halban 06000 Jitra Kedah",
  publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" as const },
  price: 2500, listingType: "buy_now", imageUrls: ["https://firebasestorage.googleapis.com/example-image"],
  sellerEmail: "private@example.test", buyerId: "private-buyer", internalNotes: "private notes",
};

test("public listing metadata uses title, price, description, image and canonical URL", () => {
  const metadata = buildListingMetadata("listing-123", listing, siteUrl);
  assert.deepEqual(metadata.title, { absolute: "iPhone 15 Pro 256GB — RM2,500 | TAKEME" });
  assert.equal(metadata.description, "RM2,500 · Jitra, Kedah · View this listing on TAKEME.");
  assert.equal(metadata.alternates?.canonical, "https://takeme.my/listings/listing-123");
  assert.equal(metadata.openGraph?.url, "https://takeme.my/listings/listing-123");
  assert.deepEqual(metadata.openGraph?.images, [{ url: listing.imageUrls[0], alt: listing.title }]);
  assert.match(JSON.stringify(metadata.twitter), /"card":"summary_large_image"/);
  assert.equal(listingCanonicalUrl("a b", siteUrl), "https://takeme.my/listings/a%20b");
  const serialized = JSON.stringify(metadata);
  for (const secret of [listing.sellerEmail, listing.buyerId, listing.internalNotes]) assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes(listing.description));
});

test("auction metadata uses the real current bid and image fallback", () => {
  const metadata = buildListingMetadata("auction-1", { status: "ended", title: "Camera", description: "A camera", listingType: "auction", startingBid: 10000, currentBid: 15500, bidCount: 2, imageUrls: [] }, siteUrl);
  assert.deepEqual(metadata.title, { absolute: "Camera — RM155 | TAKEME" });
  assert.deepEqual(metadata.openGraph?.images, [{ url: "https://takeme.my/brand/takeme-app-icon.png", alt: "Camera" }]);
});

test("unavailable and draft listings do not fabricate public preview content", () => {
  for (const unavailable of [null, { ...listing, status: "draft" }]) {
    const metadata = buildListingMetadata("not-public", unavailable, siteUrl);
    assert.deepEqual(metadata.title, { absolute: "Listing unavailable | TAKEME" });
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.ok(!JSON.stringify(metadata).includes(listing.title));
  }
});

test("the App Router generates listing previews on the server for each request", () => {
  const route = readFileSync(new URL("../src/app/listings/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /buildListingMetadata\(id, await getPublicListingForMetadata\(id\), siteUrl\)/);
  assert.ok(!route.includes("use client"));
});
