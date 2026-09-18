"use client";

import { Clock3, Heart, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });

export function ListingCard({ listing }: { listing: Listing }) {
  const isAuction = listing.listingType === "auction";
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[var(--takeme-shadow-sm)] transition duration-300 hover:-translate-y-1 hover:border-[var(--takeme-green)] hover:shadow-[var(--takeme-shadow-md)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <Link href={`/listings/${listing.id}`} aria-label={`View ${listing.title}`} className="relative block h-full w-full">
          <Image src={listing.imageUrls[0]} alt={listing.title} fill loading="eager" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
        </Link>
        <div className="absolute left-3 top-3 flex gap-2">
          {listing.featured && <span className="rounded-full bg-stone-950 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Featured</span>}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${isAuction ? "bg-[var(--takeme-dark-green)] text-white" : "bg-white/95 text-[var(--takeme-charcoal)]"}`}>{isAuction ? "Auction" : "Buy now"}</span>
        </div>
        <button disabled className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/95 text-stone-400 shadow-sm" aria-label="Favorites coming soon" title="Favorites coming soon">
          <Heart size={18} />
        </button>
      </div>
      <Link href={`/listings/${listing.id}`} className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-10 font-semibold leading-5 tracking-[-0.01em] text-[var(--takeme-charcoal)]">{listing.title}</p>
        <p className="mt-2 text-lg font-bold tracking-tight text-[var(--takeme-charcoal)]">{isAuction ? money.format(listing.currentBid ?? listing.price) : money.format(listing.price)}</p>
        {isAuction && <p className="mt-0.5 text-xs font-medium text-[var(--takeme-dark-green)]">Current bid · {listing.bidCount} bids</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-[var(--takeme-gray)]">
          <span className="flex min-w-0 items-center gap-1"><MapPin size={13} className="shrink-0" /><span className="truncate">{listing.location}</span></span>
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1">{listing.condition}</span>
        </div>
        {isAuction && <p className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-3 text-xs font-semibold text-stone-600"><Clock3 size={13} /> Ends soon</p>}
      </Link>
    </article>
  );
}
