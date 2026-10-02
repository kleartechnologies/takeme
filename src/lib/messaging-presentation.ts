import type { MarketplaceOffer, MarketplaceTransaction } from "../types/marketplace";

export const offerLabels = { submitted: "Offer sent", countered: "Seller countered", accepted: "Offer accepted", rejected: "Offer declined", withdrawn: "Offer withdrawn", expired: "Offer expired" };

/** Seller deal responses can contain several buyers. Never show those in another chat. */
export function conversationDealState<T extends { buyerId: string; sellerId: string; listingId: string }>(conversation: T, state: { offers: MarketplaceOffer[]; transaction: MarketplaceTransaction | null }) {
  const matches = (item: T | MarketplaceOffer | MarketplaceTransaction) => item.listingId === conversation.listingId && item.buyerId === conversation.buyerId && item.sellerId === conversation.sellerId;
  return { offers: state.offers.filter(matches), transaction: state.transaction && matches(state.transaction) ? state.transaction : null };
}

export function offerIsOpen(offer: MarketplaceOffer, now: number) {
  return now > 0 && ["submitted", "countered"].includes(offer.status) && Date.parse(offer.expiresAt) > now;
}

export function messageTime(value: string | null, now: number, compact = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value), today = new Date(now);
  if (compact && date.toDateString() !== today.toDateString()) {
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  }
  return date.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
}
