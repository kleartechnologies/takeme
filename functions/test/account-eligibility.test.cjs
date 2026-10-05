const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const { resolvePolicyContext, policyMirrorMatches, hasCurrentAcceptance } = require("../lib/account-eligibility");
const { demoReleasePolicy, stagingReleasePolicy, productionReleasePolicy, getReleasePolicy, validateProductionPolicy, assertStoragePolicyRules, assertFirestorePolicyRules } = require("../lib/release-policy");
const { stagingEnvironment } = require("../lib/staging-environment");
const demo = { GCLOUD_PROJECT: "demo-takeme", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" };
const staging = () => ({ GCLOUD_PROJECT: stagingEnvironment.projectId, TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId });
const stagingContext = env => resolvePolicyContext(env, stagingEnvironment.projectId, stagingEnvironment.storageBucket);

test("demo policy is pinned to explicit matching runtime and emulator configuration", () => {
  assert.equal(resolvePolicyContext(demo, "demo-takeme").target, "demo");
  for (const patch of [{ GCLOUD_PROJECT: "demo-other" }, { GOOGLE_CLOUD_PROJECT: "other" }, { GCP_PROJECT: "other" }, { TAKEME_RELEASE_TARGET: "unexpected" }, { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_FIREBASE_PROJECT_ID: "other" }, { FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080" }, { FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:19199" }, { FIREBASE_CONFIG: JSON.stringify({ projectId: "other" }) }, { FIREBASE_CONFIG: "not-json" }]) {
    assert.equal(resolvePolicyContext({ ...demo, ...patch }, "demo-takeme"), null);
  }
  assert.equal(resolvePolicyContext(demo, "other"), null);
});
test("source production approval remains inactive and unconfirmed production resources are refused", () => {
  assert.ok(validateProductionPolicy().length);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, "1.0");
  assert.equal(productionReleasePolicy.privacyVersion, "1.0");
  const production = { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "approved-test-project", GCLOUD_PROJECT: "approved-test-project" };
  assert.equal(resolvePolicyContext(production, "approved-test-project"), null);
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "PUBSUB_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR"]) {
    assert.equal(resolvePolicyContext({ ...production, [name]: "" }, "approved-test-project"), null);
  }
  for (const version of ["1.0-draft", "demo-1", "TEST-final", "1.0-staging", "STAGING-final"]) assert.ok(validateProductionPolicy({ publicationApproved: true, termsVersion: version, privacyVersion: "1.0", minimumAge: 18 }).length);
  assert.deepEqual(validateProductionPolicy({ publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 }), []);
});
test("staging policies are distinct from demo acceptance and can never qualify production", () => {
  assert.equal(getReleasePolicy("staging"), stagingReleasePolicy);
  assert.equal(stagingReleasePolicy.termsVersion, "1.0-staging");
  assert.ok(validateProductionPolicy(stagingReleasePolicy).length);
  const timestamp = { toMillis: () => 1 };
  const acceptance = { termsVersion: stagingReleasePolicy.termsVersion, privacyVersion: stagingReleasePolicy.privacyVersion, termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" };
  assert.equal(hasCurrentAcceptance(acceptance, stagingReleasePolicy), true);
  assert.equal(hasCurrentAcceptance(acceptance, demoReleasePolicy), false);
  assert.equal(hasCurrentAcceptance({ ...acceptance, termsVersion: demoReleasePolicy.termsVersion }, stagingReleasePolicy), false);
});
test("staging policy context requires matching managed runtime, exact Admin project and bucket", () => {
  assert.equal(stagingContext(staging()).target, "staging");
  assert.equal(stagingContext({ ...staging(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", FIREBASE_CONFIG: JSON.stringify({ projectId: stagingEnvironment.projectId, storageBucket: stagingEnvironment.storageBucket }) }).target, "staging");
  for (const key of ["GCLOUD_PROJECT", "TAKEME_RELEASE_TARGET", "TAKEME_FIREBASE_PROJECT_ID"]) {
    const env = staging(); delete env[key]; assert.equal(stagingContext(env), null);
  }
  for (const patch of [{ GCLOUD_PROJECT: "takeme-52b80" }, { GOOGLE_CLOUD_PROJECT: "takeme-52b80" }, { GCP_PROJECT: "other-project" }, { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80" }, { TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app" }, { TAKEME_STORAGE_BUCKETS: stagingEnvironment.projectId + ".appspot.com" }, { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, { TAKEME_DELETION_ENVIRONMENT: "production" }, { TAKEME_ENABLE_STAGING_DELETION: "TRUE" }, { FIREBASE_CONFIG: "not-json" }, { FIREBASE_CONFIG: "null" }, { FIREBASE_CONFIG: "[]" }, { FIREBASE_CONFIG: JSON.stringify({ projectId: null }) }, { FIREBASE_CONFIG: JSON.stringify({ projectId: "takeme-52b80" }) }, { FIREBASE_CONFIG: JSON.stringify({ storageBucket: "takeme-52b80.firebasestorage.app" }) }]) {
    assert.equal(stagingContext({ ...staging(), ...patch }), null);
  }
  for (const project of [undefined, "demo-takeme", "takeme-52b80"]) assert.equal(resolvePolicyContext(staging(), project, stagingEnvironment.storageBucket), null);
  for (const bucket of [undefined, "demo-takeme.firebasestorage.app", "takeme-52b80.firebasestorage.app"]) assert.equal(resolvePolicyContext(staging(), stagingEnvironment.projectId, bucket), null);
});
test("staging rejects every emulator override even empty or false overrides", () => {
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "PUBSUB_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR", "FIREBASE_EMULATORS", "CUSTOM_EMULATOR_URL"]) {
    for (const value of ["", "false", "127.0.0.1:8080"]) assert.equal(stagingContext({ ...staging(), [name]: value }), null);
  }
  for (const value of ["true", "", "FALSE"]) assert.equal(stagingContext({ ...staging(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS: value }), null);
});
test("staging mirrors reject copied demo or production approval, revoked and mismatched versions", () => {
  const context = stagingContext(staging());
  const mirror = { ...stagingReleasePolicy, projectId: stagingEnvironment.projectId, releaseTarget: "staging" };
  assert.equal(policyMirrorMatches(mirror, context), true);
  for (const patch of [{ publicationApproved: false }, { projectId: "takeme-52b80" }, { projectId: "demo-takeme" }, { releaseTarget: "production" }, { releaseTarget: "demo" }, { termsVersion: "1.0-draft" }, { privacyVersion: "1.0" }, { minimumAge: 17 }]) assert.equal(policyMirrorMatches({ ...mirror, ...patch }, context), false);
  assert.equal(policyMirrorMatches(mirror, resolvePolicyContext(demo, "demo-takeme")), false);
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
