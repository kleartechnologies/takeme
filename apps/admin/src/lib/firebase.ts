import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
const demo = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const config = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? (demo ? "demo-api-key" : ""),
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    (demo ? "demo-takeme.firebaseapp.com" : ""),
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? (demo ? "demo-takeme" : ""),
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (demo ? "demo-takeme.appspot.com" : ""),
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    (demo ? "1:123456789:web:demo" : ""),
};
export const configured =
  Object.values(config).every(Boolean) &&
  (demo
    ? config.projectId === "demo-takeme"
    : ["takeme-52b80", "takeme-staging-822a5"].includes(config.projectId)) &&
  config.storageBucket ===
    `${config.projectId}.${demo ? "appspot.com" : "firebasestorage.app"}` &&
  config.authDomain === `${config.projectId}.firebaseapp.com`;
const app =
  configured && typeof window !== "undefined"
    ? (getApps().find((a) => a.name === "takeme-admin") ??
      initializeApp(config, "takeme-admin"))
    : null;
export const auth = app ? getAuth(app) : null;
export const functions = app ? getFunctions(app, "asia-southeast1") : null;
export const storage = app ? getStorage(app) : null;
if (app && demo) {
  try {
    connectAuthEmulator(auth!, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFunctionsEmulator(functions!, "127.0.0.1", 5001);
    connectStorageEmulator(storage!, "127.0.0.1", 9199);
  } catch {
    /* Reused app during local hot reload. */
  }
}
export async function call<T = unknown>(
  name: string,
  data: object = {},
): Promise<T> {
  if (!auth?.currentUser || !functions)
    throw new Error("Sign in to TAKEME Admin.");
  return (await httpsCallable<object, T>(functions, name)(data)).data;
}
