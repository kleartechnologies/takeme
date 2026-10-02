"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingSkeleton } from "@/components/ui/states";
import { getSimilarListings } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";

export function SimilarListings({ listing, discovery = false }: { listing: Listing; discovery?: boolean }) {
  const reference = useMemo(() => ({ id: listing.id, categoryId: listing.categoryId, price: listing.price, currentBid: listing.currentBid, startingBid: listing.startingBid, listingType: listing.listingType, condition: listing.condition, title: listing.title }), [listing.id, listing.categoryId, listing.price, listing.currentBid, listing.startingBid, listing.listingType, listing.condition, listing.title]);
  const [state, setState] = useState<{ listingId: string; items: Listing[]; sessionId: string | null; error: boolean }>({ listingId: "", items: [], sessionId: null, error: false });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getSimilarListings(reference).then((result) => { if (active) setState({ listingId: reference.id, items: result.listings, sessionId: result.sessionId, error: false }); }).catch(() => { if (active) setState({ listingId: reference.id, items: [], sessionId: null, error: true }); });
    return () => { active = false; };
  }, [reference, retry]);

  const loading = state.listingId !== listing.id;
  return <section className="py-9 md:py-12" aria-label="Similar items"><div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="section-title">Similar items</h2><p className="mt-2 text-sm text-stone-600">More active listings in this category with related details.</p></div><Link href={`/explore?category=${encodeURIComponent(listing.categoryId)}`} className="min-h-11 shrink-0 text-sm font-semibold text-[var(--takeme-dark-green)]">View all</Link></div>{loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} discovery={discovery} />)}</div> : state.error ? <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm"><p>Similar items could not be loaded.</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-3 min-h-11 px-5">Retry</button></div> : state.items.length ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{state.items.slice(0, 4).map((item) => <ListingCard key={item.id} listing={item} variant={discovery ? "discovery" : "default"} recommendationSource="similar" recommendationSessionId={state.sessionId} />)}</div> : <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-stone-600">No similar active items right now.</p>}</section>;
}
