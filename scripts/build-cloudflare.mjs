import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { recordReleaseArtifact, validateReleaseArtifact } from "./release-artifact.mjs";
import { recordCloudflareArtifact } from "./cloudflare-artifact.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
try {
  nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  const configuration = validateReleaseEnvironment(process.env);
  if (configuration.target !== "production") throw new Error("Cloudflare release builds require the approved production configuration; demo/offline output cannot be deployed.");
  const version = require("next/package.json").version;
  const [major, minor, patch] = version.split(".").map(Number);
  if (major !== 16 || minor < 3 || (minor === 3 && patch < 8) || version.includes("-")) throw new Error("Cloudflare qualification requires a reviewed, supported stable Next release (at least 16.3.8). Current 16.3.5 needs an approved security patch and regression pass.");
  let cli;
  try { cli = path.resolve(path.dirname(require.resolve("@opennextjs/cloudflare")), "../cli/index.js"); }
  catch { throw new Error("Cloudflare dependencies are not installed in this checkout. Review and lock the production adapter/Wrangler versions before building; do not bypass peer requirements."); }
  const lock = JSON.parse(readFileSync(path.join(repository, "package-lock.json"), "utf8"));
  const installed = {
    next: require("next/package.json").version,
    "eslint-config-next": require("eslint-config-next/package.json").version,
    "@opennextjs/cloudflare": JSON.parse(readFileSync(path.resolve(path.dirname(cli), "../../package.json"), "utf8")).version,
    wrangler: require("wrangler/package.json").version,
  };
  for (const [name, version] of Object.entries(installed)) {
    if (lock.packages?.[`node_modules/${name}`]?.version !== version) throw new Error(`Installed ${name} does not match the reviewed lockfile. Cloudflare build refused.`);
  }
  const result = spawnSync(process.execPath, [cli, "build", "--config", "wrangler.jsonc", "--openNextConfigPath", "open-next.config.mjs"], { cwd: repository, env: { ...process.env, TAKEME_WEB_RUNTIME: "cloudflare" }, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Cloudflare adapter build failed. No deployment was attempted.");
  // OpenNext transforms some Next server files after npm run build has gated
  // them. Recheck the same first-party proof and bind the transformed output.
  await recordReleaseArtifact(path.join(repository, ".next"), configuration);
  await validateReleaseArtifact(path.join(repository, ".next"), configuration);
  const recorded = await recordCloudflareArtifact(repository, configuration);
  console.log(`Cloudflare release artifact recorded (${recorded.files} files). Build only; deployment requires separate owner approval.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare build qualification failed.");
  process.exitCode = 1;
}
