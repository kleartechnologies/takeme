import type { PublicListingMetadata } from "../listing-metadata";
import { parsePublicLocation } from "../general-location.ts";

export async function getPublicListingForMetadata(id: string): Promise<PublicListingMetadata | null> {
  // Dedicated offline qualification never reads a Firebase project, including
  // when its force-dynamic metadata route is invoked during local inspection.
  if (process.env.TAKEME_OFFLINE_QUALIFICATION === "true") return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const endpoint = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
    ? `http://127.0.0.1:5001/${projectId}/asia-southeast1/getPublicListingDetail`
    : `https://asia-southeast1-${projectId}.cloudfunctions.net/getPublicListingDetail`;

  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { listingId: id } }), cache: "no-store" });
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
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter((url: unknown): url is string => typeof url === "string") : [],
    };
  } catch {
    // Missing, private, and temporarily unavailable listings get neutral metadata.
    return null;
  }
}
