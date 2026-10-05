import { productionEnvironment } from "./production-environment.ts";
import { getReleasePolicy, policyIsConfigured, validateProductionPolicy, type ReleasePolicy } from "./release-policy.ts";
import { stagingFirebaseProjectId } from "./staging-environment.ts";

export type PolicyContext =
  | { target: "production"; projectId: string }
  | { target: "demo" | "staging"; projectId: string; policy: Readonly<ReleasePolicy> };

const productionRecordFields = ["releaseTarget", "projectId", "publicationApproved", "termsVersion", "privacyVersion", "minimumAge"];

/** Resolve only the trusted server-owned policy record. No client or environment value supplies policy approval or versions. */
export function releasePolicyFromMirror(value: unknown, context: PolicyContext | null): Readonly<ReleasePolicy> | null {
  if (!context || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.releaseTarget !== context.target || record.projectId !== context.projectId) return null;
  if (context.target === "production") {
    if (context.projectId !== productionEnvironment.projectId
      || Object.keys(record).length !== productionRecordFields.length
      || productionRecordFields.some(field => !Object.hasOwn(record, field))
      || record.publicationApproved !== true || record.minimumAge !== 18
      || typeof record.termsVersion !== "string" || typeof record.privacyVersion !== "string") return null;
    const policy: ReleasePolicy = { publicationApproved: true, termsVersion: record.termsVersion, privacyVersion: record.privacyVersion, minimumAge: 18 };
    if (validateProductionPolicy(policy).length) return null;
    return Object.freeze(policy);
  }
  const expectedProject = context.target === "demo" ? "demo-takeme" : stagingFirebaseProjectId;
  const policy = getReleasePolicy(context.target);
  if (context.projectId !== expectedProject || !policyIsConfigured(policy)
    || record.publicationApproved !== true || record.termsVersion !== policy.termsVersion
    || record.privacyVersion !== policy.privacyVersion || record.minimumAge !== policy.minimumAge) return null;
  return policy;
}
