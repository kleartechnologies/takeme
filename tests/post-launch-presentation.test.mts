import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { listingSaveAction } from "../src/lib/listing-save-presentation.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const start = Date.parse("2026-10-12T10:00:00Z");
const end = start + 3_600_000;
const auction = { listingType: "auction" as const, status: "active" as const, auctionStatus: "active" as const, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(end).toISOString() };

test("Settings legal labels are neutral and retain the existing legal routes", () => {
  for (const path of ["src/components/settings/settings-shell.tsx", "src/components/profile/account-settings.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /draft|publication|legal review/i);
    assert.match(source, /Terms of Service/);
    assert.match(source, /Privacy Notice/);
    for (const route of ["/terms", "/privacy", "/account-deletion", "/profile/settings/help"]) assert.ok(source.includes(`"${route}"`), route);
  }
  const privacy = read("src/components/settings/settings-information.tsx");
  assert.doesNotMatch(privacy, /policy draft|Privacy Policy draft|business and legal review/i);
  assert.match(privacy, /href="\/privacy">Read Privacy Notice/);
});

test("published scheduled, live and ending-soon auctions retain Save", () => {
  for (const now of [start - 1, start, end - 1]) assert.equal(listingSaveAction(auction, false, now), "save");
  assert.equal(listingSaveAction({ ...auction, auctionStatus: "scheduled" }, false, 0), "save");
  assert.equal(listingSaveAction(auction, true, start), "remove");
});

test("terminal auctions hide Save for both unsaved and already saved detail states", () => {
  for (const listing of [{ ...auction, auctionStatus: "ended" as const }, { ...auction, auctionStatus: "cancelled" as const }, ...(["ended", "sold", "removed", "draft"] as const).map(status => ({ ...auction, status }))]) {
    for (const saved of [false, true]) assert.equal(listingSaveAction(listing, saved, start), null);
  }
  // Winner/lost outcomes have the same terminal listing state; viewer identity cannot reopen Save.
  assert.equal(listingSaveAction({ ...auction, status: "ended", auctionStatus: "ended" }, false, 0), null);
  assert.equal(listingSaveAction({ ...auction, listingType: "buy_now_and_auction", auctionStatus: "ended" }, false, start), null);
});

test("end-time boundary prevents a Save after an eligibility check delays the action", () => {
  assert.equal(listingSaveAction(auction, false, end - 1), "save");
  assert.equal(listingSaveAction(auction, false, end), null);
  assert.equal(listingSaveAction(auction, false, end + 1), null);
});

test("Saved history permits removing a terminal save, then cannot re-save it", () => {
  for (const auctionStatus of ["ended", "cancelled"] as const) {
    const terminal = { ...auction, auctionStatus };
    assert.equal(listingSaveAction(terminal, true, end, true), "remove");
    assert.equal(listingSaveAction(terminal, false, end, true), null);
  }
  assert.equal(listingSaveAction({ ...auction, listingType: "buy_now" }, false, end), "save");
});

test("shared Save control checks current auction state before and after eligibility without backend changes", () => {
  const button = read("src/components/saved/save-button.tsx");
  assert.match(button, /if \(!listingSaveAction\(listing, displaySaved, now, allowTerminalRemoval\)\) return null/);
  const guard = "listingSaveAction(currentListing.current, displaySaved, Date.now(), allowTerminalRemoval)";
  assert.equal(button.split(guard).length - 1, 2);
  assert.ok(button.indexOf("if (!action) return") < button.indexOf("await saveListing(listingId)"));
  assert.match(button, /else await removeSavedListing\(listingId\)/);
  assert.match(read("src/components/listings/standard-product-detail.tsx"), /<SaveButton listingId=\{listing.id\} listing=\{listing\} compact/);
  assert.match(read("src/components/listings/listing-card.tsx"), /listing=\{listing\} allowTerminalRemoval initialSaved/);
});
