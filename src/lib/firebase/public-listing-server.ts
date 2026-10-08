import type { PublicListingMetadata } from "../listing-metadata";
import { parsePublicLocation } from "../general-location.ts";
import { isStagingMediaUrl, metadataEndpoint } from "./staging-isolation.ts";
import { stagingEnvironment } from "../../../functions/src/staging-environment.ts";

export async function getPublicListingForMetadata(id: string): Promise<PublicListingMetadata | null> {
  // Dedicated offline qualification never reads a Firebase project, including
  // when its force-dynamic metadata route is invoked during local inspection.
  if (process.env.TAKEME_OFFLINE_QUALIFICATION === "true") return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  // Keep these explicit property reads: Next must bind browser and server to the
  // same build values rather than late Worker environment substitutions.
  const endpoint = publicListingEndpoint();
  if (!endpoint) return null;
  const staging = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === stagingEnvironment.projectId;

  try {
    // workerd rejects redirect:"error" during request construction. Manual mode
    // makes the response observable without following it; every non-2xx result,
    // including redirects to the same endpoint, remains unavailable below.
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { listingId: id } }), cache: "no-store", ...(staging ? { redirect: "manual" as const } : {}) });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { listing?: Record<string, unknown> } };
    const data = payload.result?.listing;
    if (!data) return null;
    const publicLocation = parsePublicLocation(data.publicLocation);
    if (!["active", "ended", "sold"].includes(String(data.status)) || !publicLocation) return null;
    return {
      status: String(data.status),
      publicLocation,
      title: typeof data.title === "string" ? data.title : "",
      description: typeof data.description === "string" ? data.description : "",
      price: typeof data.price === "number" ? data.price : undefined,
      listingType: typeof data.listingType === "string" ? data.listingType : undefined,
      startingBid: typeof data.startingBid === "number" ? data.startingBid : undefined,
      currentBid: typeof data.currentBid === "number" ? data.currentBid : undefined,
      bidCount: typeof data.bidCount === "number" ? data.bidCount : undefined,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter((url: unknown): url is string => typeof url === "string" && (!staging || isStagingMediaUrl(url))) : [],
    };
  } catch {
    // Missing, private, and temporarily unavailable listings get neutral metadata.
    return null;
  }
}

export function publicListingEndpoint() {
  return metadataEndpoint({
    NODE_ENV: process.env.NODE_ENV,
    TAKEME_RELEASE_TARGET: process.env.TAKEME_RELEASE_TARGET,
    TAKEME_BUILD_RELEASE_PROOF: process.env.TAKEME_BUILD_RELEASE_PROOF,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
