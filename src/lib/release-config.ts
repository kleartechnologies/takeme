import { getReleasePolicy, validateProductionPolicy } from "../../functions/src/release-policy.ts";

export type ReleaseEnvironment = Record<string, string | undefined>;
export type ReleasePolicy = ReturnType<typeof getReleasePolicy>;
export type ReleaseTarget = "demo" | "production";

export const publicFirebaseKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const demoValues = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-takeme.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-takeme.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:demo",
};
const unsafeValue = /localhost|127\.0\.0\.1|\[?::1\]?|(?:^|[/.:-])(?:demo|test|synthetic)[-_]|demo-api-key|\.test(?:[/:]|$)|example\.invalid|synthetic/i;

export interface ReleaseConfiguration {
  target: ReleaseTarget;
  projectId: string;
  siteUrl: string;
  useEmulators: boolean;
  publicFirebase: Record<(typeof publicFirebaseKeys)[number], string>;
  storageBuckets: string[];
  policy: ReleasePolicy;
  productionDeletionEnabled: boolean;
}

export class ReleaseConfigurationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    // Report names/reasons only: never echo configuration values or credentials.
    super(`Release configuration refused:\n${issues.map(issue => `- ${issue}`).join("\n")}`);
    this.name = "ReleaseConfigurationError";
    this.issues = issues;
  }
}

export function validateReleaseEnvironment(env: ReleaseEnvironment, policyOverride?: ReleasePolicy): ReleaseConfiguration {
  const issues: string[] = [];
  const target = env.TAKEME_RELEASE_TARGET;
  if (target !== "demo" && target !== "production") throw new ReleaseConfigurationError(["TAKEME_RELEASE_TARGET must explicitly select demo or production."]);
  const policy = policyOverride ?? getReleasePolicy(target);
  const publicFirebase = Object.fromEntries(publicFirebaseKeys.map(key => [key, env[key] || (target === "demo" ? demoValues[key] : "")])) as ReleaseConfiguration["publicFirebase"];
  const projectId = publicFirebase.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || (target === "demo" ? "http://localhost:3000" : "");
  let storageBuckets: string[] = [];

  if (target === "demo") {
    if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") issues.push("Demo builds require NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true.");
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-takeme") issues.push("Demo builds require the explicit demo Firebase project.");
    for (const key of publicFirebaseKeys) if (publicFirebase[key] !== demoValues[key] && !(key === "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" && publicFirebase[key] === "demo-takeme.appspot.com")) issues.push(`${key} must use verified demo configuration in a demo build.`);
    try { const url = new URL(siteUrl); if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error(); }
    catch { issues.push("Demo NEXT_PUBLIC_SITE_URL must be a loopback origin."); }
    if (env.TAKEME_FIREBASE_PROJECT_ID && env.TAKEME_FIREBASE_PROJECT_ID !== projectId) issues.push("The trusted Firebase project must match the demo project.");
    if (env.TAKEME_STORAGE_BUCKETS && env.TAKEME_STORAGE_BUCKETS.split(",").some(bucket => !["demo-takeme.firebasestorage.app", "demo-takeme.appspot.com"].includes(bucket.trim()))) issues.push("Demo cleanup buckets must belong to the demo project.");
    if (env.TAKEME_DELETION_ENVIRONMENT === "production" || env.TAKEME_ENABLE_PRODUCTION_DELETION === "true") issues.push("A demo build cannot enable production deletion.");
    storageBuckets = [publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET];
  } else {
    issues.push(...validateProductionPolicy(policy));
    if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false") issues.push("Production requires NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false explicitly.");
    for (const [key, value] of Object.entries(env)) {
      if (value && (/(?:EMULATOR_HOST|EMULATOR_HUB)$/.test(key) || key === "FUNCTIONS_EMULATOR")) issues.push(`${key} must be absent in production.`);
      if (value && /(?:TAKEME|FIREBASE|FUNCTION|SITE).*(?:URL|DOMAIN|PROJECT|BUCKET|USER)/.test(key) && unsafeValue.test(value)) issues.push(`${key} contains a forbidden local/demo/test value.`);
    }
    for (const key of publicFirebaseKeys) {
      const value = publicFirebase[key];
      if (!value || value.trim() !== value || /\s/.test(value)) issues.push(`${key} must contain an explicit registered Web App value.`);
      else if (unsafeValue.test(value)) issues.push(`${key} contains a forbidden local/demo/test value.`);
    }
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || /^(?:demo|test|synthetic)(?:-|$)/i.test(projectId)) issues.push("The production Firebase project must follow production project-ID conventions.");
    if (!env.TAKEME_FIREBASE_PROJECT_ID || env.TAKEME_FIREBASE_PROJECT_ID !== projectId) issues.push("TAKEME_FIREBASE_PROJECT_ID must explicitly confirm the Web App project; .firebaserc is not confirmation.");
    for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"]) if (env[key] && env[key] !== projectId) issues.push(`${key} conflicts with the confirmed Firebase project.`);
    if (!/^AIza[A-Za-z0-9_-]{35}$/.test(publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY)) issues.push("NEXT_PUBLIC_FIREBASE_API_KEY must match the registered Firebase Web API-key format.");
    if (publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== `${projectId}.firebaseapp.com`) issues.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must use the confirmed project's registered Firebase auth domain; custom auth domains require separate review.");
    const sender = publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    if (!/^\d{6,20}$/.test(sender)) issues.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID must be the registered numeric sender ID.");
    if (!new RegExp(`^1:${sender.replace(/[^0-9]/g, "")}:web:[a-f0-9]{16,40}$`).test(publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID)) issues.push("NEXT_PUBLIC_FIREBASE_APP_ID must be a registered Web App ID matching the sender ID.");
    const approvedBuckets = [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`];
    storageBuckets = env.TAKEME_STORAGE_BUCKETS ? env.TAKEME_STORAGE_BUCKETS.split(",").map(value => value.trim()) : [];
    if (!storageBuckets.length || new Set(storageBuckets).size !== storageBuckets.length || storageBuckets.some(bucket => !approvedBuckets.includes(bucket))) issues.push("TAKEME_STORAGE_BUCKETS must explicitly allow only the confirmed project's Storage buckets.");
    if (!storageBuckets.includes(publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)) issues.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must match a confirmed cleanup bucket.");
    if (siteUrl !== "https://takeme.my") issues.push("NEXT_PUBLIC_SITE_URL must be the approved canonical origin https://takeme.my with no path, query or credentials.");
    if (env.TAKEME_DELETION_ENVIRONMENT !== "production" || env.TAKEME_ENABLE_PRODUCTION_DELETION !== "true") issues.push("Production release qualification requires separately approved, explicitly enabled production deletion configuration.");
    if (env.PROTECTED_PAYMENTS_ENABLED && env.PROTECTED_PAYMENTS_ENABLED !== "false") issues.push("Protected payments must remain disabled for this release.");
  }
  if (issues.length) throw new ReleaseConfigurationError([...new Set(issues)]);
  return { target, projectId, siteUrl, publicFirebase, storageBuckets, policy, useEmulators: target === "demo", productionDeletionEnabled: target === "production" };
}
