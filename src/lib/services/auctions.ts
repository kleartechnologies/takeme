import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { AuctionListingInput, AuctionStatus, Bid } from "@/types/marketplace";

interface AuctionStateResponse {
  currentBid: number;
  currentBidderId: string | null;
  bidCount: number;
  auctionStatus: AuctionStatus;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  winnerId: string | null;
  finalBid: number | null;
  endedAt: string | null;
}

function requireFunctions() {
  if (!functions) throw new Error("Firebase Functions is not configured. Add the required environment variables first.");
  return functions;
}

function callableError(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return new Error(error.message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[^)]+\)\.?$/i, ""));
  }
  return new Error("The auction request could not be completed. Please try again.");
}

async function call<Request, Response>(name: string, data: Request) {
  try {
    const result = await httpsCallable<Request, Response>(requireFunctions(), name)(data);
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

export function subscribeToBidHistory(listingId: string, onChange: (bids: Bid[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onError(new Error("Firebase is not configured."));
    return () => undefined;
  }
  const bidQuery = query(collection(db, "listings", listingId, "bids"), orderBy("createdAt", "desc"), limit(25));
  return onSnapshot(bidQuery, (snapshot) => {
    onChange(snapshot.docs.map((bid) => {
      const data = bid.data();
      return {
        id: bid.id,
        listingId,
        bidderId: String(data.bidderId),
        amount: Number(data.amount),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    }));
  }, (error) => onError(new Error(error.message)));
}
