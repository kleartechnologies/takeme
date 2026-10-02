"use client";

import { Clock3, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { auctionTimeRemaining, discoveryPrice, listingAge } from "@/lib/listing-display";
import type { Listing } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function DiscoveryCardContent({ listing }: { listing: Listing }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  const auction = listing.listingType !== "buy_now";
  return <>
    <div className="discovery-price-row"><p className="discovery-price">{money.format(discoveryPrice(listing))}</p>{auction && <span className="discovery-bid-label">{(listing.bidCount ?? 0) > 0 ? "Current bid" : "Starting bid"}</span>}</div>
    <p className="discovery-product-title">{listing.title}</p>
    {!auction && <p className="discovery-meta">{listing.location && <><MapPin size={11} aria-hidden="true" /><span className="truncate">{listing.location}</span></>}{now !== null && <time dateTime={listing.createdAt}>{listing.location && <span aria-hidden="true"> · </span>}{listingAge(listing.createdAt, now)}</time>}</p>}
    {auction ? <p className="discovery-auction-time"><Clock3 size={12} aria-hidden="true" />{listing.auctionStatus === "active" ? listing.auctionEndAt && now !== null ? auctionTimeRemaining(listing.auctionEndAt, now) : "Live auction" : listing.auctionStatus === "scheduled" ? "Scheduled auction" : listing.auctionStatus === "cancelled" ? "Auction cancelled" : "Auction ended"}</p> : <span className="discovery-condition">{listing.condition}</span>}
  </>;
}
