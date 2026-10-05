import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { stagingEnvironment } from "../functions/src/staging-environment.ts";
import { validateReleaseEnvironment, offlineQualificationConfiguration, type ReleaseConfiguration } from "../src/lib/release-config.ts";
import { encodeReleaseProof } from "../src/lib/release-proof.ts";
import { recordReleaseArtifact, validateReleaseArtifact, validateStagingArtifact } from "../scripts/release-artifact.mjs";
import { recordCloudflareArtifact, validateCloudflareArtifact, validateStagingCloudflareArtifact } from "../scripts/cloudflare-artifact.mjs";
import { previewWorkerIdentity, validatePreviewWrangler, validatePreviewPlanApproval, previewTesterFingerprint, assertPreviewWorkingTreeClean } from "../scripts/cloudflare-preview-policy.mjs";
import { readStagingSourceContext, assertStagingDeploymentSource } from "../scripts/staging-source.mjs";

function stagingEnvironmentFixture() {
  return { TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId,
    TAKEME_FIREBASE_PROJECT_NUMBER: stagingEnvironment.projectNumber,
    TAKEME_STORAGE_BUCKETS: stagingEnvironment.storageBucket, TAKEME_DELETION_ENVIRONMENT: "staging",
    TAKEME_ENABLE_PRODUCTION_DELETION: "false", TAKEME_ENABLE_STAGING_DELETION: "false",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: stagingEnvironment.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: stagingEnvironment.projectId, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: stagingEnvironment.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: stagingEnvironment.projectNumber,
    NEXT_PUBLIC_FIREBASE_APP_ID: `1:${stagingEnvironment.projectNumber}:web:` + "a".repeat(22),
    NEXT_PUBLIC_SITE_URL: stagingEnvironment.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" };
}
const stagingConfiguration = () => validateReleaseEnvironment(stagingEnvironmentFixture());
type WranglerFixture = {
  name: string; account_id: string; main: string; workers_dev: boolean; preview_urls: boolean;
  assets: { directory: string; binding: string; run_worker_first: boolean };
  env: { preview: { name: string; account_id: string; main: string; workers_dev: boolean; preview_urls: boolean;
    services: { binding: string; service: string }[]; images: { binding: string }; vars: Record<string, string> } };
};
function wranglerFixture(): WranglerFixture {
  return { name: "takeme-web", account_id: previewWorkerIdentity.accountId, main: ".open-next/worker.js",
    workers_dev: false, preview_urls: false,
    assets: { directory: ".open-next/assets", binding: "ASSETS", run_worker_first: true },
    env: { preview: { name: previewWorkerIdentity.workerName, account_id: previewWorkerIdentity.accountId,
      main: "workers/staging-entry.mjs", workers_dev: false, preview_urls: false,
      services: [{ binding: "WORKER_SELF_REFERENCE", service: previewWorkerIdentity.workerName }], images: { binding: "IMAGES" },
      vars: { TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: stagingEnvironment.projectId, NEXT_PUBLIC_SITE_URL: stagingEnvironment.siteUrl,
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false" } } } };
}
// Minimal synthetic Git metadata entirely within a temporary fixture. No commit,
// branch, index or object-writing Git command touches the user's repository.
async function fixtureGit(repository: string, branch = "staging", message = "synthetic fixture", detached = false) {
  const directory = path.join(repository, ".git");
  await mkdir(path.join(directory, "refs", "heads"), { recursive: true });
  await writeFile(path.join(directory, "config"), "[core]\nrepositoryformatversion = 0\nbare = false\n");
  async function object(kind: string, content: string) {
    const bytes = Buffer.from(content), encoded = Buffer.concat([Buffer.from(`${kind} ${bytes.length}\0`), bytes]);
    const hash = createHash("sha1").update(encoded).digest("hex");
    await mkdir(path.join(directory, "objects", hash.slice(0, 2)), { recursive: true });
    await writeFile(path.join(directory, "objects", hash.slice(0, 2), hash.slice(2)), deflateSync(encoded));
    return hash;
  }
  const tree = await object("tree", "");
  const revision = await object("commit", `tree ${tree}\nauthor Fixture <fixture@example.invalid> 1 +0000\ncommitter Fixture <fixture@example.invalid> 1 +0000\n\n${message}\n`);
  await writeFile(path.join(directory, "refs", "heads", branch), revision + "\n");
  await writeFile(path.join(directory, "HEAD"), detached ? revision + "\n" : `ref: refs/heads/${branch}\n`);
  return revision;
}
async function artifactFixture(configuration: ReleaseConfiguration = stagingConfiguration(), wrangler = wranglerFixture()) {
  const repository = await mkdtemp(path.join(tmpdir(), "takeme-staging-artifact-test-"));
  const next = path.join(repository, ".next"), output = path.join(repository, ".open-next");
  await mkdir(path.join(next, "server"), { recursive: true });
  await mkdir(path.join(next, "static"), { recursive: true });
  await writeFile(path.join(next, "BUILD_ID"), "staging-fixture\n");
  await writeFile(path.join(next, "required-server-files.json"), JSON.stringify({ config: {
    env: { TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(configuration) },
    images: { dangerouslyAllowLocalIP: false, remotePatterns: [] } } }));
  await writeFile(path.join(next, "static", "client.js"), JSON.stringify(encodeReleaseProof(configuration)));
  await recordReleaseArtifact(next, configuration);
  await mkdir(path.join(output, "assets"), { recursive: true });
  await writeFile(path.join(output, "worker.js"), JSON.stringify(encodeReleaseProof(configuration)));
  await writeFile(path.join(output, "assets", "client.js"), JSON.stringify(encodeReleaseProof(configuration)));
  await mkdir(path.join(repository, "workers"));
  await writeFile(path.join(repository, "workers", "staging-entry.mjs"), 'export { default } from "../.open-next/worker.js";');
  await writeFile(path.join(repository, "workers", "staging-access.mjs"), 'export const failClosed = true;');
  await writeFile(path.join(repository, "wrangler.jsonc"), JSON.stringify(wrangler));
  await writeFile(path.join(repository, "open-next.config.mjs"), "export default {};\n");
  await writeFile(path.join(repository, "package-lock.json"), '{"lockfileVersion":3}\n');
  await writeFile(path.join(repository, "package.json"), '{"private":true}\n');
  await writeFile(path.join(repository, "next.config.ts"), "export default {};\n");
  await writeFile(path.join(repository, "tsconfig.json"), '{}\n');
  for (const folder of ["src", "public", "scripts"]) await mkdir(path.join(repository, folder));
  await writeFile(path.join(repository, "src", "page.tsx"), 'export const syntheticPage = "STAGING";\n');
  await writeFile(path.join(repository, "public", "brand.svg"), "<svg/>\n");
  await fixtureGit(repository);
  await recordCloudflareArtifact(repository, configuration);
  return { repository, next, output, configuration };
}
const cleanup = (repository: string) => rm(repository, { recursive: true, force: true });

test("staging provenance binds the selected environment, account, Worker, hostname and Access wrapper bytes", async () => {
  const f = await artifactFixture();
  try {
    assert.equal((await validateStagingArtifact(f.next, f.configuration)).target, "staging");
    assert.equal((await validateStagingCloudflareArtifact(f.repository, f.configuration)).purpose, "staging-preview");
    const manifest = JSON.parse(await readFile(path.join(f.output, "takeme-cloudflare-artifact.json"), "utf8"));
    assert.equal(manifest.format, 2);
    assert.equal(manifest.deploymentContext.environment, "preview");
    assert.equal(manifest.deploymentContext.accountId, previewWorkerIdentity.accountId);
    assert.equal(manifest.deploymentContext.workerName, previewWorkerIdentity.workerName);
    assert.equal(manifest.deploymentContext.siteUrl, stagingEnvironment.siteUrl);
    assert.equal(manifest.deploymentContext.workersDev, false);
    assert.equal(manifest.inputs.length, 6);
    assert.equal(manifest.sourceContext.buildBranch, "staging");
    assert.match(manifest.sourceContext.gitRevision, /^[a-f0-9]{40}$/);
    assert.match(manifest.sourceContext.sourceFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(manifest).includes(f.configuration.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY), false);
  } finally { await cleanup(f.repository); }
});

test("staging artifacts cannot qualify as production, demo or offline output", async () => {
  const f = await artifactFixture();
  try {
    await assert.rejects(validateReleaseArtifact(f.next, f.configuration), /cannot qualify/);
    await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /nondeployable/);
    await assert.rejects(validateStagingArtifact(f.next, { ...f.configuration, purpose: "release" }), /isolated/);
    await assert.rejects(validateStagingCloudflareArtifact(f.repository, offlineQualificationConfiguration()), /isolated/);
    const promoted = { ...f.configuration, target: "production" as const, purpose: "production-build" as const, productionDeletionEnabled: true };
    await assert.rejects(validateReleaseArtifact(f.next, promoted), /purpose/);
    await assert.rejects(validateCloudflareArtifact(f.repository, promoted), /purpose or target/);
  } finally { await cleanup(f.repository); }
});

test("preview identity rejects wrong account/Worker/entry point, inherited domains and arbitrary preview URLs", () => {
  const configuration = stagingConfiguration();
  for (const mutation of [
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.account_id = "a".repeat(32); },
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.name = "takeme-web"; },
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.main = ".open-next/worker.js"; },
    (w: ReturnType<typeof wranglerFixture>) => { w.workers_dev = true; },
    (w: ReturnType<typeof wranglerFixture>) => { Object.assign(w.env.preview, { workers_dev: "true" }); },
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.preview_urls = true; },
    (w: ReturnType<typeof wranglerFixture>) => { Object.assign(w, { routes: [{ pattern: "takeme.my", custom_domain: true }] }); },
    (w: ReturnType<typeof wranglerFixture>) => { Object.assign(w.env.preview, { route: "takeme.my/*" }); },
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.services[0].service = "takeme-web"; },
    (w: ReturnType<typeof wranglerFixture>) => { Object.assign(w.env.preview.services[0], { environment: "production" }); },
    (w: ReturnType<typeof wranglerFixture>) => { w.env.preview.images.binding = "OTHER_IMAGES"; },
  ]) {
    const w = wranglerFixture(); mutation(w);
    assert.throws(() => validatePreviewWrangler(w, configuration), /Preview/);
  }
});

test("approved future workers.dev activation is buildable and invalidates the earlier disabled-routing artifact", async () => {
  const activated = wranglerFixture(); activated.env.preview.workers_dev = true;
  const disabled = await artifactFixture();
  try {
    await writeFile(path.join(disabled.repository, "wrangler.jsonc"), JSON.stringify(activated));
    await assert.rejects(validateStagingCloudflareArtifact(disabled.repository, disabled.configuration), /identity changed/);
  } finally { await cleanup(disabled.repository); }
  const rebuilt = await artifactFixture(stagingConfiguration(), activated);
  try {
    const result = await validateStagingCloudflareArtifact(rebuilt.repository, rebuilt.configuration);
    assert.equal(result.deploymentContext.workersDev, true);
    const manifest = JSON.parse(await readFile(path.join(rebuilt.output, "takeme-cloudflare-artifact.json"), "utf8"));
    assert.equal(manifest.deploymentContext.workersDev, true);
    await assert.rejects(validateCloudflareArtifact(rebuilt.repository, rebuilt.configuration), /nondeployable/);
  } finally { await cleanup(rebuilt.repository); }
});

test("preview requires its own runtime variables and rejects production, emulator or build mismatches", () => {
  const configuration = stagingConfiguration();
  for (const injection of [
    { TAKEME_RELEASE_TARGET: "production" }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" },
    { NEXT_PUBLIC_SITE_URL: "https://takeme.my" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" },
    { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }, { FIRESTORE_EMULATOR_HOST: "" },
    { UNKNOWN_EMULATOR_SWITCH: "" }, { FIREBASE_CONFIG: '{"projectId":"takeme-52b80"}' },
    { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com" },
    { TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app" }, { TAKEME_OFFLINE_QUALIFICATION: "false" },
  ]) {
    const w = wranglerFixture(); Object.assign(w.env.preview.vars, injection);
    assert.throws(() => validatePreviewWrangler(w, configuration), /runtime|Preview/);
  }
  const w = wranglerFixture(); delete (w.env.preview as { vars?: object }).vars;
  Object.assign(w, { vars: wranglerFixture().env.preview.vars });
  assert.throws(() => validatePreviewWrangler(w, configuration), /explicitly staging-bound/);
});

test("postbuild Access wrapper edits, Worker bytes and selected-context tampering invalidate provenance", async () => {
  for (const name of ["workers/staging-entry.mjs", "workers/staging-access.mjs", ".open-next/worker.js"]) {
    const f = await artifactFixture();
    try {
      await writeFile(path.join(f.repository, name), "changed");
      await assert.rejects(validateStagingCloudflareArtifact(f.repository, f.configuration), /provenance changed|proof|contents changed|source content/);
    } finally { await cleanup(f.repository); }
  }
  const f = await artifactFixture();
  try {
    const file = path.join(f.output, "takeme-cloudflare-artifact.json");
    const manifest = JSON.parse(await readFile(file, "utf8"));
    manifest.deploymentContext.accountId = "a".repeat(32);
    await writeFile(file, JSON.stringify(manifest));
    await assert.rejects(validateStagingCloudflareArtifact(f.repository, f.configuration), /identity changed/);
  } finally { await cleanup(f.repository); }
});

test("staging artifacts are bound to their original Git revision and build branch", async () => {
  for (const change of ["revision", "branch"] as const) {
    const f = await artifactFixture();
    try {
      await fixtureGit(f.repository, change === "branch" ? "main" : "staging", change === "revision" ? "different fixture revision" : "synthetic fixture");
      await assert.rejects(validateStagingCloudflareArtifact(f.repository, f.configuration), /Git revision, build branch or source content/);
    } finally { await cleanup(f.repository); }
  }
});

test("source edits, new ignored source and dirty-build/reset at the same SHA cannot reuse an old artifact", async () => {
  for (const change of ["source", "asset", "new-source", "dirty-reset"] as const) {
    const f = await artifactFixture();
    try {
      if (change === "asset") await writeFile(path.join(f.repository, "public", "brand.svg"), "<svg>changed</svg>");
      else if (change === "new-source") {
        await writeFile(path.join(f.repository, ".gitignore"), "src/ignored.ts\n");
        await writeFile(path.join(f.repository, "src", "ignored.ts"), 'export const ignoredSource = true;');
      } else {
        const file = path.join(f.repository, "src", "page.tsx");
        const cleanBytes = await readFile(file);
        await writeFile(file, "export const changedDuringQualification = true;");
        if (change === "dirty-reset") {
          await recordCloudflareArtifact(f.repository, f.configuration);
          await writeFile(file, cleanBytes);
        }
      }
      await assert.rejects(validateStagingCloudflareArtifact(f.repository, f.configuration), /source content/);
    } finally { await cleanup(f.repository); }
  }
});

test("staging recording detects source changes during a build and keeps local main qualification nondeployable", async () => {
  const f = await artifactFixture();
  try {
    const initial = await readStagingSourceContext(f.repository);
    await writeFile(path.join(f.repository, "src", "page.tsx"), "changed after build started");
    await assert.rejects(recordCloudflareArtifact(f.repository, f.configuration, f.output, initial), /source content/);
    await fixtureGit(f.repository, "main");
    await recordCloudflareArtifact(f.repository, f.configuration);
    const checked = await validateStagingCloudflareArtifact(f.repository, f.configuration);
    assert.equal(checked.sourceContext.buildBranch, "main");
    assert.throws(() => assertStagingDeploymentSource({ ...checked.sourceContext, buildWorkingTreeClean: true }, checked.sourceContext.gitRevision), /clean reviewed staging revision/);
  } finally { await cleanup(f.repository); }
});

test("detached staging source accepts only verified Workers CI branch and matching SHA", async () => {
  const f = await artifactFixture();
  try {
    const sha = await fixtureGit(f.repository, "staging", "synthetic fixture", true);
    await assert.rejects(readStagingSourceContext(f.repository, {}), /detached CI/);
    await assert.rejects(readStagingSourceContext(f.repository, { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", WORKERS_CI_COMMIT_SHA: sha }), /detached CI/);
    await assert.rejects(readStagingSourceContext(f.repository, { WORKERS_CI: "1", WORKERS_CI_BRANCH: "staging", WORKERS_CI_COMMIT_SHA: "a".repeat(40) }), /detached CI/);
    const context = await readStagingSourceContext(f.repository, { WORKERS_CI: "1", WORKERS_CI_BRANCH: "staging", WORKERS_CI_COMMIT_SHA: sha });
    assert.equal(context.gitRevision, sha); assert.equal(context.buildBranch, "staging"); assert.equal(context.branchSource, "workers-ci");
    assert.throws(() => assertStagingDeploymentSource(context, sha), /clean reviewed staging revision/);
    assert.doesNotThrow(() => assertStagingDeploymentSource({ ...context, buildWorkingTreeClean: true }, sha));
  } finally { await cleanup(f.repository); }
});

test("staging effective Next configuration cannot permit loopback images or emulator hosts", async () => {
  const f = await artifactFixture();
  try {
    const file = path.join(f.next, "required-server-files.json");
    const next = JSON.parse(await readFile(file, "utf8"));
    next.config.images.dangerouslyAllowLocalIP = true;
    await writeFile(file, JSON.stringify(next));
    await assert.rejects(recordReleaseArtifact(f.next, f.configuration), /local image IPs/);
    next.config.images.dangerouslyAllowLocalIP = false;
    next.config.env.FIRESTORE_EMULATOR_HOST = "";
    await writeFile(file, JSON.stringify(next)); await recordReleaseArtifact(f.next, f.configuration);
    await assert.rejects(recordCloudflareArtifact(f.repository, f.configuration), /emulator host/);
  } finally { await cleanup(f.repository); }
});

const revision = "b".repeat(40), now = Date.UTC(2026, 9, 4, 12);
function accessEvidence() {
  return { ...previewWorkerIdentity, revision, applicationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    policyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", approvedTestersConfirmed: true,
    anonymousDenied: true, anonymousStatus: 403, denialCheckedAt: new Date(now).toISOString(),
    accessTeamDomain: "https://test-team.cloudflareaccess.com", accessAud: "c".repeat(64),
    testerAllowlistSha256: previewTesterFingerprint('["tester@example.invalid"]') };
}
function approvalEnvironment() {
  return { TAKEME_PREVIEW_DEPLOYMENT_APPROVED: "true", CF_ACCESS_TEAM_DOMAIN: "https://test-team.cloudflareaccess.com", CF_ACCESS_AUD: "c".repeat(64), CF_ACCESS_ALLOWED_EMAILS: '["tester@example.invalid"]' };
}
const disabledContext = () => validatePreviewWrangler(wranglerFixture(), stagingConfiguration());
test("plan-only approval requires exact reviewed Access evidence and never represents a deployment", () => {
  const context = disabledContext();
  const result = validatePreviewPlanApproval(approvalEnvironment(), accessEvidence(), revision, "staging", context, now);
  assert.equal(result.deploymentExecuted, false);
  assert.equal(result.routingActivationRequired, true);
  assert.equal(validatePreviewPlanApproval(approvalEnvironment(), { ...accessEvidence(), anonymousStatus: 302, anonymousRedirectOrigin: accessEvidence().accessTeamDomain }, revision, "staging", context, now).deploymentExecuted, false);
  for (const branch of ["main", "HEAD", "", "feature"]) assert.throws(() => validatePreviewPlanApproval(approvalEnvironment(), accessEvidence(), revision, branch, context, now), /staging branch/);
  for (const injected of [{ TAKEME_PREVIEW_DEPLOYMENT_APPROVED: "false" }, { WORKERS_CI_BRANCH: "main" }, { WORKERS_CI_COMMIT_SHA: "a".repeat(40) }, { CF_ACCESS_AUD: "d".repeat(64) }, { CF_ACCESS_ALLOWED_EMAILS: '["different@example.invalid"]' }, { CF_ACCESS_ALLOWED_EMAILS: "" }]) {
    assert.throws(() => validatePreviewPlanApproval({ ...approvalEnvironment(), ...injected }, accessEvidence(), revision, "staging", context, now));
  }
  for (const injected of [{ accountId: "a".repeat(32) }, { environment: "production" }, { workerName: "takeme-web" },
    { siteUrl: "https://takeme.my" }, { revision: "a".repeat(40) }, { approvedTestersConfirmed: false },
    { anonymousDenied: false }, { anonymousStatus: 200 }, { anonymousStatus: 302, anonymousRedirectOrigin: "https://untrusted.example.invalid" }, { policyId: "" }, { applicationId: "-".repeat(36) },
    { denialCheckedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() }, { denialCheckedAt: new Date(now + 1).toISOString() }]) {
    assert.throws(() => validatePreviewPlanApproval(approvalEnvironment(), { ...accessEvidence(), ...injected }, revision, "staging", context, now));
  }
});

test("plan reports the validated routing state and still requires approval and Access after activation", () => {
  const w = wranglerFixture(); w.env.preview.workers_dev = true;
  const context = validatePreviewWrangler(w, stagingConfiguration());
  const result = validatePreviewPlanApproval(approvalEnvironment(), accessEvidence(), revision, "staging", context, now);
  assert.equal(result.workersDev, true); assert.equal(result.routingActivationRequired, false); assert.equal(result.deploymentExecuted, false);
  assert.throws(() => validatePreviewPlanApproval({ ...approvalEnvironment(), TAKEME_PREVIEW_DEPLOYMENT_APPROVED: "false" }, accessEvidence(), revision, "staging", context, now), /owner/);
  assert.throws(() => validatePreviewPlanApproval(approvalEnvironment(), { ...accessEvidence(), anonymousDenied: false }, revision, "staging", context, now), /Access evidence/);
  for (const poisoned of [{ ...context, environment: "production" }, { ...context, previewUrls: true }, { ...context, workerName: "takeme-web" }]) {
    assert.throws(() => validatePreviewPlanApproval(approvalEnvironment(), accessEvidence(), revision, "staging", poisoned, now), /validated staging deployment context/);
  }
});

test("deployment planning refuses tracked changes and nonignored untracked source files", () => {
  assert.doesNotThrow(() => assertPreviewWorkingTreeClean(""));
  for (const status of [" M wrangler.jsonc\n", "?? workers/staging-entry.mjs\n", "?? functions/src/staging-environment.ts\n", "?? docs/unreviewed-plan.md\n"]) {
    assert.throws(() => assertPreviewWorkingTreeClean(status), /clean working tree/);
  }
});

test("build/check/plan CLIs refuse unapproved selectors and execution before doing work", () => {
  for (const [script, args] of [
    ["scripts/build-cloudflare.mjs", ["--env", "production"]],
    ["scripts/check-cloudflare-artifact.mjs", ["--staging", "--offline-qualification"]],
    ["scripts/plan-preview-deployment.mjs", ["--execute"]],
    ["scripts/validate-release.mjs", ["--demo", "--staging"]],
  ] as const) {
    const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", script, ...args],
      { encoding: "utf8", env: { NODE_ENV: "production", ...stagingEnvironmentFixture() } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /selector|overrides/);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(stagingEnvironmentFixture().NEXT_PUBLIC_FIREBASE_API_KEY), false);
  }
});
