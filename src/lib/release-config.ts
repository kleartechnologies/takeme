import { getReleasePolicy, validateProductionPolicy, validateProductionPolicyConfiguration } from "../../functions/src/release-policy.ts";
import { validateLegalPublication, type LegalPublicationReadiness } from "./legal-publication.ts";
import { stagingEnvironment } from "../../functions/src/staging-environment.ts";
import { productionEnvironment } from "../../functions/src/production-environment.ts";

export type ReleaseEnvironment = Record<string, string | undefined>;
export type ReleasePolicy = ReturnType<typeof getReleasePolicy>;
export type ReleaseTarget = "demo" | "staging" | "production";

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
  purpose: "release" | "production-build" | "staging-preview" | "offline-qualification";
  target: ReleaseTarget;
  projectId: string;
  siteUrl: string;
  useEmulators: boolean;
  publicFirebase: Record<(typeof publicFirebaseKeys)[number], string>;
  storageBuckets: string[];
  policy: ReleasePolicy;
  productionDeletionEnabled: boolean;
  stagingDeletionEnabled: boolean;
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

// Overrides are pure-test inputs only; normal build/validation CLIs never accept them.
export function validateReleaseEnvironment(env: ReleaseEnvironment, policyOverride?: ReleasePolicy, legalOverride?: LegalPublicationReadiness): ReleaseConfiguration {
  // Legal approval belongs to launch qualification, not compilation. Retain the
  // legacy pure-test input without allowing it to change the build's policy.
  void legalOverride;
  return validateConfiguration(env, "release", policyOverride, legalOverride);
}

/** No CLI approval overrides: launching requires the actual source decisions and activation. */
export function validateProductionLaunchEnvironment(env: ReleaseEnvironment, policyOverride?: ReleasePolicy, legalOverride?: LegalPublicationReadiness): ReleaseConfiguration {
  const configuration = validateReleaseEnvironment(env, policyOverride);
  const issues = [...validateProductionPolicy(configuration.policy), ...validateLegalPublication(legalOverride)];
  if (configuration.target !== "production" || configuration.purpose !== "production-build") issues.push("Launch qualification requires the production build target and purpose.");
  if (env.TAKEME_ENABLE_PRODUCTION_DELETION !== "true") issues.push("Production launch requires separately approved, explicitly activated deletion execution.");
  if (issues.length) throw new ReleaseConfigurationError(issues);
  return configuration;
}

function validateConfiguration(env: ReleaseEnvironment, purpose: ReleaseConfiguration["purpose"], policyOverride?: ReleasePolicy, legalOverride?: LegalPublicationReadiness): ReleaseConfiguration {
  void legalOverride;
  const issues: string[] = [];
  if (purpose === "release" && env.TAKEME_OFFLINE_QUALIFICATION) issues.push("Offline qualification mode cannot be used by the ordinary release validator.");
  const target = env.TAKEME_RELEASE_TARGET;
  if (target !== "demo" && target !== "staging" && target !== "production") throw new ReleaseConfigurationError(["TAKEME_RELEASE_TARGET must explicitly select demo, staging or production."]);
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
  } else if (target === "staging") {
    if (purpose !== "release") issues.push("Staging cannot use offline qualification or a caller-selected artifact purpose.");
    purpose = "staging-preview";
    if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false") issues.push("Staging requires NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false explicitly.");
    for (const key of Object.keys(env)) {
      if (/EMULATOR/i.test(key) && key !== "NEXT_PUBLIC_USE_FIREBASE_EMULATORS") issues.push(`${key} must be absent in staging.`);
      if (env[key] && /(?:TAKEME|FIREBASE|FUNCTION|SITE)/.test(key) && /takeme-52b80|(?:^|\/\/|\.)takeme\.my(?:[/:]|$)|demo-takeme|localhost|127\.0\.0\.1|\[?::1\]?/i.test(env[key]!)) issues.push(`${key} contains a forbidden production or local resource in staging.`);
    }
    for (const key of publicFirebaseKeys) if (!publicFirebase[key] || publicFirebase[key].trim() !== publicFirebase[key] || /\s/.test(publicFirebase[key])) issues.push(`${key} must contain an explicit registered staging Web App value.`);
    if (projectId !== stagingEnvironment.projectId || env.TAKEME_FIREBASE_PROJECT_ID !== stagingEnvironment.projectId) issues.push("Both staging project inputs must match the owner-confirmed staging Firebase project.");
    if (publicFirebase.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== stagingEnvironment.authDomain) issues.push("Staging must use its registered Firebase Auth domain.");
    if (publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== stagingEnvironment.storageBucket || env.TAKEME_STORAGE_BUCKETS !== stagingEnvironment.storageBucket) issues.push("Staging must use only its exact owner-confirmed Storage bucket.");
    if (publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== stagingEnvironment.projectNumber) issues.push("Staging sender ID must match its owner-confirmed project number.");
    if (!/^AIza[A-Za-z0-9_-]{35}$/.test(publicFirebase.NEXT_PUBLIC_FIREBASE_API_KEY)) issues.push("Staging Web API key must match the registered Firebase Web API-key format.");
    if (!new RegExp(`^1:${stagingEnvironment.projectNumber}:web:[a-f0-9]{16,40}$`).test(publicFirebase.NEXT_PUBLIC_FIREBASE_APP_ID)) issues.push("Staging Web App ID must match its confirmed project number.");
    if (siteUrl !== stagingEnvironment.siteUrl) issues.push("Staging site URL must equal the exact reviewed HTTPS workers.dev origin.");
    if (env.TAKEME_DELETION_ENVIRONMENT !== "staging") issues.push("Staging deletion resources must explicitly select staging.");
    if (!["false", "true"].includes(env.TAKEME_ENABLE_STAGING_DELETION || "")) issues.push("Staging deletion intent must be explicitly false or separately approved true.");
    if (env.TAKEME_ENABLE_PRODUCTION_DELETION !== undefined && env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false") issues.push("Staging cannot enable production deletion.");
    if (policy.publicationApproved !== true || policy.termsVersion !== stagingEnvironment.policyVersion || policy.privacyVersion !== stagingEnvironment.policyVersion || policy.minimumAge !== 18) issues.push("Staging must use only its separate staging test policies and 18+ eligibility.");
    for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"]) if (env[key] !== undefined && env[key] !== stagingEnvironment.projectId) issues.push(`${key} conflicts with the staging Firebase project.`);
    if (env.PROTECTED_PAYMENTS_ENABLED && env.PROTECTED_PAYMENTS_ENABLED !== "false") issues.push("Protected payments must remain disabled in staging.");
    storageBuckets = [stagingEnvironment.storageBucket];
  } else {
    if (purpose === "release") purpose = "production-build";
    if (projectId === stagingEnvironment.projectId || publicFirebase.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID === stagingEnvironment.projectNumber) issues.push("The confirmed staging Web App cannot qualify as a production release.");
    issues.push(...validateProductionPolicyConfiguration(policy));
    if (purpose !== "offline-qualification" && projectId !== productionEnvironment.projectId) issues.push("Production must use the exact owner-confirmed Firebase project.");
    if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false") issues.push("Production requires NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false explicitly.");
    for (const [key, value] of Object.entries(env)) {
      if (/(?:EMULATOR_HOST|EMULATOR_HUB)$/.test(key) || key === "FUNCTIONS_EMULATOR") issues.push(`${key} must be absent in production.`);
      if (/^CF_ACCESS_/.test(key)) issues.push(`${key} must be absent from the public production Worker.`);
      if (value && /(?:TAKEME|FIREBASE|FUNCTION|SITE).*(?:URL|DOMAIN|PROJECT|BUCKET|USER)/.test(key) && unsafeValue.test(value)) issues.push(`${key} contains a forbidden local/demo/test value.`);
      if (value && /(?:TAKEME|FIREBASE|FUNCTION|SITE)/.test(key) && /takeme-staging-822a5|takeme-web-preview|workers\.dev/i.test(value)) issues.push(`${key} contains a forbidden staging or preview resource.`);
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
    if (purpose !== "offline-qualification" && (publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== productionEnvironment.storageBucket || storageBuckets.length !== 1 || storageBuckets[0] !== productionEnvironment.storageBucket)) issues.push("Production must use only the exact owner-confirmed Storage bucket.");
    if (siteUrl !== "https://takeme.my") issues.push("NEXT_PUBLIC_SITE_URL must be the approved canonical origin https://takeme.my with no path, query or credentials.");
    if (env.TAKEME_DELETION_ENVIRONMENT !== "production") issues.push("Production deletion resources must be explicitly configured.");
    if (purpose === "production-build" && !["false", "true"].includes(env.TAKEME_ENABLE_PRODUCTION_DELETION || "")) issues.push("Production deletion activation must be explicitly false or separately approved true.");
    if (env.TAKEME_ENABLE_STAGING_DELETION !== undefined && env.TAKEME_ENABLE_STAGING_DELETION !== "false") issues.push("Production cannot activate staging deletion.");
    if (purpose === "offline-qualification" && env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false") issues.push("Offline qualification requires production deletion execution disabled explicitly.");
    if (env.PROTECTED_PAYMENTS_ENABLED && env.PROTECTED_PAYMENTS_ENABLED !== "false") issues.push("Protected payments must remain disabled for this release.");
  }
  if (issues.length) throw new ReleaseConfigurationError([...new Set(issues)]);
  return { purpose, target, projectId, siteUrl, publicFirebase, storageBuckets, policy, useEmulators: target === "demo", productionDeletionEnabled: target === "production" && purpose === "production-build" && env.TAKEME_ENABLE_PRODUCTION_DELETION === "true", stagingDeletionEnabled: target === "staging" && env.TAKEME_ENABLE_STAGING_DELETION === "true" };
}

// Fixed fabricated public values only. No caller can substitute real resources or
// approve production through this path. Its output cannot initialize Firebase or
// pass the ordinary release/artifact gate, even if copied into a hosting project.
export function offlineQualificationConfiguration(): ReleaseConfiguration {
  const project = "takeme-offline-qualification";
  return validateConfiguration({
    TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: project,
    TAKEME_STORAGE_BUCKETS: `${project}.firebasestorage.app`, TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "false",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "a".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${project}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:" + "a".repeat(22),
    NEXT_PUBLIC_SITE_URL: "https://takeme.my", NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", PROTECTED_PAYMENTS_ENABLED: "false",
  }, "offline-qualification",
  { publicationApproved: true, termsVersion: "qualification-final-v1", privacyVersion: "qualification-final-v1", minimumAge: 18 },
  { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "not-required", address: "not-required", productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" });
}

// Explicit owner-confirmed public SDK inputs may be inspected offline only.
// The synthetic policy/legal fixture never changes either real approval source.
export function ownerOfflineQualificationConfiguration(env: ReleaseEnvironment, identity: { projectId: string; projectNumber: string }): ReleaseConfiguration {
  const issues: string[] = [];
  if (env.TAKEME_RELEASE_TARGET !== "production") issues.push("Owner-config offline qualification requires an explicit production target.");
  if (!identity.projectId || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== identity.projectId) issues.push("The public Web App project must match the separately confirmed owner project.");
  if (!/^\d{6,20}$/.test(identity.projectNumber) || env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== identity.projectNumber) issues.push("The public Web App sender must match the separately confirmed owner project number.");
  if (issues.length) throw new ReleaseConfigurationError(issues);
  return validateConfiguration(env, "offline-qualification",
    { publicationApproved: true, termsVersion: "qualification-final-v1", privacyVersion: "qualification-final-v1", minimumAge: 18 },
    { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "not-required", address: "not-required", productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" });
}
