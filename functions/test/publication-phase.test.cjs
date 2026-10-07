"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { expectedSourcePhase, assertSourcePhase } = require("./helpers/publication-phase.cjs");
const { productionEnvironment } = require("../lib/production-environment");
const { validateProductionPolicy } = require("../lib/release-policy");
const { legalPublicationReadiness, validateLegalPublication } = require("../lib/legal-publication");
const { planProductionPolicyBootstrap, createProductionPolicyMirror } = require("../lib/production-policy-bootstrap");
const { resolvePolicyContext, hasCurrentAcceptance } = require("../lib/account-eligibility");
const { releasePolicyFromMirror } = require("../lib/policy-runtime");
const { qualifyDeletionExecution } = require("../lib/deletion-config");
const { maintenanceIsPaused } = require("../lib/protected-write-maintenance");

// Pure fixtures and in-memory stores only; no SDK app, credentials, network,
// deployment command or real policy/acceptance record is created by these tests.
const policyFor = publicationApproved => Object.freeze({ publicationApproved, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
const legalFor = publicationApproved => Object.freeze({ ...legalPublicationReadiness,
  publicationApproved, finalContentApproved: publicationApproved, bmPrivacyNoticeApproved: publicationApproved,
  productionRoutesReviewed: publicationApproved, effectiveDate: "2026-10-12", lastUpdated: "2026-10-12" });
const runtime = () => ({ env: { GCLOUD_PROJECT: productionEnvironment.projectId, TAKEME_RELEASE_TARGET: "production",
  TAKEME_FIREBASE_PROJECT_ID: productionEnvironment.projectId, TAKEME_STORAGE_BUCKETS: productionEnvironment.storageBucket,
  TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false" },
  appProjectId: productionEnvironment.projectId, appStorageBucket: productionEnvironment.storageBucket });
const context = () => resolvePolicyContext(runtime().env, runtime().appProjectId, runtime().appStorageBucket);
const paused = Object.freeze({ releaseTarget: "production", projectId: productionEnvironment.projectId, protectedWritesPaused: true });

test("source phase is explicit and rejects runtime activation or unknown phase selectors", () => {
  assert.equal(expectedSourcePhase({}), "publication-enabled-rc");
  for (const phase of ["pre-publication", "publication-enabled-rc"]) assert.equal(expectedSourcePhase({ TAKEME_FUNCTIONS_TEST_SOURCE_PHASE: phase }), phase);
  for (const phase of ["active-production", "true", "", "publication-enabled-rc "]) {
    assert.throws(() => expectedSourcePhase({ TAKEME_FUNCTIONS_TEST_SOURCE_PHASE: phase }), /Unknown Functions test source phase/);
  }
  assertSourcePhase();
});

test("STATE A: preparation has no runtime record and cannot plan publication bootstrap", () => {
  const policy = policyFor(false), legal = legalFor(false);
  assert.ok(validateProductionPolicy(policy).length);
  assert.ok(validateLegalPublication(legal).length);
  assert.throws(() => planProductionPolicyBootstrap(runtime(), policy, legal));
  assert.equal(releasePolicyFromMirror(undefined, context()), null);
  assert.equal(hasCurrentAcceptance(undefined, policy), false);
  assert.equal(maintenanceIsPaused(paused, context()), true);
  assert.throws(() => qualifyDeletionExecution(runtime(), policy), error => error.reason === "production-disabled");
});

test("STATE B: approved publication RC can plan exact bootstrap but cannot activate or fabricate acceptance", () => {
  const policy = policyFor(true), legal = legalFor(true);
  assert.deepEqual(validateProductionPolicy(policy), []);
  assert.deepEqual(validateLegalPublication(legal), []);
  const records = new Map();
  const plan = planProductionPolicyBootstrap(runtime(), policy, legal);
  assert.deepEqual(plan.record, { releaseTarget: "production", projectId: productionEnvironment.projectId,
    publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
  assert.equal(legal.effectiveDate, "2026-10-12"); assert.equal(legal.lastUpdated, "2026-10-12");
  assert.equal(legal.addressDisposition.legalCounselStatus, "OUTSTANDING");
  assert.equal(records.has(plan.path), false, "Planning cannot create releasePolicies/current.");
  assert.equal(releasePolicyFromMirror(records.get(plan.path), context()), null);
  assert.equal(hasCurrentAcceptance(undefined, policy), false);
  assert.equal(maintenanceIsPaused(paused, context()), true);
  assert.throws(() => qualifyDeletionExecution(runtime(), policy), error => error.reason === "production-disabled");
  // Environment/client claims cannot turn absent runtime policy into activation.
  const env = { ...runtime().env, TAKEME_POLICY_PUBLICATION_APPROVED: "true", TAKEME_TERMS_VERSION: "1.0", TAKEME_PRIVACY_VERSION: "1.0" };
  assert.equal(releasePolicyFromMirror(undefined, resolvePolicyContext(env, runtime().appProjectId, runtime().appStorageBucket)), null);
});

test("STATE C: explicit create-only memory bootstrap activates exact policy, never acceptance or paused writes", async () => {
  const policy = policyFor(true), legal = legalFor(true), plan = planProductionPolicyBootstrap(runtime(), policy, legal);
  const records = new Map(); let creates = 0;
  const store = { create: async record => { if (records.has(plan.path)) throw { code: 6 }; records.set(plan.path, { ...record }); creates++; },
    read: async () => records.get(plan.path) };
  assert.equal(await createProductionPolicyMirror(store, plan, policy, legal), "created");
  assert.equal(await createProductionPolicyMirror(store, plan, policy, legal), "already-current");
  assert.equal(creates, 1); assert.equal(records.size, 1, "No user acceptance may be fabricated by bootstrap.");
  const active = releasePolicyFromMirror(records.get(plan.path), context());
  assert.deepEqual(active, policy); assert.equal(Object.isFrozen(active), true);
  assert.equal(hasCurrentAcceptance(undefined, active), false);
  const timestamp = { toMillis: () => 1 };
  const explicitEvidence = { termsVersion: "1.0", privacyVersion: "1.0", termsAcceptedAt: timestamp,
    privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" };
  assert.equal(hasCurrentAcceptance(explicitEvidence, active), true);
  for (const patch of [{ termsVersion: "old" }, { privacyVersion: "old" }, { age18ConfirmedAt: false }, { revokedAt: timestamp }]) {
    assert.equal(hasCurrentAcceptance({ ...explicitEvidence, ...patch }, active), false);
  }
  assert.equal(maintenanceIsPaused(paused, context()), true);
  assert.throws(() => qualifyDeletionExecution(runtime(), active), error => error.reason === "production-disabled");
  for (const bad of [undefined, {}, { ...plan.record, publicationApproved: false }, { ...plan.record, projectId: "other-project" },
    { ...plan.record, releaseTarget: "demo" }, { ...plan.record, privacyVersion: "1.0-draft" }, { ...plan.record, extra: true }]) {
    assert.equal(releasePolicyFromMirror(bad, context()), null);
  }
  for (const field of Object.keys(plan.record)) {
    const incomplete = { ...plan.record }; delete incomplete[field];
    assert.equal(releasePolicyFromMirror(incomplete, context()), null);
  }
});
