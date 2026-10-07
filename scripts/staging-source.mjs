import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceFolders = ["src", "public", "scripts", "workers"];
const requiredFiles = ["package.json", "package-lock.json", "next.config.ts", "open-next.config.mjs", "wrangler.jsonc", "tsconfig.json"];
const optionalFiles = ["wrangler.staging.jsonc", "postcss.config.mjs", "eslint.config.mjs", "firestore.rules", "storage.rules", "firebase.json", "firestore.indexes.json",
  "functions/src/release-policy.ts", "functions/src/staging-environment.ts"];

async function git(repository, args) {
  // Resolve this checkout's metadata, never an inherited alternate Git directory,
  // index or config override. No command writes refs, objects or the index.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return (await exec("git", ["--no-optional-locks", "-C", repository, ...args], { env, maxBuffer: 1024 * 1024 })).stdout.trimEnd();
}

async function walk(directory) {
  if (!(await lstat(directory)).isDirectory()) throw new Error("Staging source folders must be ordinary local directories.");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
    else throw new Error("Staging source contains a symbolic link or unsupported file type.");
  }
  return files;
}

/** Explicit source folders/config files; external SDK/dotenv inputs and top-level
 * generated output, verification artifacts, tests and docs are outside this
 * inventory. Includes untracked source; Git ignore cannot hide an
 * imported source file from this content inventory. No file content is recorded.
 * @param {string} repository
 * @param {Record<string, string | undefined>} environment
 */
export async function readStagingSourceContext(repository, environment = process.env) {
  let gitRevision, buildBranch, branchSource, buildWorkingTreeClean;
  try {
    gitRevision = (await git(repository, ["rev-parse", "--verify", "HEAD^{commit}"])).trim();
    if (!/^[a-f0-9]{40}$/.test(gitRevision)) throw new Error();
    try {
      buildBranch = (await git(repository, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim();
      branchSource = "git";
      if (!buildBranch || environment.WORKERS_CI_BRANCH !== undefined && environment.WORKERS_CI_BRANCH !== buildBranch
        || environment.WORKERS_CI_COMMIT_SHA !== undefined && environment.WORKERS_CI_COMMIT_SHA !== gitRevision) throw new Error();
    } catch {
      // A failed branch lookup must actually be detached, not an inconsistent
      // attached branch whose CI variables happen to say staging.
      const detached = (await git(repository, ["rev-parse", "--abbrev-ref", "HEAD"])).trim() === "HEAD";
      if (!detached || environment.WORKERS_CI !== "1" || environment.WORKERS_CI_BRANCH !== "staging"
        || environment.WORKERS_CI_COMMIT_SHA !== gitRevision) throw new Error();
      buildBranch = "staging"; branchSource = "workers-ci";
    }
    buildWorkingTreeClean = !(await git(repository, ["status", "--porcelain", "--untracked-files=all"]));
  } catch { throw new Error("Staging source qualification requires this checkout's Git revision and a verified build branch; detached CI must match staging and its commit."); }
  const candidates = [];
  for (const folder of sourceFolders) candidates.push(...await walk(path.join(repository, folder)));
  for (const name of requiredFiles) {
    const file = path.join(repository, name);
    if (!(await lstat(file)).isFile()) throw new Error("Staging source configuration must consist of ordinary local files.");
    candidates.push(file);
  }
  for (const name of optionalFiles) {
    const file = path.join(repository, name);
    let info;
    try { info = await lstat(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!info.isFile()) throw new Error("Staging source configuration must consist of ordinary local files.");
    candidates.push(file);
  }
  const sourceFiles = [];
  for (const file of [...new Set(candidates)].sort()) {
    const bytes = await readFile(file);
    sourceFiles.push({ path: path.relative(repository, file).split(path.sep).join("/"), bytes: bytes.length, sha256: digest(bytes) });
  }
  sourceFiles.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { gitRevision, buildBranch, branchSource, buildWorkingTreeClean, sourceFingerprint: digest(JSON.stringify(sourceFiles)), sourceFiles };
}

export function assertStagingSourceMatches(recorded, current) {
  if (!recorded || JSON.stringify(recorded) !== JSON.stringify(current)) throw new Error("Staging artifact Git revision, build branch or source content differs from its recorded build; rebuild from the reviewed checkout.");
}

export function assertStagingDeploymentSource(source, revision) {
  if (!source || source.gitRevision !== revision || source.buildBranch !== "staging" || source.buildWorkingTreeClean !== true
    || !/^[a-f0-9]{64}$/.test(source.sourceFingerprint ?? "") || !Array.isArray(source.sourceFiles) || !source.sourceFiles.length) throw new Error("Preview plan requires an artifact originally built from the clean reviewed staging revision and its recorded source.");
}
