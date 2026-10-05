import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { recordReleaseArtifact, validateReleaseArtifact, validateStagingArtifact } from "./release-artifact.mjs";
import { recordCloudflareArtifact } from "./cloudflare-artifact.mjs";
import { readPreviewWrangler } from "./cloudflare-preview-policy.mjs";
import { loadStagingBuildEnvironment } from "./staging-environment.mjs";
import { readStagingSourceContext } from "./staging-source.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
try {
  const staging = process.argv.length === 3 && process.argv[2] === "--staging";
  if (process.argv.length !== 2 && !staging) throw new Error("Cloudflare build accepts only the explicit --staging selector; arbitrary environments and approval overrides are refused.");
  if (!staging) nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  const environment = staging ? await loadStagingBuildEnvironment(process.env) : process.env;
  const configuration = validateReleaseEnvironment(environment);
  if (configuration.target !== (staging ? "staging" : "production") || configuration.purpose !== (staging ? "staging-preview" : "production-build")) throw new Error("Cloudflare build target does not match its explicit selector; demo/offline or mixed output is refused.");
  if (staging) await readPreviewWrangler(repository, configuration);
  const sourceContext = staging ? await readStagingSourceContext(repository) : undefined;
  const version = require("next/package.json").version;
  const [major, minor, patch] = version.split(".").map(Number);
  if (major !== 16 || minor < 3 || (minor === 3 && patch < 8) || version.includes("-")) throw new Error("Cloudflare qualification requires a reviewed, supported stable Next release (at least 16.3.8). Current 16.3.5 needs an approved security patch and regression pass.");
  let cli;
  try { cli = path.resolve(path.dirname(require.resolve("@opennextjs/cloudflare")), "../cli/index.js"); }
  catch { throw new Error("Cloudflare dependencies are not installed in this checkout. Review and lock the production adapter/Wrangler versions before building; do not bypass peer requirements."); }
  const lock = JSON.parse(readFileSync(path.join(repository, "package-lock.json"), "utf8"));
  const installed = {
    next: require("next/package.json").version,
    "eslint-config-next": JSON.parse(readFileSync(path.join(repository, "node_modules/eslint-config-next/package.json"), "utf8")).version,
    "@opennextjs/cloudflare": JSON.parse(readFileSync(path.resolve(path.dirname(cli), "../../package.json"), "utf8")).version,
    wrangler: require("wrangler/package.json").version,
  };
  for (const [name, version] of Object.entries(installed)) {
    if (lock.packages?.[`node_modules/${name}`]?.version !== version) throw new Error(`Installed ${name} does not match the reviewed lockfile. Cloudflare build refused.`);
  }
  const result = spawnSync(process.execPath, [cli, "build", "--config", "wrangler.jsonc", "--openNextConfigPath", "open-next.config.mjs", ...(staging ? ["--env", "preview"] : [])], { cwd: repository, env: { ...environment, TAKEME_WEB_RUNTIME: "cloudflare" }, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Cloudflare adapter build failed. No deployment was attempted.");
  // OpenNext transforms some Next server files after npm run build has gated
  // them. Recheck the same first-party proof and bind the transformed output.
  await recordReleaseArtifact(path.join(repository, ".next"), configuration);
  if (staging) await validateStagingArtifact(path.join(repository, ".next"), configuration);
  else await validateReleaseArtifact(path.join(repository, ".next"), configuration);
  const recorded = await recordCloudflareArtifact(repository, configuration, path.join(repository, ".open-next"), sourceContext);
  console.log(`Cloudflare ${staging ? "staging preview" : "production build-qualified"} artifact recorded (${recorded.files} files). Launch NOT approved; deployment requires separate owner approval.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare build qualification failed.");
  process.exitCode = 1;
}
