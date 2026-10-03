import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newPublicProfileFields, normalizeProviderDisplayName, PROFILE_NAME_FALLBACK, validateSignupDisplayName } from "../src/lib/firebase/profile-name.ts";

test("profile setup preserves valid trimmed names from two through eighty characters", () => {
  assert.equal(validateSignupDisplayName("AB"), "AB");
  assert.equal(validateSignupDisplayName("  Aminah Lee  "), "Aminah Lee");
  assert.equal(validateSignupDisplayName("A".repeat(80)), "A".repeat(80));
  assert.equal(validateSignupDisplayName("  👩🏽‍💻 Seller  "), "👩🏽‍💻 Seller");
});

test("profile setup rejects overlong and too-short names before saving", () => {
  assert.throws(() => validateSignupDisplayName("A".repeat(81)), /2–80 characters/);
  assert.throws(() => validateSignupDisplayName("  A  "), /2–80 characters/);
  assert.throws(() => validateSignupDisplayName("   "), /2–80 characters/);
  const source = readFileSync(new URL("../src/components/auth/account-onboarding.tsx", import.meta.url), "utf8");
  assert.ok(source.indexOf("validateSignupDisplayName(name)") < source.indexOf("await updatePublicProfile("));
  const auth = readFileSync(new URL("../src/lib/firebase/auth.ts", import.meta.url), "utf8");
  assert.match(auth, /registerWithEmail\(email: string, password: string\)/);
});

test("provider names are trimmed, bounded, and use a deterministic fallback", () => {
  assert.equal(normalizeProviderDisplayName("  Aminah Lee  "), "Aminah Lee");
  assert.equal(normalizeProviderDisplayName("A".repeat(80)), "A".repeat(80));
  assert.equal(normalizeProviderDisplayName("A".repeat(81)), "A".repeat(80));
  assert.equal(normalizeProviderDisplayName(null), PROFILE_NAME_FALLBACK);
  assert.equal(normalizeProviderDisplayName("   "), PROFILE_NAME_FALLBACK);
  assert.equal(normalizeProviderDisplayName(" A "), PROFILE_NAME_FALLBACK);
  assert.equal(normalizeProviderDisplayName("A" + " ".repeat(80) + "B"), PROFILE_NAME_FALLBACK);
});

test("provider profile creation fields conform to the public profile schema", () => {
  const provider = { uid: "provider-uid", displayName: "  X  ", photoURL: null };
  assert.deepEqual(newPublicProfileFields(provider), {
    uid: "provider-uid", displayName: PROFILE_NAME_FALLBACK, photoURL: null, location: "",
  });
  assert.equal(newPublicProfileFields({ ...provider, displayName: "  Aminah  " }).displayName, "Aminah");
  assert.equal(newPublicProfileFields(provider, "  Chosen Name  ").displayName, "Chosen Name");
});
