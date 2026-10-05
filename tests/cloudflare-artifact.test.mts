import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateReleaseEnvironment, offlineQualificationConfiguration, type ReleaseConfiguration } from "../src/lib/release-config.ts";
import { encodeReleaseProof } from "../src/lib/release-proof.ts";
import { recordReleaseArtifact } from "../scripts/release-artifact.mjs";
import { recordCloudflareArtifact, validateCloudflareArtifact, validateOfflineCloudflareArtifact } from "../scripts/cloudflare-artifact.mjs";

function publicEnvironment() {
  const project = "takeme-52b80";
  return { TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: project,
    TAKEME_STORAGE_BUCKETS: `${project}.firebasestorage.app`, TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "true",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${project}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22),
    NEXT_PUBLIC_SITE_URL: "https://takeme.my", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" };
}
const approvedFixture = () => validateReleaseEnvironment(publicEnvironment(),
  { publicationApproved: true, termsVersion: "2026-10-05-v1", privacyVersion: "2026-10-05-v1", minimumAge: 18 },
  { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "not-required", address: "not-required", productionRoutesReviewed: true });

async function fixture(configuration: ReleaseConfiguration = approvedFixture()) {
  const repository = await mkdtemp(path.join(tmpdir(), "takeme-cloudflare-test-"));
  const next = path.join(repository, ".next"), output = path.join(repository, ".open-next");
  await mkdir(path.join(next, "server"), { recursive: true });
  await mkdir(path.join(next, "static", "chunks"), { recursive: true });
  await writeFile(path.join(next, "BUILD_ID"), "offline-test-build\n");
  await writeFile(path.join(next, "required-server-files.json"), JSON.stringify({ config: {
    env: { TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(configuration), ...(configuration.purpose === "offline-qualification" ? { TAKEME_OFFLINE_QUALIFICATION: "true" } : {}) },
    images: { dangerouslyAllowLocalIP: false, remotePatterns: [] },
  } }));
  await writeFile(path.join(next, "static", "chunks", "client.js"), JSON.stringify(encodeReleaseProof(configuration)));
  await recordReleaseArtifact(next, configuration);
  await mkdir(path.join(output, "assets", "_next", "static"), { recursive: true });
  await mkdir(path.join(output, "server-functions", "default"), { recursive: true });
  await mkdir(path.join(output, "cache"), { recursive: true });
  await writeFile(path.join(output, "worker.js"), 'export { fetch } from "./server-functions/default/index.mjs";');
  await writeFile(path.join(output, "server-functions", "default", "index.mjs"), JSON.stringify(encodeReleaseProof(configuration)));
  await writeFile(path.join(output, "assets", "_next", "static", "client.js"), JSON.stringify(encodeReleaseProof(configuration)) + ';const dormantVendorHost="localhost";');
  await writeFile(path.join(output, "assets", "logo.svg"), "<svg/>");
  await writeFile(path.join(output, "cache", "entry.json"), "{}");
  await writeFile(path.join(repository, "wrangler.jsonc"), '{"main":".open-next/worker.js","assets":{"directory":".open-next/assets"}}\n');
  await writeFile(path.join(repository, "open-next.config.mjs"), "export default {};\n");
  await writeFile(path.join(repository, "package-lock.json"), '{"lockfileVersion":3}\n');
  await recordCloudflareArtifact(repository, configuration);
  return { repository, next, output, configuration };
}
const cleanup = (repository: string) => rm(repository, { recursive: true, force: true });

test("Cloudflare provenance binds all worker/assets/cache bytes and matching browser and worker proofs", async () => {
  const f = await fixture();
  try {
    const checked = await validateCloudflareArtifact(f.repository, f.configuration);
    assert.equal(checked.files, 5);
    assert.equal(checked.browserProofs, 1);
    assert.equal(checked.workerProofs, 1);
    const manifest = JSON.parse(await readFile(path.join(f.output, "takeme-cloudflare-artifact.json"), "utf8"));
    assert.equal(manifest.inputs.length, 4);
    assert.equal(manifest.files.some((file: { path: string }) => file.path === "takeme-cloudflare-artifact.json"), false);
    assert.equal(JSON.stringify(manifest).includes(f.configuration.publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY), false);
  } finally { await cleanup(f.repository); }
});

test("Cloudflare qualification refuses changed worker, static asset, cache and file inventory", async () => {
  for (const name of ["worker.js", "assets/logo.svg", "cache/entry.json"]) {
    const f = await fixture();
    try {
      await writeFile(path.join(f.output, name), "changed");
      await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /contents changed/);
    } finally { await cleanup(f.repository); }
  }
  for (const change of ["add", "remove"] as const) {
    const f = await fixture();
    try {
      if (change === "add") await writeFile(path.join(f.output, "unexpected.js"), "extra");
      else await rm(path.join(f.output, "assets", "logo.svg"));
      await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /inventory or contents changed/);
    } finally { await cleanup(f.repository); }
  }
});

test("Cloudflare provenance refuses changed Wrangler, OpenNext, dependency lock and Next manifest", async () => {
  for (const name of ["wrangler.jsonc", "open-next.config.mjs", "package-lock.json", ".next/takeme-release.json"]) {
    const f = await fixture();
    try {
      await writeFile(path.join(f.repository, name), (await readFile(path.join(f.repository, name), "utf8")) + "\n");
      await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /provenance changed/);
    } finally { await cleanup(f.repository); }
  }
  const f = await fixture();
  try {
    await writeFile(path.join(f.next, "static", "chunks", "client.js"), "changed Next source");
    await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /contents changed/);
  } finally { await cleanup(f.repository); }
});

test("Cloudflare inspection rejects wrong or missing first-party proofs on either runtime side", async () => {
  for (const name of ["assets/_next/static/client.js", "server-functions/default/index.mjs"]) {
    for (const content of ["missing", encodeReleaseProof(offlineQualificationConfiguration())]) {
      const f = await fixture();
      try {
        await writeFile(path.join(f.output, name), content);
        await assert.rejects(recordCloudflareArtifact(f.repository, f.configuration), /missing its browser or worker|different first-party/);
      } finally { await cleanup(f.repository); }
    }
  }
});

test("Cloudflare qualification is configuration-bound and cannot promote an offline artifact", async () => {
  const f = await fixture();
  try {
    await assert.rejects(validateCloudflareArtifact(f.repository, { ...f.configuration, storageBuckets: [...f.configuration.storageBuckets, "takeme-52b80.appspot.com"] }), /different configuration/);
    await assert.rejects(recordCloudflareArtifact(f.repository, { ...f.configuration, useEmulators: true }), /emulators disabled/);
  } finally { await cleanup(f.repository); }
  const offline = await fixture(offlineQualificationConfiguration());
  try {
    assert.equal((await validateOfflineCloudflareArtifact(offline.repository, offline.configuration)).purpose, "offline-qualification");
    await assert.rejects(validateCloudflareArtifact(offline.repository, offline.configuration), /nondeployable/);
    const futureRelease = { ...offline.configuration, purpose: "production-build" as const, productionDeletionEnabled: true };
    await assert.rejects(validateCloudflareArtifact(offline.repository, futureRelease), /purpose/);
    const manifestFile = path.join(offline.output, "takeme-cloudflare-artifact.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8")); manifest.purpose = "production-build";
    await writeFile(manifestFile, JSON.stringify(manifest));
    await assert.rejects(validateCloudflareArtifact(offline.repository, futureRelease), /different configuration/);
  } finally { await cleanup(offline.repository); }
});

test("Cloudflare qualification rejects emulator hosts in effective Next config even after new Next provenance", async () => {
  for (const injected of [{ FIRESTORE_EMULATOR_HOST: "" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "" }, { TAKEME_OFFLINE_QUALIFICATION: "true" }]) {
    const f = await fixture();
    try {
      const file = path.join(f.next, "required-server-files.json");
      const next = JSON.parse(await readFile(file, "utf8"));
      Object.assign(next.config.env, injected);
      await writeFile(file, JSON.stringify(next));
      if (injected.TAKEME_OFFLINE_QUALIFICATION) await assert.rejects(recordReleaseArtifact(f.next, f.configuration), /Offline Next output/);
      else {
        await recordReleaseArtifact(f.next, f.configuration);
        await assert.rejects(recordCloudflareArtifact(f.repository, f.configuration), /emulator host or hub|invalid emulator flag/);
      }
    } finally { await cleanup(f.repository); }
  }
});

test("Cloudflare qualification refuses symlinks and malformed provenance without exposing file contents", async () => {
  for (const location of ["output", "input"] as const) {
    const f = await fixture();
    try {
      if (location === "output") await symlink(path.join(f.output, "assets", "logo.svg"), path.join(f.output, "unexpected-link"));
      else {
        await rm(path.join(f.repository, "open-next.config.mjs"));
        await symlink(path.join(f.repository, "package-lock.json"), path.join(f.repository, "open-next.config.mjs"));
      }
      await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), /symbolic link/);
    } finally { await cleanup(f.repository); }
  }
  const f = await fixture();
  try {
    const value = "never-echo-private-file-content";
    await writeFile(path.join(f.output, "takeme-cloudflare-artifact.json"), value);
    await assert.rejects(validateCloudflareArtifact(f.repository, f.configuration), error => error instanceof Error && /malformed/.test(error.message) && !error.message.includes(value));
  } finally { await cleanup(f.repository); }
});

test("ordinary Cloudflare CLI uses actual inactive policy and accepts no qualification override", () => {
  for (const args of [[], ["--offline-qualification"]]) {
    const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "scripts/check-cloudflare-artifact.mjs", ...args],
      { encoding: "utf8", env: { NODE_ENV: "production", ...publicEnvironment() } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, args.length ? /no environment, approval or qualification overrides/ : /provenance|configuration/);
    for (const value of [publicEnvironment().NEXT_PUBLIC_FIREBASE_API_KEY, publicEnvironment().NEXT_PUBLIC_FIREBASE_APP_ID]) assert.equal(result.stderr.includes(value), false);
  }
});
