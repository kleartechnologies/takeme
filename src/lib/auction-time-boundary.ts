import { ENDING_SOON_MS } from "./auction-presentation.ts";
import type { Listing } from "../types/marketplace";

/** UI transitions only; bid eligibility and freshness remain server verified. */
export function nextAuctionBoundary(listing: Pick<Listing, "listingType" | "auctionStatus" | "auctionStartAt" | "auctionEndAt">, now: number) {
  if (listing.listingType === "buy_now" || ["ended", "cancelled"].includes(listing.auctionStatus ?? "")) return null;
  const start = Date.parse(listing.auctionStartAt ?? "");
  const end = Date.parse(listing.auctionEndAt ?? "");
  const future = [start, end - ENDING_SOON_MS, end].filter(time => Number.isFinite(time) && time > now);
  return future.length ? Math.min(...future) : null;
}
