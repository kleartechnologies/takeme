const assert = require("node:assert/strict");
const test = require("node:test");
const { resolvePolicyContext, policyMirrorMatches, hasCurrentAcceptance } = require("../lib/account-eligibility");
const { releasePolicyFromMirror } = require("../lib/policy-runtime");
const { productionEnvironment } = require("../lib/production-environment");
const { demoReleasePolicy, stagingReleasePolicy, productionReleasePolicy, validateProductionPolicy } = require("../lib/release-policy");
const { stagingEnvironment } = require("../lib/staging-environment");
const { planProductionPolicyBootstrap } = require("../lib/production-policy-bootstrap");
const { qualifyDeletionExecution } = require("../lib/deletion-config");
const { validateAcceptance } = require("../lib/auth-onboarding");

const production = () => ({ GCLOUD_PROJECT: productionEnvironment.projectId, TAKEME_RELEASE_TARGET: "production",
  TAKEME_FIREBASE_PROJECT_ID: productionEnvironment.projectId, TAKEME_STORAGE_BUCKETS: productionEnvironment.storageBucket,
  TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "false" });
const contextFor = env => resolvePolicyContext(env, productionEnvironment.projectId, productionEnvironment.storageBucket);
// Final-shaped identifiers only exercise the pure resolver; no source approval or real record is activated.
const finalRecord = () => ({ releaseTarget: "production", projectId: productionEnvironment.projectId,
  publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.1", minimumAge: 18 });
const timestamp = { toMillis: () => 1 };
const acceptanceFor = policy => ({ termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion,
  termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" });

test("exact production resource context can be prepared without compiled legal activation", () => {
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null);
  assert.equal(productionReleasePolicy.privacyVersion, null);
  assert.ok(validateProductionPolicy().length);
  assert.deepEqual(contextFor(production()), { target: "production", projectId: productionEnvironment.projectId });
  const configured = { ...production(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
    FIREBASE_CONFIG: JSON.stringify({ projectId: productionEnvironment.projectId, storageBucket: productionEnvironment.storageBucket }) };
  assert.deepEqual(contextFor(configured), contextFor(production()));
});

test("production resources require exact managed project and bucket, never frontend or default-project inference", () => {
  for (const key of ["GCLOUD_PROJECT", "TAKEME_RELEASE_TARGET", "TAKEME_FIREBASE_PROJECT_ID"]) {
    const env = production(); delete env[key]; assert.equal(contextFor(env), null);
  }
  for (const patch of [{ GCLOUD_PROJECT: stagingEnvironment.projectId }, { GOOGLE_CLOUD_PROJECT: "other-project" },
    { GCP_PROJECT: "demo-takeme" }, { TAKEME_RELEASE_TARGET: "staging" }, { TAKEME_FIREBASE_PROJECT_ID: "other-project" },
    { TAKEME_STORAGE_BUCKETS: productionEnvironment.projectId + ".appspot.com" }, { TAKEME_STORAGE_BUCKETS: productionEnvironment.storageBucket + ",other" },
    { TAKEME_DELETION_ENVIRONMENT: "staging" }, { TAKEME_ENABLE_STAGING_DELETION: "true" },
    { FIREBASE_CONFIG: "not-json" }, { FIREBASE_CONFIG: "null" }, { FIREBASE_CONFIG: "[]" },
    { FIREBASE_CONFIG: JSON.stringify({ projectId: null }) }, { FIREBASE_CONFIG: JSON.stringify({ projectId: stagingEnvironment.projectId }) },
    { FIREBASE_CONFIG: JSON.stringify({ storageBucket: stagingEnvironment.storageBucket }) }]) assert.equal(contextFor({ ...production(), ...patch }), null);
  for (const project of [undefined, "other-project", stagingEnvironment.projectId, "demo-takeme"]) {
    assert.equal(resolvePolicyContext(production(), project, productionEnvironment.storageBucket), null);
  }
  for (const bucket of [undefined, productionEnvironment.projectId + ".appspot.com", stagingEnvironment.storageBucket]) {
    assert.equal(resolvePolicyContext(production(), productionEnvironment.projectId, bucket), null);
  }
});

test("production context rejects every emulator override, including empty and false values", () => {
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "PUBSUB_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR", "FIREBASE_EMULATORS", "CUSTOM_EMULATOR_URL"]) {
    for (const value of ["", "false", "127.0.0.1:8080"]) assert.equal(contextFor({ ...production(), [name]: value }), null);
  }
  for (const value of ["true", "", "FALSE"]) assert.equal(contextFor({ ...production(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS: value }), null);
});

test("missing, revoked, incomplete or malformed production records fail closed", () => {
  const context = contextFor(production());
  for (const record of [undefined, null, [], "published", {}, { ...finalRecord(), publicationApproved: false },
    { ...finalRecord(), publicationApproved: "true" }, { ...finalRecord(), termsVersion: null },
    { ...finalRecord(), privacyVersion: null }, { ...finalRecord(), minimumAge: 17 },
    { ...finalRecord(), minimumAge: "18" }, { ...finalRecord(), minimumAge: null },
    { ...finalRecord(), minimumAge: NaN }, { ...finalRecord(), minimumAge: Infinity },
    { ...finalRecord(), revokedAt: timestamp }, { ...finalRecord(), extraApproval: true }]) {
    assert.equal(releasePolicyFromMirror(record, context), null);
  }
  for (const field of Object.keys(finalRecord())) {
    const record = finalRecord(); delete record[field]; assert.equal(releasePolicyFromMirror(record, context), null);
  }
  assert.equal(releasePolicyFromMirror(finalRecord(), null), null);
});

test("the supported six-field policy mirror refuses unapproved timestamp and operator schema extensions", () => {
  const context = contextFor(production());
  for (const extra of [{ effectiveAt: timestamp }, { updatedAt: timestamp }, { operatorName: "Synthetic operator" },
    { sourceRevision: "synthetic-local-revision" }]) {
    assert.equal(releasePolicyFromMirror({ ...finalRecord(), ...extra }, context), null);
  }
});

test("only the exact production six-field server-owned release record resolves a final policy", () => {
  const context = contextFor(production());
  const policy = releasePolicyFromMirror(finalRecord(), context);
  assert.deepEqual(policy, { publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.1", minimumAge: 18 });
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(policyMirrorMatches(finalRecord(), context), true);
  for (const patch of [{ projectId: "other-project" }, { projectId: stagingEnvironment.projectId }, { projectId: "demo-takeme" },
    { releaseTarget: "staging" }, { releaseTarget: "demo" }]) assert.equal(releasePolicyFromMirror({ ...finalRecord(), ...patch }, context), null);
  assert.equal(releasePolicyFromMirror({ ...finalRecord(), projectId: "other-project" }, { target: "production", projectId: "other-project" }), null);
  for (const version of ["", " 1.0", "1.0 ", "1 0", "1.0-draft", "DEMO-1", "TEST-final", "1.0-staging"]) {
    for (const field of ["termsVersion", "privacyVersion"]) assert.equal(releasePolicyFromMirror({ ...finalRecord(), [field]: version }, context), null);
  }
});

test("client and environment version or approval fields cannot replace the server-owned runtime record", () => {
  const env = { ...production(), TAKEME_POLICY_PUBLICATION_APPROVED: "true", TAKEME_TERMS_VERSION: "1.0", TAKEME_PRIVACY_VERSION: "1.1",
    NEXT_PUBLIC_POLICY_PUBLICATION_APPROVED: "true", NEXT_PUBLIC_TERMS_VERSION: "1.0", NEXT_PUBLIC_PRIVACY_VERSION: "1.1" };
  const context = contextFor(env);
  assert.deepEqual(context, contextFor(production()));
  assert.equal(releasePolicyFromMirror(undefined, context), null);
  assert.equal(policyMirrorMatches({ ...finalRecord(), publicationApproved: false }, context), false);
  const policy = releasePolicyFromMirror(finalRecord(), context);
  const accepted = { acceptTerms: true, acceptPrivacy: true, confirmAge18: true, termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion };
  assert.doesNotThrow(() => validateAcceptance(accepted, policy));
  for (const field of ["termsVersion", "privacyVersion"]) assert.throws(() => validateAcceptance({ ...accepted, [field]: "old" }, policy));
  for (const field of ["acceptTerms", "acceptPrivacy", "confirmAge18"]) assert.throws(() => validateAcceptance({ ...accepted, [field]: false }, policy));
});

test("current runtime versions, server timestamps and all acceptance confirmations stay authoritative", () => {
  const context = contextFor(production());
  const policy = releasePolicyFromMirror(finalRecord(), context);
  const acceptance = acceptanceFor(policy);
  assert.equal(hasCurrentAcceptance(acceptance, policy), true);
  const changed = releasePolicyFromMirror({ ...finalRecord(), termsVersion: "2.0" }, context);
  assert.equal(hasCurrentAcceptance(acceptance, changed), false);
  for (const patch of [{ termsVersion: "old" }, { privacyVersion: "old" }, { age18ConfirmedAt: false },
    { termsAcceptedAt: { toMillis: () => NaN } }, { revokedAt: timestamp }, { acceptanceSource: "client" }]) {
    assert.equal(hasCurrentAcceptance({ ...acceptance, ...patch }, policy), false);
  }
});

test("demo and staging mirrors stay pinned to source versions even with a forged context policy", () => {
  for (const [target, projectId, policy] of [["demo", "demo-takeme", demoReleasePolicy], ["staging", stagingEnvironment.projectId, stagingReleasePolicy]]) {
    const context = { target, projectId, policy };
    const record = { releaseTarget: target, projectId, ...policy };
    assert.equal(releasePolicyFromMirror(record, context), policy);
    const forged = { ...context, policy: { ...policy, termsVersion: "2.0", privacyVersion: "2.0" } };
    assert.equal(releasePolicyFromMirror({ ...record, termsVersion: "2.0", privacyVersion: "2.0" }, forged), null);
    assert.equal(releasePolicyFromMirror(record, { ...context, projectId: "other-project" }), null);
  }
});

test("runtime resolution does not approve source bootstrap or enable production deletion", () => {
  const runtime = { env: production(), appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket };
  assert.ok(releasePolicyFromMirror(finalRecord(), contextFor(production())));
  assert.throws(() => planProductionPolicyBootstrap(runtime));
  assert.throws(() => qualifyDeletionExecution(runtime), error => error.reason === "production-disabled");
  assert.throws(() => qualifyDeletionExecution({ ...runtime, env: { ...runtime.env, TAKEME_ENABLE_PRODUCTION_DELETION: "true" } }), error => error.reason === "production-policy-unapproved");
});
