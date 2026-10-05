import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { clientReleaseProofMatches, encodeReleaseProof, isStagingReleaseProof } from "../src/lib/release-proof.ts";
import { canPreviewLegalDraft } from "../src/lib/public-information.ts";
import { stagingEnvironment as staging } from "../functions/src/staging-environment.ts";
import { loadStagingBuildEnvironment } from "../scripts/staging-environment.mjs";

// Fabricated format-only SDK fields for pure tests. No SDK initializes or remote request runs.
function stagingFixture() {
  return {
    TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: staging.projectId,
    TAKEME_STORAGE_BUCKETS: staging.storageBucket, TAKEME_DELETION_ENVIRONMENT: "staging",
    TAKEME_ENABLE_STAGING_DELETION: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: staging.projectId, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: staging.authDomain,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: staging.storageBucket, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: staging.projectNumber,
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "s".repeat(35), NEXT_PUBLIC_FIREBASE_APP_ID: `1:${staging.projectNumber}:web:${"a".repeat(22)}`,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", NEXT_PUBLIC_SITE_URL: staging.siteUrl,
  };
}

test("staging is explicitly bound to owner resources and a separate non-production artifact purpose", () => {
  const config = validateReleaseEnvironment(stagingFixture());
  assert.equal(config.target, "staging"); assert.equal(config.purpose, "staging-preview");
  assert.equal(config.productionDeletionEnabled, false); assert.equal(config.stagingDeletionEnabled, false);
  assert.equal(config.policy.termsVersion, "1.0-staging"); assert.equal(config.policy.privacyVersion, "1.0-staging");
  assert.deepEqual(config.storageBuckets, [staging.storageBucket]);
  assert.equal(validateReleaseEnvironment({ ...stagingFixture(), TAKEME_ENABLE_STAGING_DELETION: "true" }).stagingDeletionEnabled, true);
});

test("staging rejects missing registered SDK fields, production/local resources and mixed activation", () => {
  for (const key of ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"]) {
    const env: Record<string, string> = stagingFixture(); delete env[key];
    assert.throws(() => validateReleaseEnvironment(env), new RegExp(key === "NEXT_PUBLIC_FIREBASE_API_KEY" ? "API|Web App" : "staging|Staging|Web App"));
  }
  for (const change of [
    { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }, { TAKEME_FIREBASE_PROJECT_ID: "demo-takeme" },
    { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com" }, { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app" },
    { TAKEME_STORAGE_BUCKETS: `${staging.storageBucket},${staging.projectId}.appspot.com` }, { NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "367115645204" },
    { NEXT_PUBLIC_SITE_URL: "https://takeme.my" }, { NEXT_PUBLIC_SITE_URL: staging.siteUrl + "/" },
    { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" },
    { FIRESTORE_EMULATOR_HOST: undefined }, { FUNCTIONS_EMULATOR: "false" },
    { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, { TAKEME_DELETION_ENVIRONMENT: "production" },
    { TAKEME_ENABLE_STAGING_DELETION: "" }, { GOOGLE_CLOUD_PROJECT: "takeme-52b80" },
    { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "https://asia-southeast1-takeme-52b80.cloudfunctions.net/call" },
    { PROTECTED_PAYMENTS_ENABLED: "true" }, { TAKEME_OFFLINE_QUALIFICATION: "true" },
  ]) assert.throws(() => validateReleaseEnvironment({ ...stagingFixture(), ...change }));
});

test("staging cannot borrow production policy approval or be relabeled as production", () => {
  const finalPolicy = { publicationApproved: true, termsVersion: "2026-10-05-v1", privacyVersion: "2026-10-05-v1", minimumAge: 18 as const };
  const legal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "not-required" as const, address: "not-required" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };
  assert.throws(() => validateReleaseEnvironment(stagingFixture(), finalPolicy, legal), /staging test policies/);
  assert.throws(() => validateReleaseEnvironment({ ...stagingFixture(), TAKEME_RELEASE_TARGET: "production", TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "true", NEXT_PUBLIC_SITE_URL: "https://takeme.my" }, finalPolicy, legal), /cannot qualify as a production/);
});

test("staging proof gates Firebase and legal preview without opening production publication", () => {
  const release = validateReleaseEnvironment(stagingFixture()), proof = encodeReleaseProof(release);
  const config = { apiKey: release.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: staging.projectId, authDomain: staging.authDomain, storageBucket: staging.storageBucket, messagingSenderId: staging.projectNumber, appId: release.publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(isStagingReleaseProof(proof), true);
  assert.equal(clientReleaseProofMatches(config, false, proof, true), true);
  assert.equal(clientReleaseProofMatches({ ...config, projectId: "takeme-52b80" }, false, proof, true), false);
  assert.equal(clientReleaseProofMatches(config, true, proof, true), false);
  const runtime = { nodeEnv: "production", useEmulators: "false", projectId: staging.projectId, buildProof: proof };
  assert.equal(canPreviewLegalDraft(runtime), true);
  assert.equal(canPreviewLegalDraft({ ...runtime, buildProof: undefined }), false);
  assert.equal(canPreviewLegalDraft({ ...runtime, projectId: "takeme-52b80" }), false);
  for (const changed of [{ ...release, purpose: "release" as const }, { ...release, target: "production" as const }, { ...release, siteUrl: "https://takeme.my" }, { ...release, policy: { ...release.policy, termsVersion: "1.0-draft" } }]) assert.equal(isStagingReleaseProof(encodeReleaseProof(changed)), false);
});

test("local staging SDK loading refuses secrets, scripts, symlinks and shell conflicts without echoing data", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-staging-sdk-test-"));
  try {
    const file = path.join(directory, "sdk.json"), env = stagingFixture();
    const sdk = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith("NEXT_PUBLIC_FIREBASE_")));
    await writeFile(file, JSON.stringify(sdk), { mode: 0o600 });
    assert.equal(validateReleaseEnvironment(loadStagingBuildEnvironment({ TAKEME_STAGING_CONFIG_FILE: file })).target, "staging");
    assert.throws(() => loadStagingBuildEnvironment({ TAKEME_STAGING_CONFIG_FILE: file, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }), /conflicting shell/);
    await symlink(file, path.join(directory, "link.json"));
    assert.throws(() => loadStagingBuildEnvironment({ TAKEME_STAGING_CONFIG_FILE: path.join(directory, "link.json") }));
    await writeFile(file, JSON.stringify({ ...sdk, private_key: "secret-value-that-must-not-appear" }));
    try { loadStagingBuildEnvironment({ TAKEME_STAGING_CONFIG_FILE: file }); assert.fail(); }
    catch (error) { assert.ok(error instanceof Error); assert.equal(error.message.includes("secret-value-that-must-not-appear"), false); }
    await writeFile(file, "globalThis.mustNeverExecute = true");
    assert.throws(() => loadStagingBuildEnvironment({ TAKEME_STAGING_CONFIG_FILE: file }));
    assert.throws(() => validateReleaseEnvironment(loadStagingBuildEnvironment({})), /Web App|API|sender|Auth|Storage/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
