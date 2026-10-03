import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { marketplaceCall, runGuardedTransaction } from "./account-lifecycle";

// Local draft acceptance only. Publication approval must precede any production replacement.
export const AUTH_POLICY_VERSION = "1.0-draft";
const setupRef = (uid: string) => getFirestore().doc(`users/${uid}/private/onboarding`);

export function requireOnboardingDemo() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (project !== "demo-takeme" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") {
    throw new HttpsError("failed-precondition", "Draft account setup is available only in the local demo environment.");
  }
}

export function hasCurrentAcceptance(data: DocumentData | undefined) {
  return data?.termsVersion === AUTH_POLICY_VERSION && data?.privacyVersion === AUTH_POLICY_VERSION
    && !!data.termsAcceptedAt?.toMillis && !!data.privacyAcceptedAt?.toMillis && !!data.age18ConfirmedAt?.toMillis
    && data.acceptanceSource === "web";
}

export function validateAcceptance(data: DocumentData) {
  if (data.acceptTerms !== true || data.acceptPrivacy !== true || data.confirmAge18 !== true) throw new HttpsError("invalid-argument", "Confirm that you are 18 or older and accept both policies.");
  if (data.termsVersion !== AUTH_POLICY_VERSION || data.privacyVersion !== AUTH_POLICY_VERSION) throw new HttpsError("failed-precondition", "Read and accept the current policy versions.");
}

export const getAccountSetupStatus = onCall(async request => {
  requireOnboardingDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const uid = request.auth.uid;
  let identity;
  try { identity = await getAuth().getUser(uid); }
  catch { throw new HttpsError("unauthenticated", "Sign in again."); }
  if (identity.disabled) throw new HttpsError("unauthenticated", "Sign in again.");
  return getFirestore().runTransaction(async tx => {
    const lifecycle = await tx.get(getFirestore().doc(`accountLifecycles/${uid}`));
    if (lifecycle.exists) return { step: "deletion" };
    const setup = (await tx.get(setupRef(uid))).data();
    if (!hasCurrentAcceptance(setup)) return { step: "acceptance" };
    const profile = (await tx.get(getFirestore().doc(`users/${uid}`))).data();
    if (!setup?.profileCompletedAt || !profile || typeof profile.displayName !== "string" || Array.from(profile.displayName.trim()).length < 2) return { step: "profile" };
    return { step: setup.welcomeCompletedAt ? "ready" : "welcome" };
  });
});

export const acceptWebPolicies = marketplaceCall(async request => {
  requireOnboardingDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  validateAcceptance(request.data ?? {});
  const ref = setupRef(request.auth.uid);
  await runGuardedTransaction(getFirestore(), async tx => {
    const previous = (await tx.get(ref)).data();
    if (hasCurrentAcceptance(previous)) return; // Retry never changes the original acceptance time.
    tx.set(ref, {
      termsVersion: AUTH_POLICY_VERSION, privacyVersion: AUTH_POLICY_VERSION,
      termsAcceptedAt: FieldValue.serverTimestamp(), privacyAcceptedAt: FieldValue.serverTimestamp(),
      age18ConfirmedAt: FieldValue.serverTimestamp(), acceptanceSource: "web",
      ...(previous?.profileCompletedAt ? { profileCompletedAt: previous.profileCompletedAt } : {}),
      ...(previous?.welcomeCompletedAt ? { welcomeCompletedAt: previous.welcomeCompletedAt } : {}),
    });
  });
  return { accepted: true };
});

export const completeFirstTimeProfile = marketplaceCall(async request => {
  requireOnboardingDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const uid = request.auth.uid, ref = setupRef(uid);
  await runGuardedTransaction(getFirestore(), async tx => {
    const setup = (await tx.get(ref)).data();
    const profile = (await tx.get(getFirestore().doc(`users/${uid}`))).data();
    if (!hasCurrentAcceptance(setup)) throw new HttpsError("failed-precondition", "Accept the policies first.");
    const length = typeof profile?.displayName === "string" ? Array.from(profile.displayName.trim()).length : 0;
    if (length < 2 || length > 80) throw new HttpsError("failed-precondition", "Save a display name of 2–80 characters first.");
    if (!setup?.profileCompletedAt) tx.update(ref, { profileCompletedAt: FieldValue.serverTimestamp() });
  });
  return { completed: true };
});

export const finishAccountWelcome = marketplaceCall(async request => {
  requireOnboardingDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const ref = setupRef(request.auth.uid);
  await runGuardedTransaction(getFirestore(), async tx => {
    const setup = (await tx.get(ref)).data();
    if (!hasCurrentAcceptance(setup) || !setup?.profileCompletedAt) throw new HttpsError("failed-precondition", "Complete account setup first.");
    if (!setup.welcomeCompletedAt) tx.update(ref, { welcomeCompletedAt: FieldValue.serverTimestamp() });
  });
  return { completed: true };
});
