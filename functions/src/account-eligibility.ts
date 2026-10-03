import { getApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { getReleasePolicy, policyIsConfigured, validateProductionPolicy, type ReleasePolicy, type ReleaseTarget } from "./release-policy";

export const releasePolicyRef = () => getFirestore().doc("releasePolicies/current");
export const acceptanceRef = (uid: string) => getFirestore().doc(`users/${uid}/private/onboarding`);
type PolicyContext = { target: ReleaseTarget; projectId: string; policy: ReleasePolicy };

/** Environment variables select a trusted release; clients cannot select policy versions. */
export function resolvePolicyContext(env: NodeJS.ProcessEnv, appProjectId?: string): PolicyContext | null {
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT, appProjectId].filter((value): value is string => value !== undefined);
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG);
      if (typeof config.projectId === "string") projects.push(config.projectId);
    } catch { return null; }
  }
  const projectId = projects[0];
  if (!projectId || projects.some(value => value !== projectId)) return null;
  if (projectId === "demo-takeme" && (env.TAKEME_RELEASE_TARGET === undefined || env.TAKEME_RELEASE_TARGET === "demo")
    && (env.TAKEME_FIREBASE_PROJECT_ID === undefined || env.TAKEME_FIREBASE_PROJECT_ID === projectId)
    && env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" && env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080") {
    if (env.FIREBASE_STORAGE_EMULATOR_HOST !== undefined && env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") return null;
    return { target: "demo", projectId, policy: getReleasePolicy("demo") };
  }
  if (env.TAKEME_RELEASE_TARGET !== "production" || !projectId || projectId.startsWith("demo-")
    || env.TAKEME_FIREBASE_PROJECT_ID !== projectId
    || Object.keys(env).some(name => /EMULATOR|EMULATORS/.test(name)
      && !(name === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[name] === "false"))
    || validateProductionPolicy().length) return null;
  return { target: "production", projectId, policy: getReleasePolicy("production") };
}
export function runtimePolicyContext(): PolicyContext | null {
  return resolvePolicyContext(process.env, getApp().options.projectId);
}

export function policyMirrorMatches(data: DocumentData | undefined, context: PolicyContext | null) {
  return !!context && policyIsConfigured(context.policy) && data?.releaseTarget === context.target
    && data?.projectId === context.projectId && data?.publicationApproved === true
    && data?.termsVersion === context.policy.termsVersion && data?.privacyVersion === context.policy.privacyVersion
    && data?.minimumAge === context.policy.minimumAge;
}

/** Rules consume this server-owned mirror. Never re-enable an existing revoked/mismatched release. */
export async function initializeDemoPolicyMirror() {
  const context = runtimePolicyContext();
  if (context?.target !== "demo") return;
  try { await releasePolicyRef().create({ releaseTarget: context.target, projectId: context.projectId, ...context.policy }); }
  catch (error) { if (![6, "already-exists"].includes((error as { code?: string | number }).code ?? "")) throw error; }
}

function timestampPresent(value: unknown): boolean {
  return !!value && typeof (value as { toMillis?: unknown }).toMillis === "function"
    && Number.isFinite((value as { toMillis(): number }).toMillis());
}
export function hasCurrentAcceptance(data: DocumentData | undefined, policy: ReleasePolicy) {
  return policyIsConfigured(policy) && data?.termsVersion === policy.termsVersion && data?.privacyVersion === policy.privacyVersion
    && timestampPresent(data.termsAcceptedAt) && timestampPresent(data.privacyAcceptedAt) && timestampPresent(data.age18ConfirmedAt)
    && data.acceptanceSource === "web" && !data.revokedAt;
}

export function policyUnavailable(): never {
  throw new HttpsError("failed-precondition", "Account setup is unavailable until the current policies are approved for this release.", { reason: "policy-release-unavailable", step: "acceptance" });
}
export async function currentReleasePolicy(tx?: Transaction): Promise<ReleasePolicy> {
  const context = runtimePolicyContext();
  if (!context) return policyUnavailable();
  const mirror = tx ? await tx.get(releasePolicyRef()) : await releasePolicyRef().get();
  if (!policyMirrorMatches(mirror.data(), context)) return policyUnavailable();
  return context.policy;
}

/** Include both acceptance and policy reads in each guarded write transaction to reject revocation races. */
export async function assertMarketplaceEligibility(uid: string, tx?: Transaction) {
  const policy = await currentReleasePolicy(tx);
  const setup = tx ? await tx.get(acceptanceRef(uid)) : await acceptanceRef(uid).get();
  if (!hasCurrentAcceptance(setup.data(), policy)) {
    throw new HttpsError("failed-precondition", "Confirm that you are 18 or older and accept the current Terms and Privacy Policy before continuing.", { reason: "account-policy-required", step: "acceptance" });
  }
}
export async function marketplaceAccountIsEligible(uid: string, tx?: Transaction) {
  try { await assertMarketplaceEligibility(uid, tx); return true; }
  catch (error) { if (error instanceof HttpsError && error.code === "failed-precondition") return false; throw error; }
}
