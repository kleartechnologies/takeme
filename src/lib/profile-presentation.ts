import type { Listing, PublicReview } from "../types/marketplace";

export type ListingGroup = "active" | "sold" | "drafts" | "past";
export const auctionListing = (listing: Listing) => listing.listingType !== "buy_now";
export function listingGroup(listing: Listing): ListingGroup {
  if (listing.status === "draft") return "drafts";
  if (listing.status === "sold") return "sold";
  if (listing.status === "active" && !["ended", "cancelled"].includes(listing.auctionStatus ?? "")) return "active";
  return "past";
}
export function listingActions(listing: Listing, now: number) {
  const auction = auctionListing(listing);
  const resumableDraft = auction && listing.status === "draft" && listing.auctionStatus === "scheduled" && (listing.bidCount ?? 0) === 0;
  const editable = resumableDraft || listing.status === "active" && (!auction || (listing.auctionStatus === "scheduled" && (listing.bidCount ?? 0) === 0 && Boolean(listing.auctionStartAt && now < Date.parse(listing.auctionStartAt))));
  const removable = listing.status === "active" && (!auction || ((listing.bidCount ?? 0) === 0 && !["ended", "cancelled"].includes(listing.auctionStatus ?? "")));
  const promotable = listing.status === "active" && (!auction || (["active", "scheduled"].includes(listing.auctionStatus ?? "") && Boolean(listing.auctionEndAt && now < Date.parse(listing.auctionEndAt))));
  return { resumableDraft, editable, removable, promotable };
}
export function managementStatus(listing: Listing) {
  if (listing.status === "draft") return "Draft";
  if (listing.status === "removed") return "Removed";
  if (listing.status === "sold") return "Sold";
  if (!auctionListing(listing)) return listing.status === "active" ? "Active" : "Ended";
  return ({ scheduled: "Scheduled", active: "Live auction", ended: "Ended", cancelled: "Cancelled" } as const)[listing.auctionStatus ?? "ended"];
}
/** Public distribution covers only the bounded review page, never private trust documents. */
export function reviewDistribution(reviews: PublicReview[]) {
  return [5, 4, 3, 2, 1].map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length }));
}
