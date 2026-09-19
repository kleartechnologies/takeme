"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingSkeleton } from "@/components/ui/states";
import { getSimilarListings, trackMarketplaceIntent } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";

export function SimilarListings({ listing }: { listing: Listing }) {
  const reference = useMemo(() => ({ id: listing.id, categoryId: listing.categoryId, price: listing.price, currentBid: listing.currentBid, startingBid: listing.startingBid, listingType: listing.listingType, condition: listing.condition, title: listing.title }), [listing.id, listing.categoryId, listing.price, listing.currentBid, listing.startingBid, listing.listingType, listing.condition, listing.title]);
  const { user } = useAuth();
  const [state, setState] = useState<{ listingId: string; items: Listing[]; error: boolean }>({ listingId: "", items: [], error: false });
  const [retry, setRetry] = useState(0);
  const impressionKey = useRef("");
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    getSimilarListings(reference).then((items) => { if (active) setState({ listingId: reference.id, items, error: false }); }).catch(() => { if (active) setState({ listingId: reference.id, items: [], error: true }); });
    return () => { active = false; };
  }, [reference, retry]);

  useEffect(() => {
    if (!user || state.listingId !== listing.id || !state.items.length || impressionKey.current === listing.id || !section.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || impressionKey.current === listing.id) return;
      impressionKey.current = listing.id;
      trackMarketplaceIntent({ type: "RECOMMENDATION_IMPRESSION", listingIds: state.items.slice(0, 4).map((item) => item.id), context: "detail", candidateSource: "similar" });
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [listing.id, state, user]);

  const loading = state.listingId !== listing.id;
  return <section ref={section} className="py-9 md:py-12" aria-label="Similar items"><div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="section-title">Similar items</h2><p className="mt-2 text-sm text-stone-600">More active listings in this category with related details.</p></div><Link href={`/explore?category=${encodeURIComponent(listing.categoryId)}`} className="min-h-11 shrink-0 text-sm font-semibold text-[var(--takeme-dark-green)]">View all</Link></div>{loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div> : state.error ? <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm"><p>Similar items could not be loaded.</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-3 min-h-11 px-5">Retry</button></div> : state.items.length ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{state.items.slice(0, 4).map((item) => <ListingCard key={item.id} listing={item} recommendationSource="similar" recommendationContext="detail" />)}</div> : <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-stone-600">No similar active items right now.</p>}</section>;
}
