import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReleaseEnvironment, publicFirebaseKeys, type ReleasePolicy } from "../src/lib/release-config.ts";
import { clientReleaseProofMatches, encodeReleaseProof } from "../src/lib/release-proof.ts";
import { recordReleaseArtifact, validateReleaseArtifact } from "../scripts/release-artifact.mjs";

const approvedFixture: ReleasePolicy = { publicationApproved: true, termsVersion: "2026-10-05-v1", privacyVersion: "2026-10-05-v1", minimumAge: 18 };
const demo = { TAKEME_RELEASE_TARGET: "demo", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme" };
function productionFixture() {
  // Synthetic public configuration only. No SDK initializes and no network runs.
  const project = "marketplace-release";
  return { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: project,
    TAKEME_STORAGE_BUCKETS: `${project}.firebasestorage.app`, TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "true",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${project}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22),
    NEXT_PUBLIC_SITE_URL: "https://takeme.my", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" };
}
const acceptedFixture = () => validateReleaseEnvironment(productionFixture(), approvedFixture);

test("optimized demo and synthetic production configuration require explicit target and correct policy", () => {
  assert.equal(validateReleaseEnvironment(demo).target, "demo");
  assert.equal(acceptedFixture().target, "production");
  assert.throws(() => validateReleaseEnvironment({ NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" }), /TAKEME_RELEASE_TARGET/);
  assert.throws(() => validateReleaseEnvironment(productionFixture()), /publication approval|policy version/);
  for (const policy of [{ ...approvedFixture, termsVersion: "1.0-draft" }, { ...approvedFixture, privacyVersion: null }, { ...approvedFixture, publicationApproved: false }]) assert.throws(() => validateReleaseEnvironment(productionFixture(), policy));
});

test("production refuses each absent Web App field, ambiguous project and mismatched resources", () => {
  for (const key of publicFirebaseKeys) {
    const env: Record<string, string> = productionFixture(); delete env[key];
    assert.throws(() => validateReleaseEnvironment(env, approvedFixture), new RegExp(key));
  }
  for (const change of [{ TAKEME_FIREBASE_PROJECT_ID: "" }, { TAKEME_FIREBASE_PROJECT_ID: "another-marketplace" },
    { GCLOUD_PROJECT: "another-marketplace" }, { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "other-project.firebaseapp.com" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "other-project.firebasestorage.app" }, { TAKEME_STORAGE_BUCKETS: "" },
    { TAKEME_STORAGE_BUCKETS: "other-project.appspot.com" }, { TAKEME_STORAGE_BUCKETS: productionFixture().TAKEME_STORAGE_BUCKETS + "," },
    { TAKEME_STORAGE_BUCKETS: productionFixture().TAKEME_STORAGE_BUCKETS + "," + productionFixture().TAKEME_STORAGE_BUCKETS },
    { NEXT_PUBLIC_FIREBASE_APP_ID: "1:111111111111:web:" + "a".repeat(22) },
    { TAKEME_ENABLE_PRODUCTION_DELETION: "" }, { TAKEME_DELETION_ENVIRONMENT: "" }]) assert.throws(() => validateReleaseEnvironment({ ...productionFixture(), ...change }, approvedFixture));
});

test("production refuses local/demo values, every emulator host and noncanonical origins", () => {
  for (const NEXT_PUBLIC_SITE_URL of ["", "http://takeme.my", "http://localhost:3000", "https://127.0.0.1", "https://[::1]", "https://takeme.my/", "https://takeme.my/?preview=1", "https://user:password@takeme.my", "https://www.takeme.my"]) assert.throws(() => validateReleaseEnvironment({ ...productionFixture(), NEXT_PUBLIC_SITE_URL }, approvedFixture));
  for (const NEXT_PUBLIC_USE_FIREBASE_EMULATORS of ["true", "", "FALSE"]) assert.throws(() => validateReleaseEnvironment({ ...productionFixture(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS }, approvedFixture));
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "FUNCTIONS_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR"]) assert.throws(() => validateReleaseEnvironment({ ...productionFixture(), [key]: "127.0.0.1:9099" }, approvedFixture));
  for (const change of [{ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme", TAKEME_FIREBASE_PROJECT_ID: "demo-takeme" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-takeme.appspot.com" }, { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "http://localhost:5001/test" },
    { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "https://asia-southeast1-demo-other.cloudfunctions.net/call" }, { TAKEME_TEST_USER_ID: "test-user" },
    { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic.example.test" }, { PROTECTED_PAYMENTS_ENABLED: "true" }]) assert.throws(() => validateReleaseEnvironment({ ...productionFixture(), ...change }, approvedFixture));
});

test("demo configuration cannot mix live client resources and validation errors never echo values", () => {
  assert.throws(() => validateReleaseEnvironment({ ...demo, NEXT_PUBLIC_FIREBASE_API_KEY: productionFixture().NEXT_PUBLIC_FIREBASE_API_KEY }), /verified demo/);
  assert.throws(() => validateReleaseEnvironment({ ...demo, NEXT_PUBLIC_SITE_URL: "https://takeme.my" }), /loopback origin/);
  const rejectedValue = "sensitive-value-that-must-not-be-echoed";
  try { validateReleaseEnvironment({ ...productionFixture(), NEXT_PUBLIC_FIREBASE_API_KEY: rejectedValue }, approvedFixture); assert.fail("Expected rejection"); }
  catch (error) { assert.ok(error instanceof Error); assert.equal(error.message.includes(rejectedValue), false); }
});

test("first-party client proof binds actual Web SDK configuration and fails closed in optimized output", () => {
  const config = acceptedFixture();
  const client = { apiKey: config.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: config.publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: config.projectId, storageBucket: config.publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof(config), true), true);
  assert.equal(clientReleaseProofMatches(client, true, encodeReleaseProof(config), true), false);
  assert.equal(clientReleaseProofMatches({ ...client, projectId: "another-marketplace" }, false, encodeReleaseProof(config), true), false);
  assert.equal(clientReleaseProofMatches(client, false, undefined, true), false);
  assert.equal(clientReleaseProofMatches(client, false, "malformed", true), false);
});

async function artifactFixture(config = acceptedFixture()) {
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-release-test-"));
  await mkdir(path.join(directory, "server")); await mkdir(path.join(directory, "static", "chunks"), { recursive: true });
  await writeFile(path.join(directory, "BUILD_ID"), "synthetic-build\n");
  await writeFile(path.join(directory, "required-server-files.json"), JSON.stringify({ config: {
    env: { TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(config) },
    images: { dangerouslyAllowLocalIP: config.useEmulators, remotePatterns: [] },
  } }));
  // Third-party SDK helpers may contain local strings; inspect the configured
  // first-party marker rather than flagging unused SDK source as a live endpoint.
  await writeFile(path.join(directory, "static", "chunks", "client.js"), JSON.stringify(encodeReleaseProof(config)) + ';const sdkUnusedHost="127.0.0.1";');
  await recordReleaseArtifact(directory, config);
  return directory;
}

test("artifact provenance refuses demo promotion, changed environment, missing proof and changed bytes", async () => {
  const config = acceptedFixture();
  const directory = await artifactFixture(config);
  const demoConfig = validateReleaseEnvironment(demo);
  const demoDirectory = await artifactFixture(demoConfig);
  try {
    assert.equal((await validateReleaseArtifact(directory, config)).target, "production");
    assert.equal((await validateReleaseArtifact(demoDirectory, demoConfig, "demo")).target, "demo");
    await assert.rejects(validateReleaseArtifact(demoDirectory, config), /target/);
    await assert.rejects(validateReleaseArtifact(directory, { ...config, publicFirebase: { ...config.publicFirebase, NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "b".repeat(35) } }), /different configuration/);
    const client = path.join(directory, "static", "chunks", "client.js");
    await writeFile(client, (await readFile(client, "utf8")) + "tampered");
    await assert.rejects(validateReleaseArtifact(directory, config), /contents changed/);
    await writeFile(client, '"SDK has localhost but first-party proof is missing"');
    await assert.rejects(recordReleaseArtifact(directory, config), /missing its first-party/);
  } finally { await rm(directory, { recursive: true, force: true }); await rm(demoDirectory, { recursive: true, force: true }); }
});

test("artifact inspection rejects unsafe image configuration and another embedded runtime proof", async () => {
  const config = acceptedFixture(); const directory = await artifactFixture(config);
  try {
    const required = path.join(directory, "required-server-files.json");
    const data = JSON.parse(await readFile(required, "utf8")); data.config.images.dangerouslyAllowLocalIP = true;
    await writeFile(required, JSON.stringify(data));
    await assert.rejects(recordReleaseArtifact(directory, config), /local image IPs/);
    data.config.images.dangerouslyAllowLocalIP = false; await writeFile(required, JSON.stringify(data));
    await writeFile(path.join(directory, "static", "chunks", "client.js"), JSON.stringify(encodeReleaseProof(validateReleaseEnvironment(demo))));
    await assert.rejects(recordReleaseArtifact(directory, config), /different first-party/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
