const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const { resolvePolicyContext, policyMirrorMatches, hasCurrentAcceptance } = require("../lib/account-eligibility");
const { demoReleasePolicy, productionReleasePolicy, validateProductionPolicy, assertStoragePolicyRules, assertFirestorePolicyRules } = require("../lib/release-policy");
const demo = { GCLOUD_PROJECT: "demo-takeme", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" };

test("demo policy is pinned to explicit matching runtime and emulator configuration", () => {
  assert.equal(resolvePolicyContext(demo, "demo-takeme").target, "demo");
  for (const patch of [{ GCLOUD_PROJECT: "demo-other" }, { GOOGLE_CLOUD_PROJECT: "other" }, { GCP_PROJECT: "other" }, { TAKEME_RELEASE_TARGET: "unexpected" }, { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_FIREBASE_PROJECT_ID: "other" }, { FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080" }, { FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:19199" }, { FIREBASE_CONFIG: JSON.stringify({ projectId: "other" }) }, { FIREBASE_CONFIG: "not-json" }]) {
    assert.equal(resolvePolicyContext({ ...demo, ...patch }, "demo-takeme"), null);
  }
  assert.equal(resolvePolicyContext(demo, "other"), null);
});
test("production stays fail-closed without approval and final versions; stale emulator context is refused", () => {
  assert.ok(validateProductionPolicy().length);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null);
  assert.equal(productionReleasePolicy.privacyVersion, null);
  const production = { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "approved-test-project", GCLOUD_PROJECT: "approved-test-project" };
  assert.equal(resolvePolicyContext(production, "approved-test-project"), null);
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "PUBSUB_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR"]) {
    assert.equal(resolvePolicyContext({ ...production, [name]: "" }, "approved-test-project"), null);
  }
  for (const version of ["1.0-draft", "demo-1", "TEST-final"]) assert.ok(validateProductionPolicy({ publicationApproved: true, termsVersion: version, privacyVersion: "1.0", minimumAge: 18 }).length);
  assert.deepEqual(validateProductionPolicy({ publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 }), []);
});
test("a copied, revoked, incomplete or wrong-version mirror cannot enable marketplace actions", () => {
  const context = resolvePolicyContext(demo, "demo-takeme");
  const mirror = { ...demoReleasePolicy, projectId: "demo-takeme", releaseTarget: "demo" };
  assert.equal(policyMirrorMatches(mirror, context), true);
  for (const patch of [{ publicationApproved: false }, { projectId: "other" }, { releaseTarget: "production" }, { termsVersion: "wrong" }, { privacyVersion: null }, { minimumAge: 17 }]) assert.equal(policyMirrorMatches({ ...mirror, ...patch }, context), false);
  assert.equal(policyMirrorMatches(mirror, null), false);
});
test("eligibility requires current server timestamps, age confirmation and unrevoked acceptance", () => {
  const timestamp = { toMillis: () => 1 };
  const acceptance = { termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion, termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" };
  assert.equal(hasCurrentAcceptance(acceptance, demoReleasePolicy), true);
  for (const patch of [{ termsVersion: "old" }, { privacyVersion: "old" }, { revokedAt: timestamp }, { age18ConfirmedAt: false }, { termsAcceptedAt: { toMillis: () => NaN } }, { acceptanceSource: "client" }]) assert.equal(hasCurrentAcceptance({ ...acceptance, ...patch }, demoReleasePolicy), false);
  assert.equal(hasCurrentAcceptance(acceptance, productionReleasePolicy), false);
});
test("checked-in Firestore and Storage gates exactly match the central policy source", () => {
  const storage = readFileSync(require.resolve("../../storage.rules"), "utf8");
  const firestore = readFileSync(require.resolve("../../firestore.rules"), "utf8");
  assert.doesNotThrow(() => assertStoragePolicyRules(storage));
  assert.doesNotThrow(() => assertFirestorePolicyRules(firestore));
  assert.throws(() => assertStoragePolicyRules(storage.replace('"1.0-draft"', '"wrong"')));
  assert.throws(() => assertFirestorePolicyRules(firestore.replace("|| false", "|| true")));
});
