import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { marketplaceCall, runGuardedTransaction } from "./account-lifecycle";
import { acceptanceRef, currentReleasePolicy, hasCurrentAcceptance, initializeDemoPolicyMirror, releasePolicyFromMirror, releasePolicyRef, runtimePolicyContext } from "./account-eligibility";
import { demoReleasePolicy, type ReleasePolicy } from "./release-policy";
import { assertAcceptanceHistory, assertProjectedAcceptance, historyUnavailable, legacyAcceptanceHistory, newAcceptanceHistory, policyAcceptancePath } from "./policy-acceptance-history";

// Compatibility export for existing demo fixtures; the source lives in release-policy.ts.
export const AUTH_POLICY_VERSION = demoReleasePolicy.termsVersion;
const setupRef = acceptanceRef;
export { hasCurrentAcceptance } from "./account-eligibility";

export function requireOnboardingDemo() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (project !== "demo-takeme" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") {
    throw new HttpsError("failed-precondition", "Draft account setup is available only in the local demo environment.");
  }
}

export function validateAcceptance(data: DocumentData, policy: ReleasePolicy = demoReleasePolicy) {
  if (data.acceptTerms !== true || data.acceptPrivacy !== true || data.confirmAge18 !== true) throw new HttpsError("invalid-argument", "Confirm that you are 18 or older and accept both policies.");
  if (data.termsVersion !== policy.termsVersion || data.privacyVersion !== policy.privacyVersion) throw new HttpsError("failed-precondition", "Read and accept the current policy versions.");
}

export const getAccountSetupStatus = onCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const uid = request.auth.uid;
  let identity;
  try { identity = await getAuth().getUser(uid); }
  catch { throw new HttpsError("unauthenticated", "Sign in again."); }
  if (identity.disabled) throw new HttpsError("unauthenticated", "Sign in again.");
  await initializeDemoPolicyMirror();
  return getFirestore().runTransaction(async tx => {
    const lifecycle = await tx.get(getFirestore().doc(`accountLifecycles/${uid}`));
    if (lifecycle.exists) return { step: "deletion" };
    const context = runtimePolicyContext();
    const mirror = await tx.get(releasePolicyRef());
    const policy = releasePolicyFromMirror(mirror.data(), context);
    const metadata = {
      policyAvailable: policy !== null,
      termsVersion: policy?.termsVersion ?? null,
      privacyVersion: policy?.privacyVersion ?? null,
      minimumAge: 18,
    };
    if (!policy) return { step: "acceptance", ...metadata };
    const setup = (await tx.get(setupRef(uid))).data();
    if (!hasCurrentAcceptance(setup, policy)) return { step: "acceptance", ...metadata };
    const profile = (await tx.get(getFirestore().doc(`users/${uid}`))).data();
    if (!setup?.profileCompletedAt || !profile || typeof profile.displayName !== "string" || Array.from(profile.displayName.trim()).length < 2) return { step: "profile", ...metadata };
    return { step: setup.welcomeCompletedAt ? "ready" : "welcome", ...metadata };
  });
});

export const acceptWebPolicies = marketplaceCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  await initializeDemoPolicyMirror();
  const uid = request.auth.uid, db = getFirestore(), ref = setupRef(uid);
  // Stable across Firestore transaction retries, never supplied by the client.
  const newAcceptanceId = randomUUID();
  await runGuardedTransaction(db, async tx => {
    const policy = await currentReleasePolicy(tx);
    validateAcceptance(request.data ?? {}, policy);
    const previous = (await tx.get(ref)).data();
    const context = runtimePolicyContext();
    if (!context) throw new HttpsError("failed-precondition", "Account policy resources are unavailable.");
    const legacy = legacyAcceptanceHistory(uid, previous);
    const hasPointer = !!previous && Object.hasOwn(previous, "acceptanceHistoryId");
    const priorId = hasPointer ? previous!.acceptanceHistoryId : legacy?.acceptanceId;
    const priorRef = priorId !== undefined ? db.doc(policyAcceptancePath(uid, priorId)) : null;
    const priorSnapshot = priorRef ? await tx.get(priorRef) : null;
    if (hasPointer && (!legacy || !priorSnapshot?.exists)) throw historyUnavailable();
    if (priorSnapshot?.exists && legacy) {
      const evidence = priorSnapshot.data()!;
      assertAcceptanceHistory(evidence, uid, priorId, legacy as { termsVersion: string; privacyVersion: string }, context);
      assertProjectedAcceptance(evidence, previous!);
    }
    const alreadyCurrent = hasCurrentAcceptance(previous, policy);
    const newRef = alreadyCurrent ? null : db.doc(policyAcceptancePath(uid, newAcceptanceId));
    if (newRef && (await tx.get(newRef)).exists) throw historyUnavailable();
    // All reads precede writes. Legacy evidence is copied exactly only during an
    // explicit acceptance, and existing events are always create-only.
    if (legacy && priorRef && !priorSnapshot?.exists) tx.create(priorRef, legacy);
    if (alreadyCurrent) {
      if (!hasPointer) tx.update(ref, { acceptanceHistoryId: priorId });
      return; // Same logical acceptance keeps its history ID and original dates.
    }
    tx.create(newRef!, newAcceptanceHistory(uid, newAcceptanceId, policy, context, previous?.revokedAt ?? undefined));
    tx.set(ref, {
      termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion,
      termsAcceptedAt: FieldValue.serverTimestamp(), privacyAcceptedAt: FieldValue.serverTimestamp(),
      age18ConfirmedAt: FieldValue.serverTimestamp(), acceptanceSource: "web", acceptanceHistoryId: newAcceptanceId,
      ...(previous?.profileCompletedAt ? { profileCompletedAt: previous.profileCompletedAt } : {}),
      ...(previous?.welcomeCompletedAt ? { welcomeCompletedAt: previous.welcomeCompletedAt } : {}),
    });
  });
  return { accepted: true };
});

export const completeFirstTimeProfile = marketplaceCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const uid = request.auth.uid, ref = setupRef(uid);
  await runGuardedTransaction(getFirestore(), async tx => {
    const policy = await currentReleasePolicy(tx);
    const setup = (await tx.get(ref)).data();
    const profile = (await tx.get(getFirestore().doc(`users/${uid}`))).data();
    if (!hasCurrentAcceptance(setup, policy)) throw new HttpsError("failed-precondition", "Accept the policies first.");
    const length = typeof profile?.displayName === "string" ? Array.from(profile.displayName.trim()).length : 0;
    if (length < 2 || length > 80) throw new HttpsError("failed-precondition", "Save a display name of 2–80 characters first.");
    if (!setup?.profileCompletedAt) tx.update(ref, { profileCompletedAt: FieldValue.serverTimestamp() });
  });
  return { completed: true };
});

export const finishAccountWelcome = marketplaceCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const ref = setupRef(request.auth.uid);
  await runGuardedTransaction(getFirestore(), async tx => {
    const policy = await currentReleasePolicy(tx);
    const setup = (await tx.get(ref)).data();
    if (!hasCurrentAcceptance(setup, policy) || !setup?.profileCompletedAt) throw new HttpsError("failed-precondition", "Complete account setup first.");
    if (!setup.welcomeCompletedAt) tx.update(ref, { welcomeCompletedAt: FieldValue.serverTimestamp() });
  });
  return { completed: true };
});
