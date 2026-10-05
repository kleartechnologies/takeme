import { marketplaceCallable } from "@/lib/services/marketplace-call";
import { functions } from "@/lib/firebase/client";
import type { AuctionListingInput, AuctionStatus } from "@/types/marketplace";
import { protectedWriteMaintenanceMessage } from "@/lib/protected-write-maintenance";

interface AuctionStateResponse {
  currentBid: number;
  bidCount: number;
  auctionStatus: AuctionStatus;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  finalBid: number | null;
  endedAt: string | null;
}

function requireFunctions() {
  if (!functions) throw new Error("Firebase Functions is not configured. Add the required environment variables first.");
  return functions;
}

function callableError(error: unknown) {
  if (protectedWriteMaintenanceMessage(error)) return error;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return new Error(error.message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[^)]+\)\.?$/i, ""));
  }
  return new Error("The auction request could not be completed. Please try again.");
}

async function call<Request, Response>(name: string, data: Request) {
  try {
    const result = await marketplaceCallable<Request, Response>(requireFunctions(), name)(data);
    return result.data;
  } catch (error) {
    throw callableError(error);
  }
}

export async function createAuctionDraft(input: AuctionListingInput) {
  const result = await call<AuctionListingInput, { listingId: string }>("createAuctionListing", input);
  return result.listingId;
}

export function publishAuction(listingId: string, imageUrls: string[]) {
  return call<{ listingId: string; imageUrls: string[] }, AuctionStateResponse>("publishAuctionListing", { listingId, imageUrls });
}

export function saveAuction(listingId: string, input: AuctionListingInput, imageUrls: string[]) {
  return call<AuctionListingInput & { listingId: string; imageUrls: string[] }, { listingId: string }>("updateAuctionListing", { ...input, listingId, imageUrls });
}

export function placeAuctionBid(listingId: string, amount: number) {
  return call<{ listingId: string; amount: number }, AuctionStateResponse>("placeBid", { listingId, amount });
}

export function cancelAuctionListing(listingId: string) {
  return call<{ listingId: string }, AuctionStateResponse>("cancelAuction", { listingId });
}

export interface AuctionViewerState {
  isHighestBidder: boolean;
  isWinner: boolean;
  isOutbid: boolean;
  transactionId: string | null;
}

export function getAuctionViewerState(listingId: string) {
  return call<{ listingId: string }, AuctionViewerState>("getAuctionViewerState", { listingId });
}
