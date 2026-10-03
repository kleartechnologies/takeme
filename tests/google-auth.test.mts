import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { friendlyAuthError } from "../src/lib/firebase/auth-errors.ts";
import { newPublicProfileFields, PROFILE_NAME_FALLBACK } from "../src/lib/firebase/profile-name.ts";

test("Google sign-in uses Firebase provider and the shared profile initializer", () => {
  const auth = readFileSync(new URL("../src/lib/firebase/auth.ts", import.meta.url), "utf8");
  const google = auth.slice(auth.indexOf("export async function loginWithGoogle"), auth.indexOf("export async function resetPassword"));
  assert.match(google, /signInWithPopup\(requireFirebase\(\)\.auth, new GoogleAuthProvider\(\)\)/);
  assert.match(google, /await createProfile\(credential\.user\)/);
  assert.match(auth, /await createProfileIfMissing\(services\.db, user, displayName\)/);

  const form = readFileSync(new URL("../src/components/auth/auth-form.tsx", import.meta.url), "utf8");
  assert.match(form, /mode !== "forgot"[\s\S]*Continue with Google/);
  assert.match(form, /await loginWithGoogle\(\); await resume\(\)/);
});

test("new Google profiles normalize provider names", () => {
  const user = { uid: "google-user", displayName: "  Aisha  ", photoURL: null };
  assert.equal(newPublicProfileFields(user).displayName, "Aisha");
  assert.equal(newPublicProfileFields({ ...user, displayName: "X" }).displayName, PROFILE_NAME_FALLBACK);
  assert.equal(newPublicProfileFields({ ...user, displayName: null }).displayName, PROFILE_NAME_FALLBACK);
  assert.equal(newPublicProfileFields({ ...user, displayName: "A".repeat(81) }).displayName, "A".repeat(80));
});

test("Google popup, provider conflict, network, and generic errors are actionable", () => {
  assert.match(friendlyAuthError({ code: "auth/popup-closed-by-user" }), /cancelled/i);
  assert.match(friendlyAuthError({ code: "auth/cancelled-popup-request" }), /cancelled/i);
  assert.match(friendlyAuthError({ code: "auth/popup-blocked" }), /popup/i);
  assert.match(friendlyAuthError({ code: "auth/account-exists-with-different-credential" }), /existing method/i);
  assert.match(friendlyAuthError({ code: "auth/network-request-failed" }), /internet connection/i);
  assert.match(friendlyAuthError({ code: "auth/operation-not-allowed" }), /not available/i);
  assert.match(friendlyAuthError({ code: "auth/internal-error" }), /couldn’t complete/i);
});
