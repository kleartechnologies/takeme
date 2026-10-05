import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { currentPolicyAllowsWrite, isPendingResolutionMutation, isProtectedMarketplaceCallable } from "../src/lib/account-eligibility.ts";
import { protectedActionDestination } from "../src/lib/auth-routing.ts";

test("policy preflight fails closed for unknown/inactive/outdated state while onboarding profile uploads remain eligible", () => {
  for (const state of [null, { step: "ready" }, { step: "ready", policyAvailable: false }, { step: "acceptance", policyAvailable: true },
    { step: "deletion", policyAvailable: true }, { step: "malformed", policyAvailable: true }]) assert.equal(currentPolicyAllowsWrite(state), false);
  for (const step of ["profile", "welcome", "ready"]) assert.equal(currentPolicyAllowsWrite({ step, policyAvailable: true }), true);
});

test("all source marketplace mutation callable exports require frontend policy preflight", () => {
  const directory = new URL("../functions/src/", import.meta.url);
  let count = 0;
  for (const file of readdirSync(directory).filter(file => file.endsWith(".ts"))) {
    const source = readFileSync(new URL(file, directory), "utf8");
    for (const match of source.matchAll(/export const (\w+) = (marketplaceMutationCall|resolutionMutationCall)\(/g)) {
      assert.equal(isProtectedMarketplaceCallable(match[1]), true, `${file}: ${match[1]} must not bypass the preflight`);
      assert.equal(isPendingResolutionMutation(match[1]), match[2] === "resolutionMutationCall", `${file}: retain only the approved pending-resolution exceptions`);
      count++;
    }
  }
  assert.ok(count >= 34, "The audit must inspect the actual V1 mutation exports.");
});

test("public/owner read callables never acquire mutation preflight from their service name", () => {
  for (const name of ["getPublicListingPage", "getPublicListingDetail", "getPublicSellerSummaries", "getPublicReviews", "getConversation",
    "getConversationMessages", "getConversations", "getFollowing", "getFollowState", "getNotifications", "getSavedSearches", "getMyListingHistory"]) {
    assert.equal(isProtectedMarketplaceCallable(name), false);
    assert.equal(isPendingResolutionMutation(name), false);
  }
});

test("each explicit protected action returns only a checkpoint or permission; no deferred action is returned", () => {
  for (const [action, intended] of [
    ["Sell", "/sell"], ["Chat", "/listings/item?chat=1"], ["Offer", "/listings/item?offer=1"], ["Bid", "/listings/auction?bid=1#bid-history"],
    ["Save", "/explore?q=camera"], ["Follow", "/sellers/member"], ["Upload", "/profile/settings/edit"],
  ]) {
    const target = protectedActionDestination(true, { step: "acceptance", policyAvailable: true }, intended);
    assert.equal(typeof target, "string", action);
    const url = new URL(target!, "https://takeme.invalid");
    assert.equal(url.pathname, "/onboarding/acceptance", action);
    assert.equal(url.searchParams.get("next"), intended, action);
    assert.equal(protectedActionDestination(true, { step: "ready", policyAvailable: true }, intended), null, action);
  }
});

test("auth return parameters do not replay a write, and outdated conversation viewing cannot mark messages seen", () => {
  const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const product = source("components/listings/standard-product-detail.tsx");
  const auction = source("components/listings/auction-panel.tsx");
  const deals = source("components/messages/conversation-deals.tsx");
  const conversation = source("components/messages/conversation-view.tsx");
  // The only existing offer query behavior selects a form for an eligible user;
  // request submission remains in a guarded, explicit event handler.
  assert.match(deals, /setup\?\.step === "ready" && setup\.policyAvailable === true && makeOffer/);
  assert.match(deals, /if \(!await requireAction\(\)\) return;[\s\S]*if \(action === "send"\) await submitOffer/);
  assert.match(conversation, /if \(mayMarkSeen && document\.visibilityState/);
  assert.match(conversation, /const mayMarkSeen = setup\?\.step === "ready" && setup\.policyAvailable === true/);
  for (const value of [product, auction]) assert.doesNotMatch(value, /searchParams|get\("(?:offer|bid|chat)"\)/);
});
