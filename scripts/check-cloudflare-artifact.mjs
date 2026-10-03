import { fileURLToPath } from "node:url";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { validateCloudflareArtifact } from "./cloudflare-artifact.mjs";

try {
  if (process.argv.length !== 2) throw new Error("Cloudflare release validation accepts no environment, approval or qualification overrides.");
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const configuration = validateReleaseEnvironment(process.env);
  const checked = await validateCloudflareArtifact(repository, configuration);
  console.log(`Cloudflare release artifact validation passed (${checked.files} files).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare release artifact validation failed.");
  process.exitCode = 1;
}
