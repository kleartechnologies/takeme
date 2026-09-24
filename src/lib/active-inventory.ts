import type { Listing } from "@/types/marketplace";

/** Client-side resilience when an auction finalizer has not yet updated a stale document. */
export function isActiveInventoryListing(listing: Listing, now = Date.now()) {
  if (listing.status !== "active") return false;
  if (listing.listingType === "buy_now") return Number.isFinite(listing.price) && listing.price > 0;
  if (listing.auctionStatus !== "active" && listing.auctionStatus !== "scheduled") return false;
  if (!listing.auctionEndAt || new Date(listing.auctionEndAt).getTime() <= now) return false;
  if (!Number.isSafeInteger(listing.startingBid) || (listing.startingBid ?? 0) <= 0) return false;
  if ((listing.bidCount ?? 0) > 0 && (!Number.isSafeInteger(listing.currentBid) || (listing.currentBid ?? 0) < (listing.startingBid ?? 0))) return false;
  return true;
}
