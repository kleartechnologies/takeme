import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { clientReleaseProofMatches } from "@/lib/release-proof";

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (useFirebaseEmulators ? "demo-api-key" : undefined),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (useFirebaseEmulators ? "demo-takeme.firebaseapp.com" : undefined),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (useFirebaseEmulators ? "demo-takeme" : undefined),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (useFirebaseEmulators ? "demo-takeme.firebasestorage.app" : undefined),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (useFirebaseEmulators ? "123456789" : undefined),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || (useFirebaseEmulators ? "1:123456789:web:demo" : undefined),
};

const releaseSafe = clientReleaseProofMatches(firebaseConfig, useFirebaseEmulators, process.env.TAKEME_BUILD_RELEASE_PROOF, process.env.NODE_ENV === "production");
export const isFirebaseConfigured = releaseSafe && Object.values(firebaseConfig).every(Boolean);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (isFirebaseConfigured && typeof window !== "undefined") {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, "asia-southeast1");
  if (useFirebaseEmulators) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectStorageEmulator(storage, "127.0.0.1", 9199);
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    } catch {
      // Hot reload can reuse already-connected SDK instances.
    }
  }
}

export { app, auth, db, storage, functions };
