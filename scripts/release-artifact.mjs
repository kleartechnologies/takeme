import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { encodeReleaseProof, releaseProofPrefix } from "../src/lib/release-proof.ts";

const manifestName = "takeme-release.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const configurationFingerprint = config => sha256(JSON.stringify(config));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
async function artifactFiles(directory) {
  const files = [];
  for (const folder of ["static", "server"]) files.push(...await walk(path.join(directory, folder)));
  for (const file of ["BUILD_ID", "required-server-files.json", "routes-manifest.json", "prerender-manifest.json", "build-manifest.json", "app-path-routes-manifest.json", "images-manifest.json", "package.json"]) {
    try { if ((await stat(path.join(directory, file))).isFile()) files.push(path.join(directory, file)); } catch { /* optional Next manifest */ }
  }
  return [...new Set(files)].sort();
}
async function inspectFirstPartyBuild(directory, config) {
  const expectedProof = encodeReleaseProof(config);
  const required = JSON.parse(await readFile(path.join(directory, "required-server-files.json"), "utf8"));
  if (required.config?.env?.TAKEME_BUILD_RELEASE_PROOF !== expectedProof) throw new Error("Artifact does not contain the expected first-party release configuration proof.");
  if (config.target === "production") {
    if (required.config?.images?.dangerouslyAllowLocalIP !== false) throw new Error("Production artifact permits local image IPs.");
    if (required.config?.images?.remotePatterns?.some(pattern => /localhost|127\\?\.0\\?\.0\\?\.1|::1/.test(pattern.hostname || ""))) throw new Error("Production artifact contains a loopback image host.");
  }
  let embedded = 0;
  const proofPattern = new RegExp(`${releaseProofPrefix}[A-Za-z0-9+/=]+`, "g");
  for (const file of await walk(path.join(directory, "static"))) {
    if (!file.endsWith(".js")) continue;
    const content = await readFile(file, "utf8");
    for (const marker of content.match(proofPattern) || []) {
      if (marker !== expectedProof) throw new Error("Client artifact contains a different first-party release configuration proof.");
      embedded++;
    }
  }
  if (!embedded) throw new Error("Client artifact is missing its first-party release configuration proof.");
  return { embedded };
}

export async function recordReleaseArtifact(directory, config) {
  const { embedded } = await inspectFirstPartyBuild(directory, config);
  const files = [];
  for (const file of await artifactFiles(directory)) {
    const bytes = await readFile(file);
    files.push({ path: path.relative(directory, file).split(path.sep).join("/"), bytes: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = { format: 2, purpose: config.purpose, target: config.target, configurationFingerprint: configurationFingerprint(config),
    buildId: (await readFile(path.join(directory, "BUILD_ID"), "utf8")).trim(), embeddedProofs: embedded, files };
  await writeFile(path.join(directory, manifestName), JSON.stringify(manifest, null, 2) + "\n");
  return { target: config.target, files: files.length, embeddedProofs: embedded };
}

export async function validateReleaseArtifact(directory, config, requiredTarget = "production") {
  if (config.purpose !== "release") throw new Error("Offline qualification output is nondeployable and cannot qualify as a release artifact.");
  return validateArtifact(directory, config, requiredTarget, "release");
}

export async function validateOfflineQualificationArtifact(directory, config) {
  if (config.purpose !== "offline-qualification" || config.productionDeletionEnabled !== false) throw new Error("Offline artifact qualification requires its isolated purpose and disabled deletion execution.");
  return validateArtifact(directory, config, "production", "offline-qualification");
}

async function validateArtifact(directory, config, requiredTarget, purpose) {
  const manifest = JSON.parse(await readFile(path.join(directory, manifestName), "utf8"));
  if (manifest.purpose !== purpose || config.purpose !== purpose) throw new Error("Artifact purpose does not match release qualification; offline qualification output is nondeployable.");
  if (config.target !== requiredTarget || manifest.format !== 2 || manifest.target !== requiredTarget) throw new Error("Artifact target does not match the requested release qualification; demo output cannot qualify for production.");
  if (manifest.configurationFingerprint !== configurationFingerprint(config)) throw new Error("Artifact was built with different configuration; rebuild with the reviewed release environment.");
  if (manifest.buildId !== (await readFile(path.join(directory, "BUILD_ID"), "utf8")).trim()) throw new Error("Artifact build identity does not match its provenance.");
  const actualPaths = (await artifactFiles(directory)).map(file => path.relative(directory, file).split(path.sep).join("/"));
  if (!Array.isArray(manifest.files) || manifest.files.length !== actualPaths.length || JSON.stringify(manifest.files.map(file => file.path)) !== JSON.stringify(actualPaths)) throw new Error("Artifact file inventory changed after validation.");
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(directory, file.path));
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error("Artifact contents changed after validation.");
  }
  const result = await inspectFirstPartyBuild(directory, config);
  return { target: requiredTarget, files: manifest.files.length, embeddedProofs: result.embedded };
}
