import type { Listing } from "../types/marketplace";
import { effectiveStatus } from "./auction-presentation.ts";

type SaveListing = Pick<Listing, "listingType" | "status" | "auctionStatus" | "auctionStartAt" | "auctionEndAt">;

// Presentation only. Firestore remains authoritative for ownership and eligibility.
export function listingSaveAction(listing: SaveListing | undefined, saved: boolean, now: number, allowTerminalRemoval = false): "save" | "remove" | null {
  const auction = listing?.listingType === "auction" || listing?.listingType === "buy_now_and_auction";
  const available = !auction || listing.status === "active" && ["active", "scheduled"].includes(effectiveStatus(listing, now));
  if (!available) return saved && allowTerminalRemoval ? "remove" : null;
  return saved ? "remove" : "save";
}
