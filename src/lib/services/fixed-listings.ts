import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type { BuyNowListingInput } from "@/types/marketplace";

async function call<Request, Response>(name: string, data: Request): Promise<Response> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  try {
    return (await httpsCallable<Request, Response>(functions, name)(data)).data;
  } catch (error) {
    if (error instanceof Error) throw new Error(error.message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[^)]+\)\.?$/i, ""));
    throw new Error("The listing request could not be completed. Please try again.");
  }
}

export async function createFixedDraft(input: BuyNowListingInput) {
  return (await call<BuyNowListingInput, { listingId: string }>("createFixedListingDraft", input)).listingId;
}

export function publishFixed(listingId: string, imageUrls: string[]) {
  return call<{ listingId: string; imageUrls: string[] }, { listingId: string }>("publishFixedListing", { listingId, imageUrls });
}

export function updateFixed(listingId: string, input: BuyNowListingInput, imageUrls: string[]) {
  return call<BuyNowListingInput & { listingId: string; imageUrls: string[] }, { listingId: string }>("updateFixedListing", { ...input, listingId, imageUrls });
}

export function removeFixed(listingId: string) {
  return call<{ listingId: string }, { listingId: string; status: string }>("removeFixedListing", { listingId });
}
