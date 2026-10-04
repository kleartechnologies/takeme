import type { AuctionStatus, Listing } from "../types/marketplace";

// Presentation urgency only; bid acceptance and finalization remain server controlled.
export const ENDING_SOON_MS = 5 * 60 * 1000;

export function effectiveStatus(listing: Pick<Listing, "auctionStatus" | "auctionStartAt" | "auctionEndAt">, now: number): AuctionStatus {
  if (listing.auctionStatus === "cancelled" || listing.auctionStatus === "ended") return listing.auctionStatus;
  if (now === 0) return listing.auctionStatus ?? "scheduled";
  if (listing.auctionEndAt && now >= Date.parse(listing.auctionEndAt)) return "ended";
  if (listing.auctionStartAt && now < Date.parse(listing.auctionStartAt)) return "scheduled";
  return listing.auctionStartAt && listing.auctionEndAt && Number.isFinite(Date.parse(listing.auctionStartAt)) && Number.isFinite(Date.parse(listing.auctionEndAt)) ? "active" : listing.auctionStatus ?? "scheduled";
}

export function auctionBidLabel(listing: Pick<Listing, "status" | "auctionStatus" | "auctionStartAt" | "auctionEndAt" | "bidCount">, now = 0) {
  const status = effectiveStatus(listing, now);
  if (listing.status === "ended" || status === "ended") return "Final bid";
  if (status === "scheduled") return "Starting bid";
  if (status === "active") return "Current bid";
  return (listing.bidCount ?? 0) > 0 ? "Current bid" : "Starting bid";
}

export function auctionClock(target: string | undefined, now: number) {
  const timestamp = target ? Date.parse(target) : NaN;
  if (!Number.isFinite(timestamp) || now === 0) return null;
  const remaining = Math.max(0, timestamp - now);
  const seconds = Math.floor(remaining / 1000);
  return { remaining, days: Math.floor(seconds / 86400), hours: Math.floor((seconds % 86400) / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 };
}

export function quickBidAmounts(minimum: number, increment: number, maximum: number) {
  if (!Number.isSafeInteger(minimum) || minimum <= 0 || !Number.isSafeInteger(increment) || increment <= 0) return [];
  return [minimum, minimum + increment, minimum + increment * 2].filter(value => Number.isSafeInteger(value) && value <= maximum);
}
