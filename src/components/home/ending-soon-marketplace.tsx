"use client";

import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type PublicListing } from "@/lib/services/listings";

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
  return <section className="py-5" aria-labelledby="ending-soon-title">
    <div className="mb-4 flex items-end justify-between gap-3"><div><h2 id="ending-soon-title" className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl"><Flame className="text-orange-600" size={22} /> Ending Soon</h2><p className="mt-1 text-xs text-[var(--takeme-gray)] sm:text-sm">Active auctions with the nearest end times in this set.</p></div><Link href="/explore?type=auction&auction=active" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--takeme-dark-green)] sm:text-sm">See all <ArrowRight size={15} /></Link></div>
    <div className="marketplace-rail">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
  </section>;
}
