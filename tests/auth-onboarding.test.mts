import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthNext, setupDestination, isAuthPath, isPendingResolutionPath } from "../src/lib/auth-routing.ts";
import { passwordPolicyHelp } from "../src/lib/firebase/password-policy.ts";

test("local return intent survives every setup stage without executing an action", () => {
  for (const path of ["/sell", "/saved", "/listings/demo?offer=1", "/listings/auction-demo", "/messages/demo?offer=1", "/sellers/demo", "/profile/settings"]) {
    assert.equal(safeAuthNext(path), path);
    for (const step of ["acceptance", "profile", "welcome"] as const) assert.equal(new URL(setupDestination(step, path), "https://takeme.invalid").searchParams.get("next"), path);
    assert.equal(setupDestination("ready", path), path);
    assert.equal(setupDestination("deletion", path), "/account-deletion");
  }
});
test("return targets reject external origins, controls, backslashes and setup loops", () => {
  for (const path of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/%5Cevil.test", "/%2f%2fevil.test", "/foo\nbar", "/%0aevil", "/login?next=/sell", "/onboarding/profile", "/%ZZ"]) assert.equal(safeAuthNext(path), "/explore");
  assert.equal(safeAuthNext("/foo/../login"), "/explore");
  assert.equal(safeAuthNext("/%6cogin?next=/sell"), "/explore");
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
