import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  validatePassword,
  type PasswordValidationStatus,
  type User,
} from "firebase/auth";
import { auth, db } from "./client";
import { createProfileIfMissing } from "./profile-bootstrap";

function requireFirebase() {
  if (!auth || !db) {
    throw new Error("Firebase is not configured yet. Add the required environment variables to continue.");
  }
  return { auth, db };
}

async function createProfile(user: User, displayName?: string) {
  const services = requireFirebase();
  await createProfileIfMissing(services.db, user, displayName);
}

export async function registerWithEmail(email: string, password: string) {
  const services = requireFirebase();
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  await createProfile(credential.user);
  return credential.user;
}

export async function loginWithEmail(email: string, password: string) {
  const user = (await signInWithEmailAndPassword(requireFirebase().auth, email, password)).user;
  await createProfile(user);
  return user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(requireFirebase().auth, new GoogleAuthProvider());
  await createProfile(credential.user);
  return credential.user;
}

export async function resetPassword(email: string) {
  try { await sendPasswordResetEmail(requireFirebase().auth, email); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
}

export async function checkSignupPassword(password: string): Promise<PasswordValidationStatus> {
  const service = requireFirebase().auth;
  try { return await validatePassword(service, password); }
  catch (error) {
    // The Auth emulator explicitly does not implement getPasswordPolicy. Its
    // signup endpoint enforces Firebase's six-character default (integration-tested).
    // Never use this fallback for a live project or an ordinary network failure.
    const code = (error as { code?: string }).code ?? "";
    if (!service.emulatorConfig || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-takeme" || !code.includes("getpasswordpolicy-is-not-implemented")) throw error;
    return { isValid: password.length >= 6, meetsMinPasswordLength: password.length >= 6,
      passwordPolicy: { customStrengthOptions: { minPasswordLength: 6 }, allowedNonAlphanumericCharacters: "", enforcementState: "ENFORCE", forceUpgradeOnSignin: false } };
  }
}

export async function logout() {
  await signOut(requireFirebase().auth);
}
