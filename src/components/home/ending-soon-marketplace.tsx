"use client";

import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type PublicListing } from "@/lib/services/listings";

import { DiscoverySectionHeader } from "./discovery-section";

export function EndingSoonMarketplace() {
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    getActiveListings({ listingType: "auction", auctionStatus: "active", sort: "newest", pageSize: 24 })
      .then((page) => {
        if (!active) return;
        setListings(page.listings.filter((listing) => listing.auctionEndAt && Date.parse(listing.auctionEndAt) > Date.now())
          .sort((a, b) => Date.parse(a.auctionEndAt!) - Date.parse(b.auctionEndAt!)).slice(0, 4));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  if (!loaded || listings.length === 0) return null;
  return <section className="discovery-section" aria-labelledby="ending-soon-title">
    <DiscoverySectionHeader id="ending-soon-title" title="Ending Soon" subtitle="Grab deals before they're gone!" icon={Flame} href="/explore?type=auction&auction=active" />
    <div className="home-product-grid home-discovery-preview">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} variant="discovery" />)}</div>
  </section>;
}
