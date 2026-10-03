import type { ReleaseConfiguration } from "./release-config.ts";
import { stagingEnvironment } from "../../functions/src/staging-environment.ts";

export const releaseProofPrefix = "TAKEME_RELEASE_PROOF_V1:";
type PublicFirebase = ReleaseConfiguration["publicFirebase"];
export interface ReleaseProof {
  format: 1;
  purpose: ReleaseConfiguration["purpose"];
  target: ReleaseConfiguration["target"];
  projectId: string;
  siteUrl: string;
  useEmulators: boolean;
  firebase: PublicFirebase;
  policy: ReleaseConfiguration["policy"];
}

// Contains public Web SDK configuration only. Server gates, hosts and credentials
// must never be added to this browser-visible build proof.
export function encodeReleaseProof(configuration: ReleaseConfiguration) {
  const proof: ReleaseProof = { format: 1, purpose: configuration.purpose, target: configuration.target, projectId: configuration.projectId,
    siteUrl: configuration.siteUrl, useEmulators: configuration.useEmulators,
    firebase: configuration.publicFirebase, policy: configuration.policy };
  const bytes = new TextEncoder().encode(JSON.stringify(proof));
  return releaseProofPrefix + btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
}

export function decodeReleaseProof(value: string): ReleaseProof | null {
  try {
    if (!value.startsWith(releaseProofPrefix)) return null;
    const bytes = Uint8Array.from(atob(value.slice(releaseProofPrefix.length)), character => character.charCodeAt(0));
    const proof = JSON.parse(new TextDecoder().decode(bytes));
    return proof?.format === 1 ? proof as ReleaseProof : null;
  } catch { return null; }
}

export function clientReleaseProofMatches(config: { apiKey?: string; authDomain?: string; projectId?: string; storageBucket?: string; messagingSenderId?: string; appId?: string }, useEmulators: boolean, proofValue: string | undefined, optimized: boolean) {
  if (!optimized && !proofValue) return useEmulators && config.projectId === "demo-takeme";
  if (!proofValue) return false;
  const proof = decodeReleaseProof(proofValue);
  if (!proof || proof.projectId !== config.projectId || proof.useEmulators !== useEmulators) return false;
  if (proof.target === "staging" ? !isStagingReleaseProof(proofValue) : proof.purpose !== "release") return false;
  const expected = { NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId, NEXT_PUBLIC_FIREBASE_APP_ID: config.appId };
  if (Object.entries(expected).some(([key, value]) => !value || proof.firebase?.[key as keyof PublicFirebase] !== value)) return false;
  if (proof.target === "demo") return useEmulators && config.projectId === "demo-takeme";
  if (proof.target === "staging") return !useEmulators;
  return proof.target === "production" && !useEmulators && !config.projectId?.startsWith("demo-")
    && config.projectId !== stagingEnvironment.projectId && config.messagingSenderId !== stagingEnvironment.projectNumber
    && proof.siteUrl === "https://takeme.my" && proof.policy?.publicationApproved === true
    && !!proof.policy.termsVersion && !!proof.policy.privacyVersion
    && !/draft/i.test(proof.policy.termsVersion) && !/draft/i.test(proof.policy.privacyVersion)
    && proof.policy.minimumAge === 18;
}

/** Browser-visible proof permits only the reviewed staging identity, never production promotion. */
export function isStagingReleaseProof(value: string | undefined): boolean {
  const proof = value ? decodeReleaseProof(value) : null;
  const sdk = proof?.firebase;
  return !!proof && proof.target === "staging" && proof.purpose === "staging-preview" && proof.useEmulators === false
    && proof.projectId === stagingEnvironment.projectId && proof.siteUrl === stagingEnvironment.siteUrl
    && sdk?.NEXT_PUBLIC_FIREBASE_PROJECT_ID === stagingEnvironment.projectId
    && sdk.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN === stagingEnvironment.authDomain
    && sdk.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === stagingEnvironment.storageBucket
    && sdk.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID === stagingEnvironment.projectNumber
    && /^AIza[A-Za-z0-9_-]{35}$/.test(sdk.NEXT_PUBLIC_FIREBASE_API_KEY || "")
    && new RegExp(`^1:${stagingEnvironment.projectNumber}:web:[a-f0-9]{16,40}$`).test(sdk.NEXT_PUBLIC_FIREBASE_APP_ID || "")
    && proof.policy?.publicationApproved === true && proof.policy.termsVersion === stagingEnvironment.policyVersion
    && proof.policy.privacyVersion === stagingEnvironment.policyVersion && proof.policy.minimumAge === 18;
}
