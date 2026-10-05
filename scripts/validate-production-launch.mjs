import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { validateProductionLaunchEnvironment } from "../src/lib/release-config.ts";
import { checkReleaseRules } from "./check-release-rules.mjs";

try {
  if (process.argv.length !== 2) throw new Error("Production launch validation accepts no approval, policy or environment overrides.");
  const repository = fileURLToPath(new URL("../", import.meta.url));
  nextEnv.loadEnvConfig(repository, false, { info() {}, error() {} });
  validateProductionLaunchEnvironment(process.env);
  await checkReleaseRules(repository);
  console.log("Production source launch gates passed. This does not verify deployed backend parity, bootstrap, runtime activation or DNS; separate owner approval and operational qualification are required.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Production launch qualification refused.");
  process.exitCode = 1;
}
