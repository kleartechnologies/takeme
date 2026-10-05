import assert from "node:assert/strict";
import test from "node:test";
import { MARKETPLACE_HOME, accountRouteRequiresSetup, authenticationDestination, hasProtectedAuthIntent, isProtectedMarketplaceRoute, protectedActionDestination, safeAuthNext, setupDestination, welcomeDestinations, isAuthPath, isPendingResolutionPath, type SetupStep } from "../src/lib/auth-routing.ts";
import { passwordPolicyHelp } from "../src/lib/firebase/password-policy.ts";

function setupJourney(intent: string | null | undefined, steps: SetupStep[]) {
  let next = intent;
  for (const step of steps) {
    const destination = new URL(setupDestination(step, next), "https://takeme.invalid");
    assert.equal(destination.pathname, `/onboarding/${step}`);
    next = destination.searchParams.get("next");
  }
  return setupDestination("ready", next);
}

test("normal email signup routes profile and welcome to Explore without a return target", () => {
  assert.equal(MARKETPLACE_HOME, "/explore");
  assert.equal(setupJourney(undefined, ["profile", "welcome"]), "/explore");
});

test("normal Google signup routes acceptance, profile and welcome to Explore without a return target", () => {
  assert.equal(setupJourney(null, ["acceptance", "profile", "welcome"]), "/explore");
});

const explicitIntents = [
  ["Sell", "/sell"],
  ["offer", "/listings/product-demo?offer=1#listing-actions"],
  ["Product Detail", "/listings/product-demo?from=explore#description"],
  ["Chat", "/messages/chat-demo?offer=1#message-body"],
  ["Bid", "/listings/auction-demo?bid=1#bidding"],
  ["Save listing", "/listings/saved-demo?from=explore#listing-actions"],
  ["Saved hub", "/saved?tab=auctions#saved-items"],
  ["Follow seller", "/sellers/seller-demo?from=following#seller-listings"],
  ["Settings", "/profile/settings?from=updates#account-actions"],
] as const;

for (const [scenario, path] of explicitIntents) test(`explicit ${scenario} return context survives setup with its query and fragment`, () => {
  assert.equal(safeAuthNext(path), path);
  assert.equal(setupJourney(path, ["acceptance", "profile", "welcome"]), path);
  assert.equal(setupDestination("deletion", path), "/account-deletion");
});

test("returning login defaults to Explore and preserves an explicit destination", () => {
  for (const absent of [undefined, null, ""]) assert.equal(setupDestination("ready", absent), "/explore");
  for (const [, path] of explicitIntents) assert.equal(setupDestination("ready", path), path);
});

test("normal welcome offers Start Exploring as the primary destination and an explicit Sell choice", () => {
  for (const absent of [undefined, null, "", "/explore"]) assert.deepEqual(welcomeDestinations(absent), {
    explore: "/explore", secondary: { label: "Sell Something", destination: "/sell" },
  });
});

test("welcome keeps Explore available while a separate choice resumes explicit marketplace context", () => {
  for (const [, path] of [...explicitIntents, ["filtered Explore", "/explore?q=camera&type=auction#results"]] as const) {
    const destinations = welcomeDestinations(path);
    assert.equal(destinations.explore, "/explore");
    assert.deepEqual(destinations.secondary, { label: "Continue where you left off", destination: path });
    assert.equal(setupDestination("ready", destinations.explore), "/explore");
    assert.equal(setupDestination("ready", destinations.secondary.destination), path);
  }
});

test("return targets reject external origins, controls, backslashes and setup loops", () => {
  for (const path of [undefined, null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5Cevil.test", "/%2f%2fevil.test", "/foo\nbar", "/%0aevil", "/login?next=/sell", "/register?next=/sell", "/onboarding/profile", "/foo/../login", "/%6cogin?next=/sell", "/%ZZ"]) {
    assert.equal(safeAuthNext(path), "/explore");
    assert.equal(setupJourney(path, ["acceptance", "profile", "welcome"]), "/explore");
    assert.deepEqual(welcomeDestinations(path), { explore: "/explore", secondary: { label: "Sell Something", destination: "/sell" } });
  }
  assert.equal(isAuthPath("/profile"), false);
});
test("pending accounts retain deletion and existing resolution destinations", () => {
  for (const path of ["/account-deletion", "/profile/transactions", "/transactions/example", "/messages/example"]) assert.ok(isPendingResolutionPath(path));
  for (const path of ["/sell", "/saved", "/profile/settings", "/transactions-fake"]) assert.equal(isPendingResolutionPath(path), false);
});
test("signup helper reflects the real configured password criteria", () => {
  const policy = { customStrengthOptions: { minPasswordLength: 6 }, allowedNonAlphanumericCharacters: "", enforcementState: "ENFORCE", forceUpgradeOnSignin: false };
  assert.equal(passwordPolicyHelp(policy), "Use at least 6 characters.");
  assert.match(passwordPolicyHelp({ ...policy, customStrengthOptions: { minPasswordLength: 10, containsNumericCharacter: true, containsUppercaseLetter: true } }), /10 characters, an uppercase letter, a number/);
});

const publicReadPaths = ["/", "/explore", "/categories", "/for-you", "/listings/item-1", "/sellers/member-1", "/help/tiers"];
test("signed-in missing/outdated acceptance retains public browsing without establishing consent", () => {
  for (const path of publicReadPaths) {
    assert.equal(accountRouteRequiresSetup(path, { step: "acceptance", policyAvailable: true }), false);
    assert.equal(accountRouteRequiresSetup(path, { step: "acceptance", policyAvailable: false }), false);
    assert.equal(isProtectedMarketplaceRoute(path), false);
  }
  // Existing own records/read surfaces are not new blanket acceptance gates.
  for (const path of ["/saved", "/following", "/updates", "/profile", "/messages/existing", "/profile/transactions"]) {
    assert.equal(accountRouteRequiresSetup(path, { step: "acceptance", policyAvailable: true }), false);
  }
});

test("Sell/edit/promote retain a page-level setup checkpoint while returning public login can browse", () => {
  const outdated = { step: "acceptance" as const, policyAvailable: true };
  for (const path of ["/sell", "/listings/item-1/edit", "/listings/item-1/promote"]) {
    assert.equal(accountRouteRequiresSetup(path, outdated), true);
    assert.equal(authenticationDestination(outdated, path), setupDestination("acceptance", path));
    assert.equal(accountRouteRequiresSetup(path, { step: "ready", policyAvailable: true }), false);
  }
  assert.equal(authenticationDestination(outdated), "/explore");
  for (const path of publicReadPaths) assert.equal(authenticationDestination(outdated, path), path);
});

test("fresh email/Google authentication still follows acceptance, profile and welcome", () => {
  for (const step of ["acceptance", "profile", "welcome"] as const) {
    assert.equal(authenticationDestination({ step, policyAvailable: true }, undefined, true), setupDestination(step, "/explore"));
  }
  assert.equal(authenticationDestination({ step: "ready", policyAvailable: true }, undefined, true), "/explore");
});

test("explicit protected auth intents require policy checkpoint and preserve context without actions", () => {
  for (const [, path] of explicitIntents) {
    const checkpoint = authenticationDestination({ step: "acceptance", policyAvailable: true }, path, false, true);
    assert.equal(checkpoint, setupDestination("acceptance", path));
    assert.equal(authenticationDestination({ step: "ready", policyAvailable: true }, path, false, true), path);
    const login = new URL(protectedActionDestination(false, null, path)!, "https://takeme.invalid");
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("next"), path);
    assert.equal(login.searchParams.get("intent"), "write");
  }
  for (const action of ["write", "sell", "chat", "offer", "bid", "save", "follow", "upload"]) assert.equal(hasProtectedAuthIntent(action), true);
  for (const value of [undefined, null, "", "browse", "SAVE", "everyone"]) assert.equal(hasProtectedAuthIntent(value), false);
});

test("unknown/inactive account policy cannot execute a protected action, but public return does not imply consent", () => {
  for (const state of [null, { step: "ready" as const }, { step: "ready" as const, policyAvailable: false }, { step: "acceptance" as const, policyAvailable: true }]) {
    assert.equal(protectedActionDestination(true, state, "/listings/item-1?offer=1"), setupDestination("acceptance", "/listings/item-1?offer=1"));
  }
  assert.equal(protectedActionDestination(true, { step: "ready", policyAvailable: true }, "/listings/item-1?offer=1"), null);
  assert.equal(authenticationDestination({ step: "acceptance", policyAvailable: false }, "/explore"), "/explore");
});

test("pending deletion restrictions remain stronger than public browsing exemptions", () => {
  const pending = { step: "deletion" as const };
  for (const path of publicReadPaths) {
    assert.equal(accountRouteRequiresSetup(path, pending), true);
    assert.equal(authenticationDestination(pending, path), "/account-deletion");
    assert.equal(protectedActionDestination(true, pending, path), "/account-deletion");
  }
  for (const path of ["/messages/existing", "/transactions/existing", "/profile/transactions"]) assert.equal(accountRouteRequiresSetup(path, pending), false);
});
