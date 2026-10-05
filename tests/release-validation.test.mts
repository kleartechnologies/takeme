import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReleaseEnvironment, validateProductionLaunchEnvironment, publicFirebaseKeys, type ReleasePolicy, type ReleaseEnvironment, offlineQualificationConfiguration, ownerOfflineQualificationConfiguration } from "../src/lib/release-config.ts";
import { clientReleaseProofMatches, encodeReleaseProof } from "../src/lib/release-proof.ts";
import { recordReleaseArtifact, validateReleaseArtifact, validateOfflineQualificationArtifact } from "../scripts/release-artifact.mjs";
import { validateLegalPublication, legalPublicationReadiness } from "../src/lib/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { spawnSync } from "node:child_process";
import { scanQualificationArtifact } from "../scripts/scan-qualification-artifact.mjs";
import { selectOfflineQualification, redactQualificationLog } from "../scripts/offline-qualification-options.mjs";

const approvedFixture: ReleasePolicy = { publicationApproved: true, termsVersion: "2026-10-05-v1", privacyVersion: "2026-10-05-v1", minimumAge: 18 };
const demo = { TAKEME_RELEASE_TARGET: "demo", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme" };
function productionFixture() {
  // Synthetic public configuration only. No SDK initializes and no network runs.
  const project = "takeme-52b80";
  return { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: project,
    TAKEME_STORAGE_BUCKETS: `${project}.firebasestorage.app`, TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "true",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${project}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22),
    NEXT_PUBLIC_SITE_URL: "https://takeme.my", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" };
}
const approvedLegal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "not-required" as const, address: "not-required" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };
const acceptRelease = (env: ReleaseEnvironment, policy: ReleasePolicy = approvedFixture) => validateReleaseEnvironment(env, policy, approvedLegal);
const acceptedFixture = () => validateReleaseEnvironment({ ...productionFixture(), TAKEME_ENABLE_PRODUCTION_DELETION: "false" });

test("optimized demo and synthetic production configuration require explicit target and correct policy", () => {
  assert.equal(validateReleaseEnvironment(demo).target, "demo");
  assert.equal(acceptedFixture().target, "production");
  assert.throws(() => validateReleaseEnvironment({ NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" }), /TAKEME_RELEASE_TARGET/);
  assert.equal(validateReleaseEnvironment(productionFixture()).policy, productionReleasePolicy);
  for (const policy of [{ ...approvedFixture, termsVersion: "1.0-draft" }, { ...approvedFixture, privacyVersion: null }, { ...approvedFixture, publicationApproved: false }]) assert.throws(() => validateProductionLaunchEnvironment(productionFixture(), policy, approvedLegal));
});

test("production refuses each absent Web App field, ambiguous project and mismatched resources", () => {
  for (const key of publicFirebaseKeys) {
    const env: Record<string, string> = productionFixture(); delete env[key];
    assert.throws(() => acceptRelease(env), new RegExp(key));
  }
  for (const change of [{ TAKEME_FIREBASE_PROJECT_ID: "" }, { TAKEME_FIREBASE_PROJECT_ID: "another-marketplace" },
    { GCLOUD_PROJECT: "another-marketplace" }, { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "other-project.firebaseapp.com" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "other-project.firebasestorage.app" }, { TAKEME_STORAGE_BUCKETS: "" },
    { TAKEME_STORAGE_BUCKETS: "other-project.appspot.com" }, { TAKEME_STORAGE_BUCKETS: productionFixture().TAKEME_STORAGE_BUCKETS + "," },
    { TAKEME_STORAGE_BUCKETS: productionFixture().TAKEME_STORAGE_BUCKETS + "," + productionFixture().TAKEME_STORAGE_BUCKETS },
    { NEXT_PUBLIC_FIREBASE_APP_ID: "1:111111111111:web:" + "a".repeat(22) },
    { TAKEME_ENABLE_PRODUCTION_DELETION: "" }, { TAKEME_DELETION_ENVIRONMENT: "" }]) assert.throws(() => acceptRelease({ ...productionFixture(), ...change }));
});

test("production refuses local/demo values, every emulator host and noncanonical origins", () => {
  for (const NEXT_PUBLIC_SITE_URL of ["", "http://takeme.my", "http://localhost:3000", "https://127.0.0.1", "https://[::1]", "https://takeme.my/", "https://takeme.my/?preview=1", "https://user:password@takeme.my", "https://www.takeme.my"]) assert.throws(() => acceptRelease({ ...productionFixture(), NEXT_PUBLIC_SITE_URL }));
  for (const NEXT_PUBLIC_USE_FIREBASE_EMULATORS of ["true", "", "FALSE"]) assert.throws(() => acceptRelease({ ...productionFixture(), NEXT_PUBLIC_USE_FIREBASE_EMULATORS }));
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "FUNCTIONS_EMULATOR_HOST", "FIREBASE_EMULATOR_HUB", "FUNCTIONS_EMULATOR"]) for (const value of ["127.0.0.1:9099", "", undefined]) assert.throws(() => acceptRelease({ ...productionFixture(), [key]: value }));
  for (const change of [{ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme", TAKEME_FIREBASE_PROJECT_ID: "demo-takeme" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-takeme.appspot.com" }, { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "http://localhost:5001/test" },
    { NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "https://asia-southeast1-demo-other.cloudfunctions.net/call" }, { TAKEME_TEST_USER_ID: "test-user" },
    { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic.example.test" }, { PROTECTED_PAYMENTS_ENABLED: "true" }]) assert.throws(() => acceptRelease({ ...productionFixture(), ...change }));
});

test("demo configuration cannot mix live client resources and validation errors never echo values", () => {
  assert.throws(() => validateReleaseEnvironment({ ...demo, NEXT_PUBLIC_FIREBASE_API_KEY: productionFixture().NEXT_PUBLIC_FIREBASE_API_KEY }), /verified demo/);
  assert.throws(() => validateReleaseEnvironment({ ...demo, NEXT_PUBLIC_SITE_URL: "https://takeme.my" }), /loopback origin/);
  const rejectedValue = "sensitive-value-that-must-not-be-echoed";
  try { acceptRelease({ ...productionFixture(), NEXT_PUBLIC_FIREBASE_API_KEY: rejectedValue }); assert.fail("Expected rejection"); }
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
    await assert.rejects(validateReleaseArtifact(demoDirectory, config), /target|purpose/);
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

test("ordinary releases independently require final legal content, applicability decisions and reviewed publication", () => {
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null);
  assert.throws(() => validateProductionLaunchEnvironment(productionFixture(), approvedFixture), /Independent legal publication|Final legal content|production publication/);
  for (const key of ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"] as const) assert.ok(validateLegalPublication({ ...approvedLegal, [key]: false }).length);
  for (const key of ["registration", "address"] as const) assert.ok(validateLegalPublication({ ...approvedLegal, [key]: "pending" }).length);
  assert.deepEqual(validateLegalPublication({ ...approvedLegal, registration: "approved", address: "approved" }), []);
  assert.throws(() => acceptRelease({ ...productionFixture(), TAKEME_OFFLINE_QUALIFICATION: "true" }), /ordinary release validator/);
});

test("offline production-mode output has complete synthetic structure, disabled execution and cannot become a release", async () => {
  const config = offlineQualificationConfiguration();
  assert.equal(config.target, "production");
  assert.equal(config.purpose, "offline-qualification");
  assert.equal(config.useEmulators, false);
  assert.equal(config.productionDeletionEnabled, false);
  assert.equal(config.siteUrl, "https://takeme.my");
  const client = { apiKey: config.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: config.publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: config.projectId, storageBucket: config.publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof(config), true), false, "No Firebase client may initialize from qualification output");
  const directory = await artifactFixture(config);
  try {
    assert.equal((await validateOfflineQualificationArtifact(directory, config)).target, "production");
    await assert.rejects(validateReleaseArtifact(directory, config), /nondeployable/);
    await assert.rejects(validateReleaseArtifact(directory, acceptedFixture()), /purpose/);
    const manifestFile = path.join(directory, "takeme-release.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.purpose = "production-build"; await writeFile(manifestFile, JSON.stringify(manifest));
    await assert.rejects(validateReleaseArtifact(directory, acceptedFixture()), /different configuration/);
    const requiredFile = path.join(directory, "required-server-files.json");
    const required = JSON.parse(await readFile(requiredFile, "utf8"));
    assert.equal(required.config.env.TAKEME_BUILD_RELEASE_PROOF, encodeReleaseProof(config));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("offline blocker denies known build transports before network and logs no target data", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-network-denial-"));
  const log = path.join(directory, "denials.log");
  try {
    const code = `const attempts = [() => fetch("https://private.example.invalid/token"), () => require("node:https").request("https://private.example.invalid"), () => require("node:http").get("http://127.0.0.1:9"), () => require("node:net").connect(9), () => require("node:tls").connect(9), () => require("node:dns").lookup("private.example.invalid", () => {}), () => require("node:child_process").exec("curl private.example.invalid")]; for (const attempt of attempts) { try { attempt(); process.exit(2); } catch(error) { if(error.code !== "TAKEME_OFFLINE_NETWORK_BLOCKED") process.exit(3); } }`;
    const result = spawnSync(process.execPath, ["--require", path.resolve("scripts/offline-network-block.cjs"), "-e", code], { env: { NODE_ENV: "production", TAKEME_OFFLINE_NETWORK_LOG: log }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const entries = await readFile(log, "utf8");
    assert.equal(entries.trim().split("\n").length, 7);
    assert.doesNotMatch(entries, /private|token|127\./);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("raw artifact inspection exposes vendor/helper and trace strings while identifying dangerous served content", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "takeme-artifact-scan-"));
  try {
    await writeFile(path.join(directory, "vendor.js"), 'const dormantSDKHost = "127.0.0.1:9099";');
    await writeFile(path.join(directory, "page.js.nft.json"), JSON.stringify({ files: ["/Users/developer/project/node_modules/next"] }));
    await writeFile(path.join(directory, "page.html"), '<img src="http://localhost:9199/demo-takeme/fixture">');
    const report = await scanQualificationArtifact(directory);
    assert.ok(report.rawHits.some(hit => hit.file === "vendor.js" && hit.classification === "bundled-code-review"));
    assert.ok(report.rawHits.some(hit => hit.file.endsWith("nft.json") && hit.classification === "build-provenance-or-dependency-trace"));
    assert.ok(report.servedContentHits.some(hit => hit.label === "demo-project"));
    assert.doesNotMatch(JSON.stringify(report), /\/Users\/developer|http:\/\/localhost/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const ownerIdentity = { projectId: "takeme-52b80", projectNumber: "123456789012" };
const ownerFixture = () => ({ ...productionFixture(), TAKEME_ENABLE_PRODUCTION_DELETION: "false" });

test("owner public configuration is explicitly bound offline while actual approval and SDK execution stay inactive", () => {
  const config = ownerOfflineQualificationConfiguration(ownerFixture(), ownerIdentity);
  assert.equal(config.purpose, "offline-qualification");
  assert.equal(config.target, "production");
  assert.equal(config.projectId, ownerIdentity.projectId);
  assert.equal(config.useEmulators, false);
  assert.equal(config.productionDeletionEnabled, false);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(validateReleaseEnvironment(ownerFixture()).purpose, "production-build");
  assert.throws(() => validateProductionLaunchEnvironment(ownerFixture()), /publication approval|policy version|legal publication|activated deletion/);
  const client = { apiKey: config.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: config.publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: config.projectId, storageBucket: config.publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: config.publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(clientReleaseProofMatches(client, false, encodeReleaseProof(config), true), false);
});

test("owner qualification refuses partial config, identity mismatch and enabled or mixed resources without echoing inputs", () => {
  for (const key of publicFirebaseKeys) {
    const env: ReleaseEnvironment = ownerFixture(); delete env[key];
    assert.throws(() => ownerOfflineQualificationConfiguration(env, ownerIdentity));
  }
  for (const identity of [{ ...ownerIdentity, projectId: "other-marketplace" }, { ...ownerIdentity, projectNumber: "111111111111" },
    { ...ownerIdentity, projectId: "" }, { ...ownerIdentity, projectNumber: "" }]) assert.throws(() => ownerOfflineQualificationConfiguration(ownerFixture(), identity));
  for (const change of [{ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "other-marketplace.firebasestorage.app" }, { TAKEME_STORAGE_BUCKETS: "demo-takeme.appspot.com" },
    { NEXT_PUBLIC_FIREBASE_APP_ID: "1:111111111111:web:" + "a".repeat(22) }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme" },
    { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }, { FIRESTORE_EMULATOR_HOST: "" },
    { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, { TAKEME_RELEASE_TARGET: "demo" }]) assert.throws(() => ownerOfflineQualificationConfiguration({ ...ownerFixture(), ...change }, ownerIdentity));
  const privateValue = "must-never-appear-in-validation-output";
  try { ownerOfflineQualificationConfiguration({ ...ownerFixture(), NEXT_PUBLIC_FIREBASE_API_KEY: privateValue }, ownerIdentity); assert.fail("Expected rejection"); }
  catch (error) { assert.ok(error instanceof Error); assert.equal(error.message.includes(privateValue), false); }
});

test("only the explicit owner CLI mode selects owner inputs and logs redact SDK values and encoded proofs", () => {
  const env = ownerFixture();
  assert.deepEqual(selectOfflineQualification([], env).configuration, offlineQualificationConfiguration(), "Process config cannot replace the fixed default profile");
  const args = ["--owner-config", "--project", ownerIdentity.projectId, "--project-number", ownerIdentity.projectNumber];
  const selected = selectOfflineQualification(args, env);
  assert.equal(selected.profile, "owner-config");
  assert.equal(selected.configuration.projectId, ownerIdentity.projectId);
  for (const invalid of [["--owner-config"], [...args, "--release"], ["--production"], ["--owner-config", "--project", ownerIdentity.projectId, "--project-number", ""]]) assert.throws(() => selectOfflineQualification(invalid, env));
  const log = Object.values(selected.configuration.publicFirebase).join("\n") + "\n" + encodeReleaseProof(selected.configuration);
  const safe = redactQualificationLog(log, selected.configuration);
  for (const value of Object.values(selected.configuration.publicFirebase)) assert.equal(safe.includes(value), false);
  assert.equal(safe.includes(encodeReleaseProof(selected.configuration)), false);
  assert.match(safe, /redacted-public-sdk/);
  assert.match(safe, /redacted-release-proof/);
});

test("owner-config output cannot be promoted by a future approved release config or changing its purpose marker", async () => {
  const config = ownerOfflineQualificationConfiguration(ownerFixture(), ownerIdentity);
  const directory = await artifactFixture(config);
  try {
    assert.equal((await validateOfflineQualificationArtifact(directory, config)).target, "production");
    const futureRelease = acceptRelease({ ...ownerFixture(), TAKEME_ENABLE_PRODUCTION_DELETION: "true" });
    await assert.rejects(validateReleaseArtifact(directory, futureRelease), /purpose/);
    const file = path.join(directory, "takeme-release.json");
    const manifest = JSON.parse(await readFile(file, "utf8")); manifest.purpose = "production-build";
    await writeFile(file, JSON.stringify(manifest));
    await assert.rejects(validateReleaseArtifact(directory, futureRelease), /different configuration/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
