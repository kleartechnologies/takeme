import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { validateReleaseEnvironment } from "./src/lib/release-config.ts";
import { encodeReleaseProof } from "./src/lib/release-proof.ts";

export default function nextConfig(phase: string): NextConfig {
  // Existing demo development sessions remain usable. Optimized builds always
  // require an explicit target, including when invoking next build directly.
  const environment = { ...process.env };
  if (phase === PHASE_DEVELOPMENT_SERVER && !environment.TAKEME_RELEASE_TARGET && environment.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-takeme") environment.TAKEME_RELEASE_TARGET = "demo";
  const configuration = validateReleaseEnvironment(environment);
  return {
    env: { TAKEME_BUILD_RELEASE_PROOF: encodeReleaseProof(configuration) },
    images: {
      dangerouslyAllowLocalIP: configuration.useEmulators,
      remotePatterns: [
        { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
        { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
        ...(configuration.useEmulators ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "9199", pathname: "/**" }] : []),
      ],
    },
  };
}
