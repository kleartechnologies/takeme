import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { recordReleaseArtifact } from "./release-artifact.mjs";
import { checkReleaseRules } from "./check-release-rules.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
try {
  nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  const configuration = validateReleaseEnvironment(process.env);
  await checkReleaseRules(repository);
  const result = spawnSync(process.execPath, [path.join(repository, "node_modules/next/dist/bin/next"), "build", ...process.argv.slice(2)], { cwd: repository, env: process.env, stdio: "inherit" });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  const recorded = await recordReleaseArtifact(path.join(repository, ".next"), configuration);
  console.log(`Validated ${recorded.target} build provenance (${recorded.files} files). Demo builds are not production release artifacts.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Release build validation failed.");
  process.exitCode = 1;
}
