import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { validateReleaseArtifact } from "./release-artifact.mjs";
import { checkReleaseRules } from "./check-release-rules.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const demo = process.argv.includes("--demo");
const artifact = process.argv.includes("--artifact");
try {
  nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  const configuration = validateReleaseEnvironment(process.env);
  await checkReleaseRules(repository);
  const requiredTarget = demo ? "demo" : "production";
  if (configuration.target !== requiredTarget) throw new Error("Release target does not match this qualification command.");
  if (artifact) {
    const checked = await validateReleaseArtifact(path.join(repository, ".next"), configuration, requiredTarget);
    console.log(`${checked.target} artifact validation passed (${checked.files} files).${demo ? " Not qualified for production." : ""}`);
  } else console.log(`${requiredTarget} configuration validation passed.${demo ? " Not qualified for production." : ""}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Release qualification failed.");
  process.exitCode = 1;
}
