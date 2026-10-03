import type { Metadata } from "next";
import { formatPublicLocation, type PublicLocation } from "./general-location.ts";
import { isStagingMediaUrl, isStagingSiteUrl } from "./firebase/staging-isolation.ts";

export type PublicListingMetadata = {
  status: string;
  title: string;
  description: string;
  publicLocation?: PublicLocation;
  price?: number;
  listingType?: string;
  startingBid?: number;
  currentBid?: number;
  bidCount?: number;
  imageUrls?: string[];
};

const publicStatuses = new Set(["active", "ended", "sold"]);
const money = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 });

export function listingCanonicalUrl(id: string, siteUrl: string) {
  return new URL(`/listings/${encodeURIComponent(id)}`, siteUrl).toString();
}

function previewImage(listing: PublicListingMetadata, siteUrl: string) {
  const image = listing.imageUrls?.find((value) => {
    if (isStagingSiteUrl(siteUrl)) return isStagingMediaUrl(value);
    try { return new URL(value).protocol === "https:"; }
    catch { return false; }
  });
  return image ?? new URL("/brand/takeme-app-icon.png", siteUrl).toString();
}

export function buildListingMetadata(id: string, listing: PublicListingMetadata | null, siteUrl: string): Metadata {
  const canonical = listingCanonicalUrl(id, siteUrl);
  if (!listing || !publicStatuses.has(listing.status) || !listing.title?.trim()) {
    return {
      title: { absolute: "Listing unavailable | TAKEME" },
      description: "This TAKEME listing is unavailable.",
      alternates: { canonical },
      robots: { index: false, follow: false },
      openGraph: { title: "Listing unavailable | TAKEME", description: "This TAKEME listing is unavailable.", url: canonical, type: "website", images: [previewImage({ status: "", title: "", description: "" }, siteUrl)] },
      twitter: { card: "summary_large_image", title: "Listing unavailable | TAKEME", description: "This TAKEME listing is unavailable.", images: [previewImage({ status: "", title: "", description: "" }, siteUrl)] },
    };
  }

  const auction = listing.listingType === "auction" || listing.listingType === "buy_now_and_auction";
  const rawAmount = auction ? ((listing.bidCount ?? 0) > 0 ? listing.currentBid : listing.startingBid) : listing.price;
  const amount = typeof rawAmount === "number" ? (auction ? rawAmount / 100 : rawAmount) : null;
  const price = amount !== null && Number.isFinite(amount) && amount >= 0 ? `RM${money.format(amount)}` : null;
  const title = `${listing.title.trim().slice(0, 100)}${price ? ` — ${price}` : ""} | TAKEME`;
  const area = listing.publicLocation ? formatPublicLocation(listing.publicLocation) : "Malaysia";
  // Seller-authored descriptions may contain personal contact details. Never
  // reuse them in server-generated social previews.
  const description = `${price ? `${price} · ` : ""}${area} · View this listing on TAKEME.`;
  const image = previewImage(listing, siteUrl);
  return {
    title: { absolute: title },
    description,
    ...(isStagingSiteUrl(siteUrl) ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", images: [{ url: image, alt: listing.title.trim() }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
