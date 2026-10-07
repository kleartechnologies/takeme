import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createInFlightRead } from "../src/lib/in-flight-read.ts";
import { nextAuctionBoundary } from "../src/lib/auction-time-boundary.ts";
import { effectiveStatus } from "../src/lib/auction-presentation.ts";
import { reputationProgress } from "../src/lib/reputation-progress.ts";
import type { RoleReputation } from "../src/types/marketplace.ts";
const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("concurrent public detail readers share one request, but subsequent reads stay fresh", async () => {
  const read = createInFlightRead<number>();
  let finish!: (value: number) => void, calls = 0;
  const request = () => { calls++; return new Promise<number>(resolve => { finish = resolve; }); };
  const a = read("viewer:listing", request), b = read("viewer:listing", request);
  await Promise.resolve();
  assert.equal(a, b); assert.equal(calls, 1);
  finish(1); assert.deepEqual(await Promise.all([a, b]), [1, 1]);
  assert.equal(await read("viewer:listing", async () => ++calls), 2);
});
test("request failures do not poison retry and viewer identities cannot share private state", async () => {
  const read = createInFlightRead<number>();
  await assert.rejects(read("a:id", () => Promise.reject(new Error("offline"))), /offline/);
  assert.equal(await read("a:id", async () => 4), 4);
  const a = read("a:id", async () => 1), b = read("b:id", async () => 2);
  assert.notEqual(a, b); assert.deepEqual(await Promise.all([a, b]), [1, 2]);
  await assert.rejects(read("sync", () => { throw new Error("sync"); }), /sync/);
  assert.equal(await read("sync", async () => 3), 3);
});
test("auction presentation wakes at exact start, urgency and end without per-second page updates", () => {
  const start = Date.parse("2026-10-08T00:00:00Z"), end = start + 3_600_000;
  const listing = { listingType: "auction" as const, auctionStatus: "scheduled" as const, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(end).toISOString() };
  assert.equal(nextAuctionBoundary(listing, start - 1), start);
  assert.equal(effectiveStatus(listing, start), "active");
  assert.equal(nextAuctionBoundary(listing, start), end - 300_000);
  assert.equal(nextAuctionBoundary(listing, end - 300_000), end);
  assert.equal(nextAuctionBoundary(listing, end), null);
  assert.equal(effectiveStatus(listing, end), "ended");
  for (const auctionStatus of ["ended", "cancelled"] as const) assert.equal(nextAuctionBoundary({ ...listing, auctionStatus }, start - 1), null);
  assert.equal(nextAuctionBoundary({ ...listing, listingType: "buy_now" }, start), null);
  assert.equal(nextAuctionBoundary({ ...listing, auctionStartAt: "invalid", auctionEndAt: undefined }, start), null);
});
test("private status uses real policy thresholds and neutral first-activity language", () => {
  const thresholds = { bronze: 5, silver: 20, gold: 50, platinum: 100 };
  const buyer = reputationProgress("buyer", undefined, thresholds), seller = reputationProgress("seller", undefined, thresholds);
  assert.equal(buyer.status, "New Buyer"); assert.equal(seller.status, "New Seller");
  assert.equal(buyer.percent, 0); assert.equal(buyer.nextMessage, "5 purchases to unlock Bronze");
  assert.equal(seller.nextMessage, "5 sales to unlock Bronze");
  const progress = reputationProgress("buyer", { tier: "bronze", completedCount: 8 } as RoleReputation, thresholds);
  assert.equal(progress.status, "Bronze"); assert.equal(progress.percent, 20); assert.equal(progress.nextMessage, "12 purchases to unlock Silver");
  const custom = reputationProgress("seller", undefined, { ...thresholds, bronze: 7 });
  assert.equal(custom.nextThreshold, 7); assert.equal(custom.nextMessage, "7 sales to unlock Bronze");
  const platinum = reputationProgress("seller", { tier: "platinum", completedCount: 100 } as RoleReputation, thresholds);
  assert.equal(platinum.percent, 100); assert.equal(platinum.status, "Platinum");
});
test("timer isolation retains fresh server bidding and fixed-price pages do not tick", () => {
  const panel = source("src/components/listings/auction-panel.tsx");
  assert.match(panel, /function AuctionCountdown[\s\S]*?const now = useCurrentTime\(\)/);
  assert.match(panel, /const now = useAuctionTime\(listing\)/);
  assert.match(panel, /getAuctionViewerState/); assert.match(panel, /placeAuctionBid/);
  assert.match(source("src/lib/use-auction-time.ts"), /if \(listingType === "buy_now"\) return/);
  assert.doesNotMatch(source("src/components/listings/standard-product-detail.tsx"), /useCurrentTime/);
});
test("profile count respects existing owner list limit and never hydrates saved listings", () => {
  const saved = source("src/lib/services/saved.ts");
  const count = saved.slice(saved.indexOf("export async function getSavedCount"), saved.indexOf("export async function getSavedPage"));
  assert.match(count, /getCountFromServer[\s\S]*limit\(11\)/);
  assert.doesNotMatch(count, /getPublicListingDetail|getDocs/);
  assert.match(source("firestore.rules"), /allow list: if owns\(uid\) && request.query.limit <= 13/);
  const view = source("src/components/profile/profile-view.tsx");
  assert.doesNotMatch(view, /getSavedPage/); assert.match(view, /recentOpen && <TransactionHistory/);
  assert.match(source("src/components/profile/reputation-view.tsx"), /user\?\.uid !== uid \|\| !open/);
});
test("Follow optimism stays behind eligibility, locks duplicate taps and rolls back failed writes", () => {
  const view = source("src/components/profile/follow-seller-button.tsx");
  const require = view.indexOf("if (!await requireAction"), optimistic = view.indexOf("setState({ sellerId, viewer, following,"), write = view.indexOf("await setSellerFollow");
  assert.ok(require >= 0 && require < optimistic && optimistic < write);
  assert.match(view, /mutation.current = true/); assert.match(view, /setState\(current\)/);
  assert.match(view, /visibilityState === "visible" && !mutation.current/);
});
test("private status stays owner-only and standalone actions have visible interactive affordances", () => {
  const reputation = source("src/components/profile/reputation-view.tsx");
  assert.match(reputation, /if \(user\?\.uid !== uid\) return null/);
  assert.match(reputation, /props.publicSellerOnly \? <SellerReviews/);
  assert.doesNotMatch(reputation, /No tier yet|underline/);
  assert.match(reputation, /ChevronRight size=\{17\}/);
  assert.match(source("src/app/globals.css"), /\.owner-tier-help:focus-visible/);
  assert.match(source("src/components/auth/auth.module.css"), /\.check a[^{]*\{[^}]*text-decoration: underline/);
});
