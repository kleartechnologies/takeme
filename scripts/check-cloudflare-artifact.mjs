import { fileURLToPath } from "node:url";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { validateCloudflareArtifact, validateStagingCloudflareArtifact } from "./cloudflare-artifact.mjs";
import { loadStagingBuildEnvironment } from "./staging-environment.mjs";

try {
  const staging = process.argv.length === 3 && process.argv[2] === "--staging";
  if (process.argv.length !== 2 && !staging) throw new Error("Cloudflare release validation accepts no environment, approval or qualification overrides; --staging is the sole explicit preview selector.");
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const environment = staging ? await loadStagingBuildEnvironment(process.env) : process.env;
  const configuration = validateReleaseEnvironment(environment);
  if (configuration.target !== (staging ? "staging" : "production")) throw new Error("Cloudflare artifact target does not match its explicit qualification selector.");
  const checked = staging ? await validateStagingCloudflareArtifact(repository, configuration) : await validateCloudflareArtifact(repository, configuration);
  console.log(`Cloudflare ${staging ? "staging preview" : "release"} artifact validation passed (${checked.files} files).${staging ? ` Recorded preview routing is ${checked.deploymentContext.workersDev ? "enabled" : "disabled"}; nothing was deployed. Not a production release.` : ""}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare release artifact validation failed.");
  process.exitCode = 1;
}
