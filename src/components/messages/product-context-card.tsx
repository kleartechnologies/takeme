"use client";

import { listingImage } from "@/lib/listing-media";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { discoveryPrice } from "@/lib/listing-display";
import { auctionBidLabel } from "@/lib/auction-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import type { PublicListing } from "@/lib/services/listings";
import styles from "./messaging.module.css";

export const money = (amount: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(amount);
export function ProductContextCard({ listing, listingId, title, image, link = true }: { listing: PublicListing | null; listingId: string; title: string; image?: string | null; link?: boolean }) {
  const now = useCurrentTime(60_000);
  const auction = listing?.listingType === "auction";
  const state = !listing ? "Listing details unavailable" : auction ? `Auction ${listing.auctionStatus ?? "unavailable"}` : ({ active: "Available", draft: "Draft", ended: "Unavailable", sold: "Sold", removed: "Removed" })[listing.status];
  const priceLabel = auction ? auctionBidLabel(listing, now) : listing?.status !== "active" ? "Listed price" : "";
  const price = listing ? auction && listing.auctionStatus === "ended" && listing.finalBid != null ? listing.finalBid / 100 : discoveryPrice(listing) : null;
  return <div className={styles.productCard}>
    <span className={styles.productImage}>{(listing ? listingImage(listing, "thumbnail") : image) ? <Image src={(listing ? listingImage(listing, "thumbnail") : image)!} alt="" fill sizes="72px" className="object-cover" /> : <ImageIcon size={24} />}</span>
    <div className={styles.productText}><strong>{listing?.title ?? title}</strong><span>{listing ? `${listing.condition} · ${state}` : state}</span>{price !== null && <b>{priceLabel && <small>{priceLabel} </small>}{money(price)}</b>}</div>
    {link && <Link className={styles.viewItem} href={`/listings/${listingId}`}>{auction ? "View Auction" : "View Item"}</Link>}
  </div>;
}
