import type { ReleaseConfiguration } from "./release-config.ts";

export const releaseProofPrefix = "TAKEME_RELEASE_PROOF_V1:";
type PublicFirebase = ReleaseConfiguration["publicFirebase"];
export interface ReleaseProof {
  format: 1;
  target: "demo" | "production";
  projectId: string;
  siteUrl: string;
  useEmulators: boolean;
  firebase: PublicFirebase;
  policy: ReleaseConfiguration["policy"];
}

// Contains public Web SDK configuration only. Server gates, hosts and credentials
// must never be added to this browser-visible build proof.
export function encodeReleaseProof(configuration: ReleaseConfiguration) {
  const proof: ReleaseProof = { format: 1, target: configuration.target, projectId: configuration.projectId,
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
  const expected = { NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId, NEXT_PUBLIC_FIREBASE_APP_ID: config.appId };
  if (Object.entries(expected).some(([key, value]) => !value || proof.firebase?.[key as keyof PublicFirebase] !== value)) return false;
  if (proof.target === "demo") return useEmulators && config.projectId === "demo-takeme";
  return proof.target === "production" && !useEmulators && !config.projectId?.startsWith("demo-")
    && proof.siteUrl === "https://takeme.my" && proof.policy?.publicationApproved === true
    && !!proof.policy.termsVersion && !!proof.policy.privacyVersion
    && !/draft/i.test(proof.policy.termsVersion) && !/draft/i.test(proof.policy.privacyVersion)
    && proof.policy.minimumAge === 18;
}
