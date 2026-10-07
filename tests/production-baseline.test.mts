import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { productionReleasePolicy, validateProductionPolicy, renderPolicyRules, assertFirestorePolicyRules, assertStoragePolicyRules } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness, validateLegalPublication } from "../functions/src/legal-publication.ts";
import { releasePolicyFromMirror } from "../functions/src/policy-runtime.ts";
import { hasCurrentAcceptance } from "../functions/src/account-eligibility.ts";
import { maintenanceIsPaused } from "../functions/src/protected-write-maintenance.ts";
import { qualifyDeletionExecution } from "../functions/src/deletion-config.ts";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { encodeReleaseProof } from "../src/lib/release-proof.ts";
import { canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { buildPrivacyMetadata } from "../src/lib/privacy-metadata.ts";
import { buildBmPrivacyMetadata } from "../src/lib/privacy-bm-metadata.ts";
import { hasApprovedBmPrivacyNotice } from "../src/lib/privacy-notice.ts";

const context = { target: "production" as const, projectId: "takeme-52b80" };
const mirror = { releaseTarget: "production", projectId: context.projectId, ...productionReleasePolicy };
const preparationPolicy = { ...productionReleasePolicy, publicationApproved: false };
const preparationLegal = { ...legalPublicationReadiness, publicationApproved: false, finalContentApproved: false, bmPrivacyNoticeApproved: false, productionRoutesReviewed: false };
const environment = {
  TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: context.projectId,
  TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_ENABLE_PRODUCTION_DELETION: "false", TAKEME_DELETION_ENVIRONMENT: "production", PROTECTED_PAYMENTS_ENABLED: "false",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", NEXT_PUBLIC_SITE_URL: "https://takeme.my",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: context.projectId, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app", NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22),
};
const config = validateReleaseEnvironment(environment);
const runtime = { nodeEnv: "production", useEmulators: "false", projectId: context.projectId, buildProof: encodeReleaseProof(config) };

test("main explicitly represents the owner-approved published production phase", () => {
  assert.deepEqual(productionReleasePolicy, { publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) assert.equal(legalPublicationReadiness[key], true);
  assert.deepEqual(validateProductionPolicy(), []);
  assert.deepEqual(validateLegalPublication(), []);
  assert.equal(legalPublicationReadiness.effectiveDate, "2026-10-12");
  assert.equal(legalPublicationReadiness.lastUpdated, "2026-10-12");
  assert.equal(legalPublicationReadiness.address, "pending");
  assert.deepEqual(legalPublicationReadiness.addressDisposition, { addressPublicationDecision: "NOT_PUBLISHED_FOR_V1", ownerApproved: true, legalCounselStatus: "OUTSTANDING" });
});

test("explicit preparation fixtures stay unpublished and independently fail every approval gate", () => {
  assert.ok(validateProductionPolicy(preparationPolicy).length);
  assert.ok(validateLegalPublication(preparationLegal).length);
  assert.equal(canPublishProductionLegal(runtime, preparationLegal, preparationPolicy), false);
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) {
    assert.equal(canPublishProductionLegal(runtime, { ...legalPublicationReadiness, [key]: false }), false);
  }
});

test("publication alone never fabricates runtime policy or user acceptance", () => {
  for (const record of [null, undefined, {}, { ...mirror, publicationApproved: false }, { ...mirror, extra: true }, { ...mirror, projectId: "foreign-project" }, { ...mirror, termsVersion: "1.0-staging" }]) assert.equal(releasePolicyFromMirror(record, context), null);
  assert.deepEqual(releasePolicyFromMirror(mirror, context), productionReleasePolicy);
  assert.equal(releasePolicyFromMirror(mirror, { ...context, projectId: "foreign-project" }), null);
  assert.equal(hasCurrentAcceptance(undefined, productionReleasePolicy), false);
  assert.equal(hasCurrentAcceptance({ termsVersion: "old", privacyVersion: "old" }, productionReleasePolicy), false);
});

test("published source cannot reopen paused writes or enable account deletion", () => {
  assert.equal(maintenanceIsPaused({ releaseTarget: "production", projectId: context.projectId, protectedWritesPaused: true }, context), true);
  assert.equal(maintenanceIsPaused({ protectedWritesPaused: false }, context), true);
  assert.equal(maintenanceIsPaused(null, context), true);
  assert.equal(config.productionDeletionEnabled, false);
  assert.throws(() => qualifyDeletionExecution({ env: { ...environment, GCLOUD_PROJECT: context.projectId }, appProjectId: context.projectId, appStorageBucket: environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }), error => (error as { reason: string }).reason === "production-disabled");
});

test("published legal routes require an exact production build proof; missing, offline and foreign proofs deny", () => {
  assert.equal(canPublishProductionLegal(runtime), true);
  assert.equal(resolveLegalDocumentState("privacy", runtime).production, true);
  for (const patch of [{ buildProof: undefined }, { projectId: "takeme-staging-822a5" }, { useEmulators: "true" }, { buildProof: encodeReleaseProof({ ...config, purpose: "offline-qualification" }) }, { buildProof: encodeReleaseProof({ ...config, policy: preparationPolicy }) }]) assert.equal(canPublishProductionLegal({ ...runtime, ...patch }), false);
  assert.equal(hasApprovedBmPrivacyNotice(), true);
  for (const metadata of [buildPrivacyMetadata(true), buildBmPrivacyMetadata(true)]) {
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.deepEqual(metadata.alternates?.languages, { en: "/privacy", ms: "/privacy/bm" });
  }
  for (const metadata of [buildPrivacyMetadata(false), buildBmPrivacyMetadata(false)]) assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("production rules exactly match the published central model without changing narrow write guards", () => {
  assertFirestorePolicyRules(readFileSync("firestore.rules", "utf8"));
  assertStoragePolicyRules(readFileSync("storage.rules", "utf8"));
  assert.match(renderPolicyRules(), /request\.auth\.token\.aud == "takeme-52b80" && acceptance\.termsVersion == "1\.0"/);
  const storage = readFileSync("storage.rules", "utf8");
  for (const guard of [/permit\.path == path/, /permit\.contentType == request\.resource\.contentType/, /permit\.sizeBytes == request\.resource\.size/, /request\.time < permit\.expiresAt/, /allow update: if false;/]) assert.match(storage, guard);
  assert.match(readFileSync("firestore.rules", "utf8"), /match \/releasePolicies\/\{id\} \{ allow get: if id == 'current'; allow list, write: if false;/);
});

test("production Worker preserves logging and query redaction and has no staging wrapper/config", () => {
  const worker = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  assert.equal(worker.name, "takeme-web");
  assert.equal(worker.account_id, "3ade68940865285d676a83971b23b4d4");
  assert.equal(worker.main, ".open-next/worker.js");
  assert.equal(worker.workers_dev, false);
  assert.equal(worker.preview_urls, false);
  assert.equal(worker.observability.enabled, true);
  assert.equal(worker.observability.logs.enabled, true);
  assert.equal(worker.observability.redact_query_string, true);
  assert.equal(worker.observability.traces.enabled, false);
  assert.equal(worker.env, undefined);
  assert.doesNotMatch(JSON.stringify(worker), /CF_ACCESS_|takeme-staging|staging-entry/);
});

test("production build refuses staging resources and Access credentials despite published approval", () => {
  for (const patch of [{ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-staging-822a5" }, { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-staging-822a5.firebasestorage.app" }, { NEXT_PUBLIC_SITE_URL: "https://takeme-web-preview.takeme-technologies.workers.dev" }, { CF_ACCESS_AUD: "test-only" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }]) assert.throws(() => validateReleaseEnvironment({ ...environment, ...patch }));
});
