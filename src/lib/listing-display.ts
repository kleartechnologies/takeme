// Presentation only: fixed prices are MYR; authoritative auction amounts are sen.
export function discoveryPrice(listing: { listingType: string; price: number; bidCount?: number; currentBid?: number; startingBid?: number }) {
  const auction = listing.listingType === "auction" || listing.listingType === "buy_now_and_auction";
  return auction ? ((listing.bidCount ?? 0) > 0 ? listing.currentBid ?? 0 : listing.startingBid ?? 0) / 100 : listing.price;
}

export function listingAge(createdAt: string, now: number) {
  const elapsed = now - Date.parse(createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just listed";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function auctionTimeRemaining(endAt: string, now: number) {
  const remaining = Date.parse(endAt) - now;
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Awaiting finalization";
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
}
