import { readFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { stagingEnvironment } from "../functions/src/staging-environment.ts";

const sdkKeys = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY", authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

/** Local public SDK input only; never evaluates JS, loads dotenv, or reads provider credentials. */
export function loadStagingBuildEnvironment(input) {
  const env = { ...input };
  const file = env.TAKEME_STAGING_CONFIG_FILE;
  if (file) {
    try {
      if (!path.isAbsolute(file) || !lstatSync(file).isFile() || lstatSync(file).size > 16384) throw new Error();
      const sdk = JSON.parse(readFileSync(file, "utf8"));
      if (!sdk || Array.isArray(sdk) || typeof sdk !== "object") throw new Error();
      const publicNames = Object.values(sdkKeys);
      if (Object.keys(sdk).some(key => !Object.hasOwn(sdkKeys, key) && !publicNames.includes(key))) throw new Error();
      for (const [key, variable] of Object.entries(sdkKeys)) {
        const value = sdk[key] ?? sdk[variable];
        if (typeof value !== "string" || !value || sdk[key] !== undefined && sdk[variable] !== undefined && sdk[key] !== sdk[variable]) throw new Error();
        if (env[variable] !== undefined && env[variable] !== value) throw new Error();
        env[variable] = value;
      }
    } catch {
      throw new Error("Staging SDK input must be an ordinary absolute JSON file containing only the six registered public Web App fields, without conflicting shell values. Configuration values are not logged.");
    }
  }
  const defaults = {
    TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId,
    TAKEME_STORAGE_BUCKETS: stagingEnvironment.storageBucket, TAKEME_DELETION_ENVIRONMENT: "staging",
    TAKEME_ENABLE_PRODUCTION_DELETION: "false", TAKEME_ENABLE_STAGING_DELETION: "false",
    NEXT_PUBLIC_SITE_URL: stagingEnvironment.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
    PROTECTED_PAYMENTS_ENABLED: "false",
  };
  for (const [key, value] of Object.entries(defaults)) if (env[key] === undefined) env[key] = value;
  return env;
}
