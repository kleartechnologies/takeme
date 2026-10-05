import { productionEnvironment } from "./production-environment.ts";
import { productionReleasePolicy, validateProductionPolicy, type ReleasePolicy } from "./release-policy.ts";
import { legalPublicationReadiness, validateLegalPublication, type LegalPublicationReadiness } from "./legal-publication.ts";
import { productionPolicyRecordMatches, type ProductionPolicyRecord } from "./production-policy-bootstrap.ts";

export type MaintenanceAction = "enable" | "disable";
export type ExpectedMaintenanceState = "absent" | "off" | "on";
export interface MaintenanceControlRecord {
  readonly releaseTarget: "production";
  readonly projectId: string;
  readonly protectedWritesPaused: boolean;
}
export interface MaintenanceOperationPlan {
  readonly path: "releaseControls/current";
  readonly action: MaintenanceAction;
  readonly expectedState: ExpectedMaintenanceState;
  readonly expectedUpdateTime: string | null;
  readonly record: Readonly<MaintenanceControlRecord>;
}
export interface MaintenanceRuntime {
  readonly env: Record<string, string | undefined>;
  readonly appProjectId?: string;
  readonly appStorageBucket?: string;
}
export class MaintenanceControlError extends Error {
  constructor(message: string) { super(`Maintenance operation refused: ${message}`); }
}
const refuse = (message: string): never => { throw new MaintenanceControlError(message); };
const updateTimePattern = /^(0|[1-9]\d*)\.\d{9}$/;

/** Pure production-only plan. No SDK, credential lookup or remote request. */
export function planProductionMaintenance(runtime: MaintenanceRuntime, action: MaintenanceAction, expectedState: ExpectedMaintenanceState, expectedUpdateTime: string | null = null): MaintenanceOperationPlan {
  const { env, appProjectId, appStorageBucket } = runtime;
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT].filter(value => value !== undefined);
  if (env.TAKEME_RELEASE_TARGET !== "production" || env.TAKEME_FIREBASE_PROJECT_ID !== productionEnvironment.projectId
    || !projects.length || projects.some(value => value !== productionEnvironment.projectId) || appProjectId !== productionEnvironment.projectId
    || env.TAKEME_STORAGE_BUCKETS !== productionEnvironment.storageBucket || appStorageBucket !== productionEnvironment.storageBucket
    || env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false" || env.PROTECTED_PAYMENTS_ENABLED !== "false"
    || env.TAKEME_ENABLE_STAGING_DELETION !== undefined && env.TAKEME_ENABLE_STAGING_DELETION !== "false"
    || env.TAKEME_DELETION_ENVIRONMENT !== undefined && env.TAKEME_DELETION_ENVIRONMENT !== "production"
    || Object.keys(env).some(key => /EMULATOR|EMULATORS/.test(key) && !(key === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[key] === "false"))) {
    return refuse("Exact production resources and deletion/payments OFF are required; emulators are prohibited.");
  }
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG);
      if (!config || typeof config !== "object" || Array.isArray(config) || config.projectId !== productionEnvironment.projectId || config.storageBucket !== productionEnvironment.storageBucket) {
        return refuse("Firebase app resource identity must match production.");
      }
    } catch { return refuse("Firebase app resource identity must match production."); }
  }
  if (!["enable", "disable"].includes(action) || !["absent", "off", "on"].includes(expectedState)) return refuse("Only explicit enable/disable with an expected state is supported.");
  if (expectedState === "absent" ? expectedUpdateTime !== null : typeof expectedUpdateTime !== "string" || !updateTimePattern.test(expectedUpdateTime)) {
    return refuse("Existing control requires its exact Firestore update-time token; absent control must not provide one.");
  }
  if (action === "disable" && expectedState === "absent") return refuse("Reopen requires an existing reviewed control; it never creates or deletes a normal-state document.");
  return Object.freeze({ path: "releaseControls/current", action, expectedState, expectedUpdateTime,
    record: Object.freeze({ releaseTarget: "production", projectId: productionEnvironment.projectId, protectedWritesPaused: action === "enable" }) });
}

export function productionMaintenanceRecordMatches(value: unknown, expected: Readonly<MaintenanceControlRecord>): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3 && Object.entries(expected).every(([key, field]) => Object.hasOwn(record, key) && record[key] === field);
}

/** Enable is independent of legal activation; reopen never grants publication or accepts an inactive policy. */
export function assertMaintenanceApplySource(plan: MaintenanceOperationPlan, policy: ReleasePolicy = productionReleasePolicy, legal: LegalPublicationReadiness = legalPublicationReadiness) {
  const expected = { releaseTarget: "production" as const, projectId: productionEnvironment.projectId, protectedWritesPaused: plan.action === "enable" };
  if (plan.path !== "releaseControls/current" || !["enable", "disable"].includes(plan.action)
    || !["absent", "off", "on"].includes(plan.expectedState)
    || !productionMaintenanceRecordMatches(plan.record, expected)
    || (plan.expectedState === "absent" ? plan.expectedUpdateTime !== null : typeof plan.expectedUpdateTime !== "string" || !updateTimePattern.test(plan.expectedUpdateTime))
    || plan.action === "disable" && plan.expectedState === "absent") return refuse("The fixed control plan or compare-and-set precondition is invalid.");
  if (plan.action === "disable" && (validateProductionPolicy(policy).length || validateLegalPublication(legal).length)) {
    return refuse("Reopen requires separately approved final policy/legal source. No approval override is supported.");
  }
}

export interface MaintenanceSnapshot { readonly exists: boolean; readonly data?: unknown; readonly updateTime: string | null }
export interface MaintenanceTransaction {
  readControl(): Promise<MaintenanceSnapshot>;
  readPolicy(): Promise<unknown>;
  createControl(record: Readonly<MaintenanceControlRecord>): void;
  replaceControl(record: Readonly<MaintenanceControlRecord>): void;
}
export interface MaintenanceControlStore {
  transaction<T>(action: (tx: MaintenanceTransaction) => Promise<T>): Promise<T>;
  readControl(): Promise<MaintenanceSnapshot>;
}

/** Fixed-document transaction, strict CAS and readback. Never changes policy, other config or malformed state. */
export async function applyProductionMaintenance(store: MaintenanceControlStore, plan: MaintenanceOperationPlan, policy: ReleasePolicy = productionReleasePolicy, legal: LegalPublicationReadiness = legalPublicationReadiness) {
  assertMaintenanceApplySource(plan, policy, legal);
  const result = await store.transaction(async tx => {
    const current = await tx.readControl();
    if (plan.expectedState === "absent") {
      if (current.exists || current.updateTime !== null) return refuse("Control changed; re-inspect before an explicitly approved retry.");
    } else {
      const expected = { ...plan.record, protectedWritesPaused: plan.expectedState === "on" };
      if (!current.exists || current.updateTime !== plan.expectedUpdateTime || !productionMaintenanceRecordMatches(current.data, expected)) {
        return refuse("Control differs or changed; no repair, deletion or overwrite fallback is supported.");
      }
    }
    if (plan.action === "disable") {
      const expectedPolicy: ProductionPolicyRecord = { releaseTarget: "production", projectId: productionEnvironment.projectId,
        publicationApproved: true, termsVersion: policy.termsVersion!, privacyVersion: policy.privacyVersion!, minimumAge: 18 };
      if (!productionPolicyRecordMatches(await tx.readPolicy(), expectedPolicy)) return refuse("Runtime policy is missing, revoked or mismatched; keep protected writes paused.");
    }
    if (current.exists && productionMaintenanceRecordMatches(current.data, plan.record)) return "already-current" as const;
    if (current.exists) tx.replaceControl(plan.record); else tx.createControl(plan.record);
    return "changed" as const;
  });
  const stored = await store.readControl();
  if (!stored.exists || !stored.updateTime || !productionMaintenanceRecordMatches(stored.data, plan.record)) {
    return refuse("Outcome is unknown or changed after commit; stop and inspect the fixed control without automatic repair.");
  }
  return Object.freeze({ result, protectedWritesPaused: plan.record.protectedWritesPaused, updateTime: stored.updateTime,
    path: plan.path, projectId: productionEnvironment.projectId, source: "owner-operator-script" });
}
