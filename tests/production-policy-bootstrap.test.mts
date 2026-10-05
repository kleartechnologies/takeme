import assert from "node:assert/strict";
import test from "node:test";
import { planProductionPolicyBootstrap, createProductionPolicyMirror, productionPolicyRecordMatches, type ProductionPolicyRecord } from "../functions/src/production-policy-bootstrap.ts";
import { productionReleasePolicy, policyIsConfigured } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";

// Future approvals are pure fixtures only; real source decisions stay false/null.
const policy = { publicationApproved: true, termsVersion: "approved-terms-v1", privacyVersion: "approved-privacy-v2", minimumAge: 18 as const };
const legal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "approved" as const, address: "not-required" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };
const runtime = () => ({ env: { GCLOUD_PROJECT: "takeme-52b80", TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80", TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_ENABLE_PRODUCTION_DELETION: "false" }, appProjectId: "takeme-52b80", appStorageBucket: "takeme-52b80.firebasestorage.app" });
const plan = () => planProductionPolicyBootstrap(runtime(), policy, legal);

test("actual policies and publication remain closed; planning never invents versions or approval", () => {
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null);
  assert.equal(productionReleasePolicy.privacyVersion, null);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(policyIsConfigured(productionReleasePolicy), false);
  assert.throws(() => planProductionPolicyBootstrap(runtime()), /publication|version/);
  assert.equal(plan().path, "releasePolicies/current");
  assert.deepEqual(Object.keys(plan().record).sort(), ["releaseTarget", "projectId", "publicationApproved", "termsVersion", "privacyVersion", "minimumAge"].sort());
});

test("bootstrap rejects missing versions, unapproved publication, unresolved legal gates and identity mismatch", () => {
  for (const patch of [{ publicationApproved: false }, { termsVersion: null }, { privacyVersion: null }, { termsVersion: "1.0-staging" }, { privacyVersion: "  approved-privacy-v2" }]) assert.throws(() => planProductionPolicyBootstrap(runtime(), { ...policy, ...patch }, legal));
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) assert.throws(() => planProductionPolicyBootstrap(runtime(), policy, { ...legal, [key]: false }));
  for (const key of ["registration", "address"] as const) assert.throws(() => planProductionPolicyBootstrap(runtime(), policy, { ...legal, [key]: "pending" }));
  for (const patch of [{ GCLOUD_PROJECT: "foreign-project" }, { GOOGLE_CLOUD_PROJECT: "foreign-project" }, { TAKEME_FIREBASE_PROJECT_ID: "foreign-project" }, { TAKEME_STORAGE_BUCKETS: "foreign-project.firebasestorage.app" }, { TAKEME_RELEASE_TARGET: "staging" }, { FIRESTORE_EMULATOR_HOST: "" }, { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, { FIREBASE_CONFIG: "not-json" }]) assert.throws(() => planProductionPolicyBootstrap({ ...runtime(), env: { ...runtime().env, ...patch } }, policy, legal));
  assert.throws(() => planProductionPolicyBootstrap({ ...runtime(), appProjectId: "foreign-project" }, policy, legal));
  assert.throws(() => planProductionPolicyBootstrap({ ...runtime(), appStorageBucket: "foreign-project.firebasestorage.app" }, policy, legal));
});

test("create-only bootstrap is idempotent under repeated and concurrent operations", async () => {
  let stored: Readonly<ProductionPolicyRecord> | undefined; let writes = 0;
  const store = { create: async (record: Readonly<ProductionPolicyRecord>) => { if (stored) throw { code: 6 }; stored = { ...record }; writes++; }, read: async () => stored };
  const result = await Promise.all([createProductionPolicyMirror(store, plan(), policy, legal), createProductionPolicyMirror(store, plan(), policy, legal)]);
  assert.deepEqual(result.sort(), ["already-current", "created"]);
  assert.equal(await createProductionPolicyMirror(store, plan(), policy, legal), "already-current");
  assert.equal(writes, 1);
  assert.deepEqual(stored, plan().record);
});

test("new policy creation must read back exactly; failure never repairs or overwrites", async () => {
  let writes = 0, reads = 0;
  const store = {
    create: async () => { writes++; },
    read: async () => { reads++; return { ...plan().record, publicationApproved: false }; },
  };
  await assert.rejects(createProductionPolicyMirror(store, plan(), policy, legal), /created but read-back verification failed/);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  await assert.rejects(createProductionPolicyMirror({ create: async () => {}, read: async () => { throw new Error("read unavailable"); } }, plan(), policy, legal), /read unavailable/);
});

test("final publication dates must be explicit valid calendar dates; historical proposal grants no approval", () => {
  assert.equal(legalPublicationReadiness.effectiveDate, null);
  assert.equal(legalPublicationReadiness.lastUpdated, null);
  for (const field of ["effectiveDate", "lastUpdated"] as const) {
    for (const value of [null, "", "2026-02-30", " 2026-10-05", "2026-10-05T00:00:00Z"]) {
      assert.throws(() => planProductionPolicyBootstrap(runtime(), policy, { ...legal, [field]: value }));
    }
  }
});

test("missing/mismatched/revoked/extraneous mirror fields are never repaired or overwritten", async () => {
  for (const record of [undefined, { ...plan().record, termsVersion: "old-terms" }, { ...plan().record, privacyVersion: "old-privacy" }, { ...plan().record, publicationApproved: false }, { ...plan().record, minimumAge: 17 }, { ...plan().record, projectId: "foreign-project" }, { ...plan().record, extraApproval: true }]) {
    const before = JSON.stringify(record);
    assert.equal(productionPolicyRecordMatches(record, plan().record), false);
    await assert.rejects(createProductionPolicyMirror({ create: async () => { throw { code: "already-exists" }; }, read: async () => record }, plan(), policy, legal), /never changes/);
    assert.equal(JSON.stringify(record), before);
  }
});

test("apply repeats actual source approval and rejects a mismatched plan before any store access", async () => {
  let calls = 0; const store = { create: async () => { calls++; }, read: async () => { calls++; } };
  await assert.rejects(createProductionPolicyMirror(store, plan()), /source approval/);
  await assert.rejects(createProductionPolicyMirror(store, { ...plan(), record: { ...plan().record, termsVersion: "another-version" } }, policy, legal), /invalid/);
  assert.equal(calls, 0);
  await assert.rejects(createProductionPolicyMirror({ create: async () => { throw { code: 7 }; }, read: async () => { assert.fail("No fallback on permission failures"); } }, plan(), policy, legal), error => (error as { code?: number }).code === 7);
});
