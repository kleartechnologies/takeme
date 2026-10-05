import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeReleaseProof, releaseProofPrefix } from "../src/lib/release-proof.ts";
import { configurationFingerprint, validateReleaseArtifact, validateOfflineQualificationArtifact, validateStagingArtifact } from "./release-artifact.mjs";
import { readPreviewWrangler } from "./cloudflare-preview-policy.mjs";
import { readStagingSourceContext, assertStagingSourceMatches } from "./staging-source.mjs";

const manifestName = "takeme-cloudflare-artifact.json";
const inputNames = ["wrangler.jsonc", "open-next.config.mjs", "package-lock.json", ".next/takeme-release.json"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const relativePath = (directory, file) => path.relative(directory, file).split(path.sep).join("/");

async function ordinaryFile(file) {
  if (!(await lstat(file)).isFile()) throw new Error("Cloudflare artifact inputs must be ordinary local files; symbolic links are refused.");
  return readFile(file);
}

async function walk(directory) {
  if (!(await lstat(directory)).isDirectory()) throw new Error("Cloudflare artifact folders must be ordinary local directories.");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
    else throw new Error("Cloudflare artifact contains a symbolic link or unsupported file type.");
  }
  return files.sort();
}

async function jsonFile(file) {
  try { return JSON.parse((await ordinaryFile(file)).toString("utf8")); }
  catch { throw new Error("Cloudflare provenance or Next configuration is missing, unreadable or malformed."); }
}

async function nextPrecondition(repository, configuration) {
  if (!["production", "staging"].includes(configuration.target) || configuration.useEmulators !== false) throw new Error("Cloudflare artifact qualification requires remote structure with emulators disabled.");
  if (configuration.purpose === "staging-preview") await validateStagingArtifact(path.join(repository, ".next"), configuration);
  else if (configuration.purpose === "production-build") await validateReleaseArtifact(path.join(repository, ".next"), configuration);
  else if (configuration.purpose === "offline-qualification" && configuration.productionDeletionEnabled === false) await validateOfflineQualificationArtifact(path.join(repository, ".next"), configuration);
  else throw new Error("Cloudflare artifact purpose or deletion configuration is invalid.");
  const next = await jsonFile(path.join(repository, ".next", "required-server-files.json"));
  for (const key of Object.keys(next.config?.env || {})) {
    if (/(?:EMULATOR_HOST|EMULATOR_HUB)$/.test(key) || key === "FUNCTIONS_EMULATOR") throw new Error("Cloudflare Next configuration contains an emulator host or hub.");
  }
  const env = next.config?.env || {};
  if (Object.hasOwn(env, "NEXT_PUBLIC_USE_FIREBASE_EMULATORS") && env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false") throw new Error("Cloudflare Next configuration contains an invalid emulator flag.");
  if (configuration.purpose !== "offline-qualification" && Object.hasOwn(env, "TAKEME_OFFLINE_QUALIFICATION")) throw new Error("Offline Next output cannot qualify as a Cloudflare release.");
  if (configuration.purpose === "offline-qualification" && env.TAKEME_OFFLINE_QUALIFICATION !== "true") throw new Error("Offline Cloudflare qualification is missing its nondeployable Next marker.");
}

async function inputs(repository, staging = false) {
  const records = [];
  for (const name of [...inputNames, ...(staging ? ["workers/staging-entry.mjs", "workers/staging-access.mjs"] : [])]) {
    const bytes = await ordinaryFile(path.join(repository, name));
    records.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
  }
  return records;
}

async function inspect(directory, configuration) {
  await ordinaryFile(path.join(directory, "worker.js"));
  await walk(path.join(directory, "assets"));
  const inventory = (await walk(directory)).filter(file => relativePath(directory, file) !== manifestName);
  const expected = encodeReleaseProof(configuration);
  const pattern = new RegExp(`${releaseProofPrefix}[A-Za-z0-9+/=]+`, "g");
  let browserProofs = 0, workerProofs = 0;
  const files = [];
  for (const file of inventory) {
    const name = relativePath(directory, file), bytes = await ordinaryFile(file);
    files.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
    if (!/\.(?:m?js|cjs)$/.test(name)) continue;
    for (const proof of bytes.toString("utf8").match(pattern) || []) {
      if (proof !== expected) throw new Error("Cloudflare output contains a different first-party configuration proof.");
      if (name.startsWith("assets/")) browserProofs++;
      else workerProofs++;
    }
  }
  if (!browserProofs || !workerProofs) throw new Error("Cloudflare output is missing its browser or worker first-party configuration proof.");
  return { files, browserProofs, workerProofs };
}

// Receives an already validated pure configuration. Offline recording remains
// nondeployable; the ordinary CLI never accepts an approval or purpose override.
export async function recordCloudflareArtifact(repository, configuration, directory = path.join(repository, ".open-next"), initialSourceContext) {
  await nextPrecondition(repository, configuration);
  const staging = configuration.purpose === "staging-preview";
  const deploymentContext = staging ? await readPreviewWrangler(repository, configuration) : undefined;
  const sourceContext = staging ? await readStagingSourceContext(repository) : undefined;
  if (staging && initialSourceContext) assertStagingSourceMatches(initialSourceContext, sourceContext);
  const build = await inspect(directory, configuration);
  const manifest = { format: staging ? 2 : 1, purpose: configuration.purpose, target: configuration.target,
    ...(staging ? { deploymentContext, deploymentContextFingerprint: configurationFingerprint(deploymentContext), sourceContext } : {}),
    configurationFingerprint: configurationFingerprint(configuration), inputs: await inputs(repository, staging), ...build };
  await writeFile(path.join(directory, manifestName), JSON.stringify(manifest, null, 2) + "\n");
  return { purpose: manifest.purpose, files: build.files.length, browserProofs: build.browserProofs, workerProofs: build.workerProofs };
}

export async function validateCloudflareArtifact(repository, configuration, directory = path.join(repository, ".open-next")) {
  if (configuration.purpose !== "production-build" || configuration.target !== "production") throw new Error("Offline/staging Cloudflare output is nondeployable as production and cannot qualify as a production build.");
  return validate(repository, configuration, directory, "production-build");
}

export async function validateStagingCloudflareArtifact(repository, configuration, directory = path.join(repository, ".open-next")) {
  if (configuration.purpose !== "staging-preview" || configuration.target !== "staging" || configuration.productionDeletionEnabled !== false) throw new Error("Preview Cloudflare qualification requires isolated staging output with production deletion disabled.");
  const checked = await validate(repository, configuration, directory, "staging-preview");
  if (!checked.deploymentContext || !checked.sourceContext) throw new Error("Preview artifact is missing its validated deployment or source context.");
  return { ...checked, deploymentContext: checked.deploymentContext, sourceContext: checked.sourceContext };
}

export async function validateOfflineCloudflareArtifact(repository, configuration, directory = path.join(repository, ".open-next")) {
  if (configuration.purpose !== "offline-qualification" || configuration.productionDeletionEnabled !== false) throw new Error("Offline Cloudflare qualification requires its isolated purpose and disabled deletion execution.");
  return validate(repository, configuration, directory, "offline-qualification");
}

async function validate(repository, configuration, directory, purpose) {
  const manifest = await jsonFile(path.join(directory, manifestName));
  const staging = purpose === "staging-preview";
  if (manifest.format !== (staging ? 2 : 1) || manifest.target !== (staging ? "staging" : "production") || manifest.purpose !== purpose) throw new Error("Cloudflare artifact purpose or target does not match the requested qualification.");
  if (manifest.configurationFingerprint !== configurationFingerprint(configuration)) throw new Error("Cloudflare artifact was built with different configuration.");
  await nextPrecondition(repository, configuration);
  let deploymentContext;
  let sourceContext;
  if (staging) {
    deploymentContext = await readPreviewWrangler(repository, configuration);
    if (JSON.stringify(manifest.deploymentContext) !== JSON.stringify(deploymentContext)
      || manifest.deploymentContextFingerprint !== configurationFingerprint(deploymentContext)) throw new Error("Preview deployment environment or identity changed after recording.");
    sourceContext = await readStagingSourceContext(repository);
    assertStagingSourceMatches(manifest.sourceContext, sourceContext);
  }
  if (JSON.stringify(manifest.inputs) !== JSON.stringify(await inputs(repository, staging))) throw new Error("Cloudflare configuration, lockfile or Next provenance changed after recording.");
  const actual = await inspect(directory, configuration);
  if (JSON.stringify(manifest.files) !== JSON.stringify(actual.files)) throw new Error("Cloudflare artifact file inventory or contents changed after recording.");
  if (manifest.browserProofs !== actual.browserProofs || manifest.workerProofs !== actual.workerProofs) throw new Error("Cloudflare artifact proof inventory changed after recording.");
  return { purpose, files: actual.files.length, browserProofs: actual.browserProofs, workerProofs: actual.workerProofs,
    ...(staging ? { deploymentContext, sourceContext } : {}) };
}
