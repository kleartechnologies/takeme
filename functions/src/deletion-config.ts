import { productionReleasePolicy, stagingReleasePolicy, policyIsConfigured, validateProductionPolicy, type ReleasePolicy } from "./release-policy.ts";
import { stagingFirebaseProjectId, stagingStorageBucket } from "./staging-environment.ts";

/** Pure resource qualification. Importing this module never initializes an SDK or performs cleanup. */
export type DeletionEnvironment = "demo" | "staging" | "production";
export interface DeletionResources {
  environment: DeletionEnvironment;
  projectId: string;
  storageBuckets: readonly string[];
}
export interface DeletionRuntime {
  env: Record<string, string | undefined>;
  appProjectId?: string;
  appStorageBucket?: string;
}

export class DeletionConfigurationError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super("Account deletion is unavailable until its resource configuration is qualified.");
    this.reason = reason;
    this.name = "DeletionConfigurationError";
  }
}
const refuse = (reason: string): never => { throw new DeletionConfigurationError(reason); };
const projectBuckets = (project: string) => [`${project}.firebasestorage.app`, `${project}.appspot.com`];
const projectPattern = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function validateDeletionConfig(runtime: DeletionRuntime): DeletionResources {
  const { env, appProjectId, appStorageBucket } = runtime;
  const runtimeProjects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT].filter((value): value is string => value !== undefined);
  if (!runtimeProjects.length || runtimeProjects.some(value => !value || value !== runtimeProjects[0])) refuse("runtime-project");
  const projectId = runtimeProjects[0]!;
  if (appProjectId !== undefined && appProjectId !== projectId) refuse("app-project");
  if (env.TAKEME_FIREBASE_PROJECT_ID !== undefined && env.TAKEME_FIREBASE_PROJECT_ID !== projectId) refuse("configured-project");
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG);
      if (!config || typeof config !== "object" || Array.isArray(config)) refuse("firebase-config");
      if (config.projectId !== undefined && config.projectId !== projectId) refuse("firebase-config-project");
      if (config.storageBucket !== undefined && config.storageBucket !== appStorageBucket) refuse("firebase-config-bucket");
    } catch (error) { if (error instanceof DeletionConfigurationError) throw error; refuse("firebase-config"); }
  }

  const emulatorKeys = Object.keys(env).filter(key => /EMULATOR|EMULATORS/.test(key)
    && !(key === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[key] === "false"));
  const allowedBuckets = projectId === stagingFirebaseProjectId ? [stagingStorageBucket] : projectBuckets(projectId);
  let environment: DeletionEnvironment;
  let storageBuckets: string[];
  if (projectId === "demo-takeme") {
    if (env.TAKEME_RELEASE_TARGET !== undefined && env.TAKEME_RELEASE_TARGET !== "demo"
      || env.TAKEME_DELETION_ENVIRONMENT !== undefined && env.TAKEME_DELETION_ENVIRONMENT !== "demo"
      || env.TAKEME_ENABLE_PRODUCTION_DELETION !== undefined && env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false"
      || env.TAKEME_ENABLE_STAGING_DELETION !== undefined && env.TAKEME_ENABLE_STAGING_DELETION !== "false") refuse("demo-mode");
    if (env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
      || env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") refuse("demo-hosts");
    environment = "demo";
    storageBuckets = allowedBuckets;
  } else if (env.TAKEME_RELEASE_TARGET === "staging" || env.TAKEME_DELETION_ENVIRONMENT === "staging" || projectId === stagingFirebaseProjectId) {
    if (env.TAKEME_RELEASE_TARGET !== "staging" || env.TAKEME_DELETION_ENVIRONMENT !== "staging") refuse("staging-mode");
    if (env.TAKEME_ENABLE_STAGING_DELETION !== "true") refuse("staging-disabled");
    if (env.TAKEME_ENABLE_PRODUCTION_DELETION !== undefined && env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false") refuse("staging-production-enabled");
    if (projectId !== stagingFirebaseProjectId || appProjectId !== stagingFirebaseProjectId
      || env.TAKEME_FIREBASE_PROJECT_ID !== stagingFirebaseProjectId) refuse("staging-project");
    if (appStorageBucket !== stagingStorageBucket || env.TAKEME_STORAGE_BUCKETS !== stagingStorageBucket) refuse("staging-bucket");
    if (emulatorKeys.length) refuse("staging-emulators");
    environment = "staging";
    storageBuckets = [stagingStorageBucket];
  } else {
    if (env.TAKEME_RELEASE_TARGET !== "production" || env.TAKEME_DELETION_ENVIRONMENT !== "production") refuse("production-mode");
    if (env.TAKEME_ENABLE_PRODUCTION_DELETION !== "true") refuse("production-disabled");
    if (env.TAKEME_ENABLE_STAGING_DELETION !== undefined && env.TAKEME_ENABLE_STAGING_DELETION !== "false") refuse("production-staging-enabled");
    if (!projectPattern.test(projectId) || projectId.startsWith("demo-") || projectId.includes("localhost")) refuse("production-project");
    // Require both deployment runtime identity and Admin app metadata, never frontend/default-project inference.
    if (!appProjectId || !env.TAKEME_FIREBASE_PROJECT_ID) refuse("production-project-missing");
    if (emulatorKeys.some(key => env[key] !== undefined)
      || env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== undefined && env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false") refuse("production-emulators");
    const configuredBuckets = env.TAKEME_STORAGE_BUCKETS || refuse("storage-buckets-missing");
    storageBuckets = configuredBuckets.split(",").map(value => value.trim());
    if (!appStorageBucket) refuse("app-bucket-missing");
    environment = "production";
  }
  if (env.TAKEME_STORAGE_BUCKETS !== undefined) {
    const configured = env.TAKEME_STORAGE_BUCKETS.split(",").map(value => value.trim());
    if (!configured.length || configured.some(value => !allowedBuckets.includes(value)) || new Set(configured).size !== configured.length) refuse("storage-buckets");
    storageBuckets = environment === "demo" ? allowedBuckets : configured;
  }
  if (storageBuckets.some(value => !allowedBuckets.includes(value)) || appStorageBucket !== undefined && !storageBuckets.includes(appStorageBucket)) refuse("storage-buckets");
  return Object.freeze({ environment, projectId, storageBuckets: Object.freeze(storageBuckets) });
}

/** Execution also requires the server-owned final publication decision, independent of environment flags. */
export function qualifyDeletionExecution(runtime: DeletionRuntime, policy: ReleasePolicy = productionReleasePolicy): DeletionResources {
  const resources = validateDeletionConfig(runtime);
  if (resources.environment === "staging" && !policyIsConfigured(stagingReleasePolicy)) refuse("staging-policy-unapproved");
  if (resources.environment === "production" && validateProductionPolicy(policy).length) refuse("production-policy-unapproved");
  return resources;
}

/** Parse the supported Firebase download URL format; never fetch a caller-supplied URL. */
export function ownedDeletionMedia(raw: unknown, uid: string, resources: DeletionResources): { bucket: string; object: string } | null {
  if (typeof raw !== "string" || raw.length > 4096 || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.username || url.password || url.hash) return null;
  const expectedOrigin = resources.environment === "demo" ? "http://127.0.0.1:9199" : "https://firebasestorage.googleapis.com";
  if (url.origin !== expectedOrigin) return null;
  const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
  if (!match || !resources.storageBuckets.includes(match[1]!)) return null;
  let object: string;
  try { object = decodeURIComponent(match[2]!); } catch { return null; }
  if (!object.startsWith(`users/${uid}/`) || /[\\\u0000-\u001f\u007f]/.test(object)
    || object.split("/").some(part => !part || part === "." || part === "..") || /%[0-9a-f]{2}/i.test(object)) return null;
  return { bucket: match[1]!, object };
}
