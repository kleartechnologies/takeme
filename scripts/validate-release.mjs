import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { validateReleaseArtifact, validateStagingArtifact } from "./release-artifact.mjs";
import { checkReleaseRules } from "./check-release-rules.mjs";
import { loadStagingBuildEnvironment } from "./staging-environment.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const demo = process.argv.includes("--demo");
const staging = process.argv.includes("--staging");
const artifact = process.argv.includes("--artifact");
try {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--demo", "--staging", "--artifact"].includes(arg)) || new Set(args).size !== args.length || demo && staging) throw new Error("Release qualification requires one explicit target selector and no approval overrides.");
  if (!staging) nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  const environment = staging ? await loadStagingBuildEnvironment(process.env) : process.env;
  const configuration = validateReleaseEnvironment(environment);
  await checkReleaseRules(repository);
  const requiredTarget = demo ? "demo" : staging ? "staging" : "production";
  if (configuration.target !== requiredTarget) throw new Error("Release target does not match this qualification command.");
  if (artifact) {
    const checked = staging ? await validateStagingArtifact(path.join(repository, ".next"), configuration) : await validateReleaseArtifact(path.join(repository, ".next"), configuration, requiredTarget);
    console.log(`${checked.target} ${demo || staging ? "artifact validation" : "build qualification"} passed (${checked.files} files).${demo || staging ? " Not qualified for production." : " Launch NOT approved; run the independent launch checker after actual approvals."}`);
  } else console.log(`${requiredTarget} configuration validation passed.${demo || staging ? " Not qualified for production." : " Build-qualified; launch NOT approved."}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Release qualification failed.");
  process.exitCode = 1;
}
