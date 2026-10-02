import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { conversationDealState, offerIsOpen, offerLabels, messageTime } from "../src/lib/messaging-presentation.ts";
import type { MarketplaceOffer, MarketplaceTransaction } from "../src/types/marketplace.ts";

const source = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const conversation = { listingId: "listing", buyerId: "buyer", sellerId: "seller" };
const offer = (extra = {}) => ({ ...conversation, id: "offer", status: "submitted", expiresAt: "2026-10-03T00:00:00Z", ...extra } as MarketplaceOffer);
test("seller aggregate offers are narrowed to the exact conversation participants and listing", () => {
  const state = conversationDealState(conversation, { offers: [offer(), offer({ buyerId: "unrelated" }), offer({ sellerId: "other" }), offer({ listingId: "other" })], transaction: { ...conversation, buyerId: "unrelated" } as MarketplaceTransaction });
  assert.deepEqual(state.offers.map((item) => item.id), ["offer"]);
  assert.equal(state.transaction, null);
  const transaction = { ...conversation, id: "deal" } as MarketplaceTransaction;
  assert.equal(conversationDealState(conversation, { offers: [], transaction }).transaction?.id, "deal");
});
test("only existing open offer statuses expose actions, never expired or terminal requests", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  assert.ok(offerIsOpen(offer(), now));
  assert.ok(offerIsOpen(offer({ status: "countered" }), now));
  for (const status of ["accepted", "rejected", "withdrawn", "expired"]) assert.equal(offerIsOpen(offer({ status }), now), false);
  assert.equal(offerIsOpen(offer({ expiresAt: "2026-10-01T00:00:00Z" }), now), false);
  assert.equal(offerIsOpen(offer({ expiresAt: "invalid" }), now), false);
  assert.equal(offerLabels.rejected, "Offer declined");
  assert.equal(messageTime(null, now), "");
});
test("chat retains callable authorization, public identity, private participant scope and guarded submissions", () => {
  const chat = source("src/components/messages/conversation-view.tsx");
  const deals = source("src/components/messages/conversation-deals.tsx");
  assert.match(chat, /getConversation\(id\), getConversationMessages\(id\)/);
  assert.match(chat, /getPublicSellerSummary\(next.otherId\)/);
  assert.match(chat, /conversationDealState\(next/);
  assert.match(chat, /key=\{`\$\{user.uid\}:\$\{id\}`\}/);
  assert.match(chat, /sendRequest.current/);
  assert.match(deals, /inFlight.current/);
  assert.match(deals, /respondToOffer\(selected!\.id, action/);
  assert.match(deals, /submitOffer\(conversation.listingId, "offer", method/);
  assert.match(deals, /transaction.status === "completed"/);
  assert.doesNotMatch(chat + deals, /getUserProfile|getTrustSummary|createProtectedPayment|confirmTransactionCompletion|uploadBytes|readReceipt|trackingNumber/);
  assert.match(chat, /clearInterval\(interval\)/);
  assert.match(chat, /removeEventListener\("visibilitychange", update\)/);
  assert.match(deals, /No payment was taken by TAKEME/);
  assert.match(deals, /A price agreement, not a payment or completed sale/);
});
test("messaging uses scoped styles, named shared sheets and supported five-tab navigation", () => {
  const shell = source("src/components/messages/messaging-shell.tsx");
  const css = source("src/components/messages/messaging.module.css");
  assert.match(shell, /key=\{user\?\.uid/);
  assert.match(css, /grid-template-columns: 360px minmax\(0,1fr\)/);
  assert.match(css, /100dvh/);
  assert.match(source("src/components/messages/conversation-deals.tsx"), /ActionSheet key=\{sheet\} title=\{title\}/);
  const nav = source("src/components/layout/mobile-nav.tsx");
  assert.equal((nav.match(/href: "/g) ?? []).length, 5);
  assert.doesNotMatch(nav, /href: "\/messages"/);
});
