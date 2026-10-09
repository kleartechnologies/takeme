import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { validateReleaseEnvironment } from "./src/lib/release-config.ts";
import { encodeReleaseProof } from "./src/lib/release-proof.ts";
import { STAGING_MEDIA_BUCKET } from "./functions/src/listing-media-domain.ts";
import { firebaseWorkerAliases } from "./scripts/firebase-worker-aliases.mjs";

export default function nextConfig(phase: string): NextConfig {
  // Existing demo development sessions remain usable. Optimized builds always
  // require an explicit target, including when invoking next build directly.
  const environment = { ...process.env };
  if (phase === PHASE_DEVELOPMENT_SERVER && !environment.TAKEME_RELEASE_TARGET && environment.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-takeme") environment.TAKEME_RELEASE_TARGET = "demo";
  const configuration = validateReleaseEnvironment(environment);
  const cloudflare = environment.TAKEME_WEB_RUNTIME === "cloudflare";
  const webpack: NonNullable<NextConfig["webpack"]> = (config, { isServer }) => {
    if (isServer) config.resolve.alias = { ...config.resolve.alias, ...firebaseWorkerAliases(process.cwd()) };
    return config;
  };
  return {
    ...(cloudflare ? { webpack } : {}),
    env: { TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(configuration) },
    images: {
      dangerouslyAllowLocalIP: configuration.useEmulators,
      remotePatterns: [
        { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: configuration.target === "staging" ? `/v0/b/${configuration.publicFirebase.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/**` : "/**" },
        ...(configuration.target === "staging" ? [{ protocol: "https" as const, hostname: "firebasestorage.googleapis.com", pathname: `/v0/b/${STAGING_MEDIA_BUCKET}/o/users%2F**` }] : []),
        { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
        ...(configuration.useEmulators ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "9199", pathname: "/**" }] : []),
      ],
    },
  };
}
