import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./client";
import { newPublicProfileFields, validateSignupDisplayName } from "./profile-name";

function requireFirebase() {
  if (!auth || !db) {
    throw new Error("Firebase is not configured yet. Add the required environment variables to continue.");
  }
  return { auth, db };
}

async function createProfile(user: User, displayName?: string) {
  const services = requireFirebase();
  const profileRef = doc(services.db, "users", user.uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return;
  await setDoc(
    profileRef,
    {
      ...newPublicProfileFields(user, displayName),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const name = validateSignupDisplayName(displayName);
  const services = requireFirebase();
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await createProfile(credential.user, name);
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
  await sendPasswordResetEmail(requireFirebase().auth, email);
}

export async function logout() {
  await signOut(requireFirebase().auth);
}
