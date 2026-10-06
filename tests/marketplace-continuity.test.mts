import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { RECOVERY_TTL_MS, clearRecovery, readRecovery, readRecoveryFiles, rememberRecoveryFiles, saveRecovery, syncRecoveryAccount, validRecoveryDraft } from "../src/lib/transient-recovery.ts";
import { pendingMessageSend } from "../src/lib/message-send-request.ts";
import { clearExploreContinuity, EXPLORE_CACHE_TTL_MS, mergeExplorePage, recallExplorePage, rememberExplorePage } from "../src/lib/explore-continuity.ts";
import type { RecoveryDraft } from "../src/lib/transient-recovery.ts";
const now = 10_000;
function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const sell: RecoveryDraft = { kind: "sell", step: 7, photoCount: 2, values: {
  title: "Synthetic recovery listing", categoryId: "electronics", condition: "Good", description: "Synthetic local recovery only, no real goods.", price: "80",
  districtOrCity: "Jitra", state: "Kedah", meetupLocationId: "synthetic-meetup", saveLocationToProfile: false,
  listingType: "buy_now", startingBid: "", minimumBidIncrement: "", auctionStartAt: "2026-10-12T10:00", auctionEndAt: "2026-10-13T10:00", startMode: "scheduled",
} };
const offer: RecoveryDraft = { kind: "offer", listingId: "synthetic-listing", amount: "75.50", method: "cod", sheet: "make", offerId: null };
test("Sell interruption restores every permitted field/step/photo count without inventing uploads", () => {
  const s = storage(); assert.equal(saveRecovery("/sell", "owner-a", sell, s, now), true);
  assert.deepEqual(readRecovery("/sell", "owner-a", s, now + 100), sell);
  assert.equal(readRecovery("/listings/another/edit", "owner-a", s, now), null);
  assert.equal(saveRecovery("/sell", null, sell, s, now), false);
  assert.equal(saveRecovery("/sell", "owner-a", { ...sell, values: { ...sell.values, saveLocationToProfile: true } }, s, now), false);
});
test("offer context survives acceptance, requires explicit confirmation and is listing scoped", () => {
  const s = storage(); saveRecovery("offer:conversation-a", "owner-a", offer, s, now);
  assert.deepEqual(readRecovery("offer:conversation-a", "owner-a", s, now), offer);
  assert.equal(readRecovery("offer:conversation-b", "owner-a", s, now), null);
  // An anonymous offer may be adopted once by the account completing the same tab's auth flow.
  saveRecovery("offer:guest", null, offer, s, now);
  assert.deepEqual(readRecovery("offer:guest", "owner-a", s, now), offer);
  assert.equal(readRecovery("offer:guest", "owner-b", s, now), null);
});
test("message recovery retains the logical retry key, edits obtain a new key and never send", () => {
  const s = storage(), key = "11111111-1111-4111-8111-111111111111";
  const request = pendingMessageSend(null, "owner-a", "chat-a", "Hello again", () => key);
  const draft: RecoveryDraft = { kind: "message", body: "Hello again", request };
  saveRecovery("message:chat-a", "owner-a", draft, s, now);
  const restored = readRecovery("message:chat-a", "owner-a", s, now);
  assert.equal(restored?.kind, "message"); if (restored?.kind !== "message") return;
  assert.deepEqual(pendingMessageSend(restored.request, "owner-a", "chat-a", restored.body), request);
  assert.notEqual(pendingMessageSend(restored.request, "owner-a", "chat-a", "Changed text").idempotencyKey, key);
  clearRecovery("message:chat-a", s); assert.equal(readRecovery("message:chat-a", "owner-a", s, now), null);
});
test("drafts expire, reject malformed/sensitive/oversized payloads and bound storage", () => {
  const s = storage(); saveRecovery("/sell", "owner-a", sell, s, now);
  assert.equal(readRecovery("/sell", "owner-a", s, now + RECOVERY_TTL_MS), null);
  for (const value of [{ ...offer, token: "must-never-persist" }, { kind: "bid", amount: "99" }, { kind: "message", body: "x".repeat(2001), request: null }]) assert.equal(validRecoveryDraft(value), false);
  for (let i = 0; i < 20; i++) saveRecovery("offer:" + i, "owner-a", offer, s, now);
  assert.equal(s.length, 8);
  assert.equal(readRecovery("offer:0", "owner-a", s, now), null);
});
test("reauthentication retains same-owner drafts; wrong account and explicit logout erase them", () => {
  const s = storage(); syncRecoveryAccount("owner-a", s); saveRecovery("/sell", "owner-a", sell, s, now);
  syncRecoveryAccount(null, s); syncRecoveryAccount("owner-a", s); assert.deepEqual(readRecovery("/sell", "owner-a", s, now), sell);
  syncRecoveryAccount("owner-b", s); assert.equal(readRecovery("/sell", "owner-a", s, now), null);
  saveRecovery("offer:b", "owner-b", offer, s, now); s.setItem("unrelated", "preserved"); clearRecovery(undefined, s);
  assert.equal(s.getItem("unrelated"), "preserved"); assert.equal(readRecovery("offer:b", "owner-b", s, now), null);
});
test("optional browser storage failures never block actions or logout", () => {
  const bad = { ...storage(), getItem: () => { throw Error("disabled"); }, setItem: () => { throw Error("quota"); } };
  assert.equal(saveRecovery("offer:x", "owner-a", offer, bad, now), false);
  assert.equal(readRecovery("offer:x", "owner-a", bad, now), null); assert.doesNotThrow(() => clearRecovery(undefined, bad));
});
test("photo references are owner scoped, bounded, memory only and expired/cleared", () => {
  const photo = new File(["synthetic"], "synthetic.png", { type: "image/png" });
  rememberRecoveryFiles("/sell", "owner-a", [photo], now);
  assert.equal(readRecoveryFiles("/sell", "owner-a", now)[0], photo);
  assert.deepEqual(readRecoveryFiles("/sell", "owner-b", now), []);
  assert.deepEqual(readRecoveryFiles("/sell", "owner-a", now + RECOVERY_TTL_MS), []);
  rememberRecoveryFiles("/sell", "owner-a", Array(9).fill(photo), now); assert.deepEqual(readRecoveryFiles("/sell", "owner-a", now), []);
  rememberRecoveryFiles("/sell", "owner-a", [photo], now); clearRecovery("/sell"); assert.deepEqual(readRecoveryFiles("/sell", "owner-a", now), []);
});
test("Explore preserves loaded pages and exact history/query context, bounds/expiry gracefully discard snapshots", () => {
  clearExploreContinuity(); const page = { listings: ["item-a", "item-b"], cursor: "cursor-a", hasMore: true };
  rememberExplorePage("history-a:query/filter/sort-a", page, 1024, now);
  assert.deepEqual(recallExplorePage("history-a:query/filter/sort-a", now), { scrollY: 1024, page });
  assert.equal(recallExplorePage("history-b:query/filter/sort-a", now), null);
  assert.equal(recallExplorePage("history-a:other-filter", now), null);
  assert.equal(recallExplorePage("history-a:query/filter/sort-a", now + EXPLORE_CACHE_TTL_MS), null);
  for (let i = 0; i < 10; i++) rememberExplorePage(String(i), page, i, now);
  assert.equal(recallExplorePage("0", now), null); assert.ok(recallExplorePage("9", now));
  clearExploreContinuity(); assert.equal(recallExplorePage("9", now), null);
});
test("retried Explore pagination retains prior results, removes duplicates and uses the fresh cursor", () => {
  assert.deepEqual(mergeExplorePage({ listings: [{ id: "a" }, { id: "b" }] }, { listings: [{ id: "b" }, { id: "c" }], cursor: "fresh", hasMore: false }),
    { listings: [{ id: "a" }, { id: "b" }, { id: "c" }], cursor: "fresh", hasMore: false });
});
test("recovery wiring retains fresh auction confirmation, context-only Save/Follow and existing legal guards", () => {
  const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const auction = source("src/components/listings/auction-panel.tsx");
  assert.match(auction, /requireAction\(`\/listings\/\$\{listing.id\}\?bid=1#bid-history`\)/);
  assert.match(auction, /async function submitBid[\s\S]*requireAction\([\s\S]*placeAuctionBid\(listing.id, amountSen\)/);
  assert.match(auction, /setAmount\(senToRinggit\(minimum\)\)/); assert.doesNotMatch(auction, /saveRecovery|useTransientDraft/);
  const hook = source("src/lib/use-transient-draft.ts"); assert.doesNotMatch(hook, /httpsCallable|submitOffer|placeAuctionBid|sendConversationMessage|publishListing/);
  assert.match(source("src/components/forms/sell-form.tsx"), /if \(recoveryReady && user && !result\) rememberRecoveryFiles/);
  assert.match(source("src/lib/firebase/auth.ts"), /await signOut[\s\S]*clearRecovery\(\)/);
});
