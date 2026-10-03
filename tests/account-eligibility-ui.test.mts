import assert from "node:assert/strict";
import { test } from "node:test";
import { eligibilityMessage, eligibilityReason } from "../src/lib/account-eligibility.ts";
import { friendlyAuthError } from "../src/lib/firebase/auth-errors.ts";
import { safeAuthNext, setupDestination } from "../src/lib/auth-routing.ts";

test("server acceptance rejection is friendly and preserves each marketplace intent", () => {
  const error = { code: "functions/failed-precondition", message: "internal authorization failure", details: { reason: "account-policy-required", step: "acceptance" } };
  assert.equal(eligibilityReason(error), "account-policy-required");
  assert.match(friendlyAuthError(error), /18 or older.*current policies/);
  for (const intent of ["/sell", "/listing/auction-fixture?bid=1", "/listing/product-fixture#offer", "/messages/conversation-fixture"]) {
    const destination = setupDestination("acceptance", intent);
    assert.equal(new URL(destination, "https://takeme.invalid").searchParams.get("next"), intent);
    assert.equal(setupDestination("ready", intent), intent);
  }
});
test("unapproved policy release and unrelated authorization errors are distinguished", () => {
  const unavailable = { details: { reason: "policy-release-unavailable" } };
  assert.match(eligibilityMessage(unavailable)!, /awaiting launch approval/);
  for (const error of [null, "account-policy-required", { details: { reason: "other" } }, { code: "permission-denied" }]) assert.equal(eligibilityReason(error), null);
  assert.equal(safeAuthNext("https://attacker.invalid/sell"), "/explore");
});
test("deletion owner changes require fresh confirmation without exposing account details", () => {
  const error = { code: "functions/failed-precondition", message: "private identity details", details: { reason: "account-changed" } };
  const message = friendlyAuthError(error);
  assert.match(message, /signed-in account changed.*confirm your identity again/);
  assert.doesNotMatch(message, /private identity details/);
  assert.match(friendlyAuthError({ details: { reason: "account-setup-changed" } }), /current account before continuing account setup/);
});
