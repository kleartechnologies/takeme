import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { validateStagingCloudflareArtifact } from "./cloudflare-artifact.mjs";
import { validatePreviewPlanApproval, assertPreviewWorkingTreeClean } from "./cloudflare-preview-policy.mjs";
import { checkReleaseRules } from "./check-release-rules.mjs";
import { loadStagingBuildEnvironment } from "./staging-environment.mjs";
import { assertStagingDeploymentSource } from "./staging-source.mjs";

// This command can only prepare a future plan. It has no deployment implementation.
try {
  if (process.argv.length !== 2) throw new Error("Preview planning accepts no target, approval or execution overrides.");
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const environment = await loadStagingBuildEnvironment(process.env);
  const configuration = validateReleaseEnvironment(environment);
  await checkReleaseRules(repository);
  const artifact = await validateStagingCloudflareArtifact(repository, configuration);
  const revision = execFileSync("git", ["--no-optional-locks", "rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
  const gitBranch = execFileSync("git", ["--no-optional-locks", "branch", "--show-current"], { cwd: repository, encoding: "utf8" }).trim();
  const branch = gitBranch || environment.WORKERS_CI_BRANCH;
  const dirty = execFileSync("git", ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all"], { cwd: repository, encoding: "utf8" });
  assertPreviewWorkingTreeClean(dirty);
  assertStagingDeploymentSource(artifact.sourceContext, revision);
  const evidencePath = environment.TAKEME_PREVIEW_ACCESS_EVIDENCE;
  let evidence;
  try {
    if (!evidencePath || !path.isAbsolute(evidencePath) || !(await lstat(evidencePath)).isFile() || (await lstat(evidencePath)).size > 16384) throw new Error();
    evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  }
  catch { throw new Error("Preview Access evidence is unreadable or malformed."); }
  const plan = validatePreviewPlanApproval(environment, evidence, revision, branch, artifact.deploymentContext);
  console.log("Preview plan evidence checks passed. No cloud operation was performed; this does not establish live Access protection.");
  console.log(plan.routingActivationRequired
    ? "Recorded preview routing is disabled. Separate owner-approved activation and a fresh build/check are required; live Access protection must be verified before exposure."
    : "Recorded preview routing is enabled in configuration. Nothing was deployed; separate owner approval and reviewed live Access protection remain prerequisites.");
  console.log("Future command only: npx --no-install opennextjs-cloudflare deploy --config wrangler.jsonc --env preview");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Preview deployment plan refused.");
  process.exitCode = 1;
}
