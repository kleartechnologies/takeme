import { productionEnvironment } from "./production-environment.ts";
import { productionReleasePolicy, validateProductionPolicy, type ReleasePolicy } from "./release-policy.ts";
import { legalPublicationReadiness, validateLegalPublication, type LegalPublicationReadiness } from "./legal-publication.ts";

export interface ProductionPolicyRuntime {
  env: Record<string, string | undefined>;
  appProjectId?: string;
  appStorageBucket?: string;
}
export interface ProductionPolicyRecord {
  releaseTarget: "production";
  projectId: string;
  publicationApproved: true;
  termsVersion: string;
  privacyVersion: string;
  minimumAge: 18;
}
export interface ProductionPolicyPlan { readonly path: "releasePolicies/current"; readonly record: Readonly<ProductionPolicyRecord> }
export class ProductionPolicyBootstrapError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) { super(`Production policy bootstrap refused: ${issues.join("; ")}`); this.issues = issues; }
}

/** Pure plan only: source versions/approvals are never supplied by an end user or CLI override. */
export function planProductionPolicyBootstrap(runtime: ProductionPolicyRuntime, policy: ReleasePolicy = productionReleasePolicy, readiness: LegalPublicationReadiness = legalPublicationReadiness): ProductionPolicyPlan {
  const { env, appProjectId, appStorageBucket } = runtime;
  const issues = [...validateProductionPolicy(policy), ...validateLegalPublication(readiness)];
  if (env.TAKEME_RELEASE_TARGET !== "production" || env.TAKEME_FIREBASE_PROJECT_ID !== productionEnvironment.projectId) issues.push("Exact production target and configured project are required.");
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT].filter(value => value !== undefined);
  if (!projects.length || projects.some(value => value !== productionEnvironment.projectId) || appProjectId !== productionEnvironment.projectId) issues.push("Runtime and Admin app project identities must match production.");
  if (appStorageBucket !== productionEnvironment.storageBucket || env.TAKEME_STORAGE_BUCKETS !== productionEnvironment.storageBucket) issues.push("Only the exact production Storage bucket is allowed.");
  if (Object.keys(env).some(key => /EMULATOR|EMULATORS/.test(key) && !(key === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[key] === "false"))) issues.push("Emulators must be absent.");
  if (env.TAKEME_ENABLE_STAGING_DELETION !== undefined && env.TAKEME_ENABLE_STAGING_DELETION !== "false") issues.push("Staging activation must be absent or false.");
  if (env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false") issues.push("Policy bootstrap requires deletion execution explicitly off; activation is a separate operation.");
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG);
      if (!config || typeof config !== "object" || Array.isArray(config) || config.projectId !== productionEnvironment.projectId || config.storageBucket !== productionEnvironment.storageBucket) issues.push("Firebase app configuration must match production.");
    } catch { issues.push("Firebase app configuration is malformed."); }
  }
  if (issues.length) throw new ProductionPolicyBootstrapError(issues);
  return Object.freeze({ path: "releasePolicies/current", record: Object.freeze({ releaseTarget: "production", projectId: productionEnvironment.projectId,
    publicationApproved: true, termsVersion: policy.termsVersion!, privacyVersion: policy.privacyVersion!, minimumAge: 18 }) });
}

export function productionPolicyRecordMatches(value: unknown, expected: Readonly<ProductionPolicyRecord>): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === Object.keys(expected).length && Object.entries(expected).every(([key, field]) => record[key] === field);
}
export interface PolicyCreateStore {
  create(record: Readonly<ProductionPolicyRecord>): Promise<unknown>;
  read(): Promise<unknown>;
}
/** Create-only; repeats may confirm an identical record, never repair/re-enable/overwrite it. */
export async function createProductionPolicyMirror(store: PolicyCreateStore, plan: ProductionPolicyPlan, policy: ReleasePolicy = productionReleasePolicy, readiness: LegalPublicationReadiness = legalPublicationReadiness): Promise<"created" | "already-current"> {
  const expected = { releaseTarget: "production" as const, projectId: productionEnvironment.projectId, publicationApproved: true as const,
    termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion, minimumAge: 18 as const };
  if (plan.path !== "releasePolicies/current" || plan.record.projectId !== productionEnvironment.projectId
    || validateProductionPolicy(policy).length || validateLegalPublication(readiness).length
    || !productionPolicyRecordMatches(plan.record, expected as ProductionPolicyRecord)) throw new ProductionPolicyBootstrapError(["The policy plan or current source approval is invalid."]);
  try { await store.create(plan.record); return "created"; }
  catch (error) {
    if (![6, "already-exists"].includes((error as { code?: number | string }).code ?? "")) throw error;
    if (!productionPolicyRecordMatches(await store.read(), plan.record)) throw new ProductionPolicyBootstrapError(["The existing policy differs or is revoked; create-only bootstrap never changes it."]);
    return "already-current";
  }
}
