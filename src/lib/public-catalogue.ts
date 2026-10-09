import { parseListingMedia } from "./listing-media.ts";
import type { Listing } from "../types/marketplace.ts";
import { parsePublicLocation, formatPublicLocation } from "./general-location.ts";

export type PublicCatalogueListing = Omit<Listing, "winnerId" | "currentBidderId">;
export type PublicCataloguePage = { listings: PublicCatalogueListing[]; cursor: string | null; hasMore: boolean };
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const record = (input: unknown): Record<string, unknown> | null => input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
const date = (input: unknown) => typeof input === "string" && Number.isFinite(Date.parse(input)) ? input : undefined;

/** Construct a fresh public DTO. Never spread an upstream object into HTML/JSON. */
export function parsePublicCatalogueListing(input: unknown): PublicCatalogueListing | null {
  const data = record(input);
  if (!data || typeof data.id !== "string" || !idPattern.test(data.id) || typeof data.sellerId !== "string" || !idPattern.test(data.sellerId)) return null;
  const area = parsePublicLocation(data.publicLocation);
  if (!area || !["active", "ended", "sold"].includes(String(data.status))
    || !["buy_now", "auction", "buy_now_and_auction"].includes(String(data.listingType))
    || !["New", "Like new", "Good", "Fair"].includes(String(data.condition))
    || typeof data.title !== "string" || !data.title.trim() || data.title.length > 200
    || typeof data.description !== "string" || data.description.length > 10000
    || typeof data.categoryId !== "string" || typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0
    || !date(data.createdAt) || !Array.isArray(data.imageUrls) || data.imageUrls.length > 10) return null;
  const imageUrls = data.imageUrls.filter((url): url is string => typeof url === "string" && url.length <= 4096);
  if (imageUrls.length !== data.imageUrls.length) return null;
  const listing: PublicCatalogueListing = {
    id: data.id, sellerId: data.sellerId, title: data.title, description: data.description,
    categoryId: data.categoryId, condition: data.condition as Listing["condition"], price: data.price,
    listingType: data.listingType as Listing["listingType"], status: data.status as Listing["status"],
    publicLocation: area, location: formatPublicLocation(area), imageUrls,
    mediaImages: parseListingMedia(data.mediaImages, data.sellerId),
    createdAt: date(data.createdAt)!, updatedAt: date(data.updatedAt) ?? date(data.createdAt)!,
  };
  for (const key of ["auctionStartAt", "auctionEndAt", "endedAt"] as const) {
    const value = date(data[key]); if (value) listing[key] = value;
  }
  for (const key of ["startingBid", "currentBid", "bidCount", "minimumBidIncrement", "finalBid"] as const) {
    const value = data[key]; if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) listing[key] = value;
  }
  if (["scheduled", "active", "ended", "cancelled"].includes(String(data.auctionStatus))) listing.auctionStatus = data.auctionStatus as Listing["auctionStatus"];
  const meetup = record(data.meetupLocation);
  const meetupArea = meetup && parsePublicLocation({ districtOrCity: meetup.area, state: meetup.state, country: meetup.country });
  if (meetup && meetupArea && typeof meetup.name === "string" && meetup.name.trim().length >= 2 && meetup.name.length <= 80) {
    listing.meetupLocation = { name: meetup.name.trim(), area: meetupArea.districtOrCity, state: meetupArea.state, country: "Malaysia" };
  }
  return listing;
}

export function parsePublicCataloguePage(input: unknown, pageSize = 8): PublicCataloguePage | null {
  const data = record(input);
  if (!data || !Array.isArray(data.listings) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50 || data.listings.length > pageSize) return null;
  const listings = data.listings.map(parsePublicCatalogueListing);
  if (listings.some(listing => !listing || listing.status !== "active")) return null;
  if (data.cursor != null && (typeof data.cursor !== "string" || !idPattern.test(data.cursor))) return null;
  return { listings: listings as PublicCatalogueListing[], cursor: typeof data.cursor === "string" ? data.cursor : null, hasMore: data.hasMore === true };
}

export type PublicCatalogueBid = { amount: number; createdAt: string; isOwnBid: boolean };
export function parseAnonymousBids(input: unknown): PublicCatalogueBid[] {
  if (!Array.isArray(input) || input.length > 25) return [];
  return input.flatMap(item => {
    const bid = record(item);
    if (!bid || typeof bid.amount !== "number" || !Number.isSafeInteger(bid.amount) || bid.amount <= 0 || !date(bid.createdAt)) return [];
    return [{ amount: bid.amount, createdAt: date(bid.createdAt)!, isOwnBid: false }];
  });
}
