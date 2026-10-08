import { stagingEnvironment } from "../../../functions/src/staging-environment.ts";
import { clientReleaseProofMatches, decodeReleaseProof, isStagingReleaseProof } from "../release-proof.ts";

export interface PublicFirebaseOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const identityKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"] as const;

/** Check the actual reused SDK app, not just the configuration intended for it. */
export function firebaseAppIdentityMatches(actual: PublicFirebaseOptions, expected: PublicFirebaseOptions) {
  return identityKeys.every(key => typeof expected[key] === "string" && !!expected[key] && actual[key] === expected[key]);
}

export function assertFirebaseAppIdentity(actual: PublicFirebaseOptions, expected: PublicFirebaseOptions) {
  if (!firebaseAppIdentityMatches(actual, expected)) throw new Error("Firebase app identity does not match this build.");
}

export type MetadataEnvironment = Record<string, string | undefined>;

/** Resolve one approved callable endpoint before a server metadata request can start. */
export function metadataEndpoint(env: MetadataEnvironment): string | null {
  if (env.TAKEME_OFFLINE_QUALIFICATION === "true") return null;
  const useEmulators = env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
  const config: PublicFirebaseOptions = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || (useEmulators ? "demo-api-key" : undefined),
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (useEmulators ? "demo-takeme.firebaseapp.com" : undefined),
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (useEmulators ? "demo-takeme" : undefined),
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (useEmulators ? "demo-takeme.firebasestorage.app" : undefined),
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (useEmulators ? "123456789" : undefined),
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || (useEmulators ? "1:123456789:web:demo" : undefined),
  };
  if (!clientReleaseProofMatches(config, useEmulators, env.TAKEME_BUILD_RELEASE_PROOF, env.NODE_ENV === "production")) return null;
  const projectId = config.projectId;
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return null;
  const proof = env.TAKEME_BUILD_RELEASE_PROOF ? decodeReleaseProof(env.TAKEME_BUILD_RELEASE_PROOF) : null;
  if (env.TAKEME_RELEASE_TARGET !== undefined
    && env.TAKEME_RELEASE_TARGET !== (proof?.target ?? (useEmulators ? "demo" : undefined))) return null;
  const staging = env.TAKEME_RELEASE_TARGET === "staging" || projectId === stagingEnvironment.projectId || proof?.target === "staging";
  if (staging && (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false" || !isStagingReleaseProof(env.TAKEME_BUILD_RELEASE_PROOF ?? "")
    || projectId !== stagingEnvironment.projectId || config.authDomain !== stagingEnvironment.authDomain
    || config.storageBucket !== stagingEnvironment.storageBucket || config.messagingSenderId !== stagingEnvironment.projectNumber
    || env.NEXT_PUBLIC_SITE_URL !== stagingEnvironment.siteUrl)) return null;
  if (useEmulators) return projectId === "demo-takeme" ? `http://127.0.0.1:5001/${projectId}/asia-southeast1/getPublicListingDetail` : null;
  return `https://asia-southeast1-${projectId}.cloudfunctions.net/getPublicListingDetail`;
}

export function isStagingSiteUrl(value: string) {
  return value === stagingEnvironment.siteUrl;
}

/** Shared Storage hostname is insufficient: staging media must name the exact bucket. */
export function isStagingMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://firebasestorage.googleapis.com" || url.username || url.password || url.hash) return false;
    if ([...url.searchParams.keys()].some(key => key !== "alt" && key !== "token")
      || url.searchParams.getAll("alt").length !== 1 || url.searchParams.getAll("token").length !== 1) return false;
    const path = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    return !!path && path[1] === stagingEnvironment.storageBucket && !/%[0-9a-f]{2}/i.test(path[1])
      && url.searchParams.get("alt") === "media" && !!url.searchParams.get("token");
  } catch { return false; }
}

/** Published editorial PNGs use Storage-rule access, never download tokens.
 * Keep this separate from the existing listing/avatar media contract. */
export function isStagingEditorialAssetUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://firebasestorage.googleapis.com" || url.username || url.password || url.hash) return false;
    if ([...url.searchParams.keys()].some(key => key !== "alt")
      || url.searchParams.getAll("alt").length !== 1 || url.searchParams.get("alt") !== "media") return false;
    const path = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (!path || path[1] !== stagingEnvironment.storageBucket) return false;
    return /^admin-assets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/image\.png$/.test(decodeURIComponent(path[2]));
  } catch { return false; }
}
