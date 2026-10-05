import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { validateReleaseEnvironment, validateProductionLaunchEnvironment } from "../src/lib/release-config.ts";
import { clientReleaseProofMatches, encodeReleaseProof } from "../src/lib/release-proof.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { qualifyDeletionExecution, DeletionConfigurationError } from "../functions/src/deletion-config.ts";
import { metadataEndpoint } from "../src/lib/firebase/staging-isolation.ts";
import { checkDeletionImplementation } from "../scripts/check-deletion-implementation.mjs";

// Fabricated public-format fields, bound to the confirmed project; no SDK or network initializes.
const environment = () => ({ TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80", TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22), NEXT_PUBLIC_SITE_URL: "https://takeme.my", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" });
const policy = { publicationApproved: true, termsVersion: "approved-terms-v1", privacyVersion: "approved-privacy-v2", minimumAge: 18 as const };
const legal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "approved" as const, address: "not-required" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };

test("ordinary real-target qualification retains null source policies and disabled deletion without offline approval", async () => {
  const config = validateReleaseEnvironment(environment());
  assert.equal(config.purpose, "production-build"); assert.equal(config.policy, productionReleasePolicy);
  assert.equal(config.policy.publicationApproved, false); assert.equal(config.policy.termsVersion, null); assert.equal(config.policy.privacyVersion, null);
  assert.equal(config.productionDeletionEnabled, false); assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.deepEqual(await checkDeletionImplementation(process.cwd()), { implementationPresent: true, runtimeActivationGranted: false });
  const client = { apiKey: config.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: config.publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: config.projectId, storageBucket: config.publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof(config), true), true);
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof({ ...config, policy }), true), false, "A proof cannot replace the real source policy");
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof({ ...config, purpose: "offline-qualification" }), true), false);
  assert.equal(metadataEndpoint({ ...environment(), NODE_ENV: "production", TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(config) }), "https://asia-southeast1-takeme-52b80.cloudfunctions.net/getPublicListingDetail");
});

test("build qualification cannot activate deletion or grant launch permission", () => {
  const env = environment();
  assert.throws(() => validateProductionLaunchEnvironment(env), /publication|version|activated deletion/);
  assert.throws(() => validateProductionLaunchEnvironment(env, policy, legal), /activated deletion/);
  const active = { ...env, TAKEME_ENABLE_PRODUCTION_DELETION: "true" };
  assert.equal(validateProductionLaunchEnvironment(active, policy, legal).productionDeletionEnabled, true);
  assert.throws(() => validateProductionLaunchEnvironment(active), /publication|version/);
  const runtime = { env: { ...env, GCLOUD_PROJECT: "takeme-52b80" }, appProjectId: "takeme-52b80", appStorageBucket: "takeme-52b80.firebasestorage.app" };
  assert.throws(() => qualifyDeletionExecution(runtime), error => error instanceof DeletionConfigurationError && error.reason === "production-disabled");
  assert.throws(() => qualifyDeletionExecution({ ...runtime, env: { ...runtime.env, TAKEME_ENABLE_PRODUCTION_DELETION: "true" } }), error => error instanceof DeletionConfigurationError && error.reason === "production-policy-unapproved");
});

test("build and launch reject mixed resources and policy-shape corruption; every independent launch gate matters", () => {
  for (const patch of [{ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "other-project", TAKEME_FIREBASE_PROJECT_ID: "other-project" }, { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.appspot.com", TAKEME_STORAGE_BUCKETS: "takeme-52b80.appspot.com" }, { CF_ACCESS_ALLOWED_EMAILS: "[\"test@example.test\"]" }, { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "https://takeme-web-preview.takeme-technologies.workers.dev" }, { TAKEME_ENABLE_STAGING_DELETION: "true" }, { TAKEME_OFFLINE_QUALIFICATION: "true" }]) assert.throws(() => validateReleaseEnvironment({ ...environment(), ...patch }));
  for (const invalid of [{ ...productionReleasePolicy, termsVersion: "1.0-staging" }, { ...productionReleasePolicy, privacyVersion: " " }, { ...productionReleasePolicy, publicationApproved: true }]) assert.throws(() => validateReleaseEnvironment(environment(), invalid));
  for (const invalid of [{ ...policy, termsVersion: null }, { ...policy, privacyVersion: null }, { ...policy, publicationApproved: false }]) assert.throws(() => validateProductionLaunchEnvironment({ ...environment(), TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, invalid, legal));
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) assert.throws(() => validateProductionLaunchEnvironment({ ...environment(), TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, policy, { ...legal, [key]: false }));
});

test("launch checker and default bootstrap dry run use actual closed approvals and never echo SDK inputs", () => {
  for (const script of ["scripts/validate-production-launch.mjs", "scripts/bootstrap-production-policy.mjs"]) {
    const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", script], { encoding: "utf8", env: { NODE_ENV: "production", ...environment(), GCLOUD_PROJECT: "takeme-52b80", TAKEME_POLICY_PUBLICATION_APPROVED: "true", TAKEME_LEGAL_PUBLICATION_APPROVED: "true" } });
    assert.equal(result.status, 1); assert.match(result.stderr, /publication|version/);
    assert.equal(result.stderr.includes(environment().NEXT_PUBLIC_FIREBASE_API_KEY), false);
    assert.equal(result.stderr.includes(environment().NEXT_PUBLIC_FIREBASE_APP_ID), false);
  }
});
