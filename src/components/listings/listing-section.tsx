import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Listing } from "@/types/marketplace";
import { ListingCard } from "./listing-card";

export function ListingSection({ eyebrow, title, description, listings }: { eyebrow?: string; title: string; description?: string; listings: Listing[] }) {
  return (
    <section className="py-6 md:py-8">
      <div className="mb-5 flex items-end justify-between gap-4 md:mb-7">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{description}</p>}
        </div>
        <Link href={title === "Explore auctions" ? "/explore?type=auction" : "/explore"} className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--takeme-charcoal)] hover:text-[var(--takeme-dark-green)]">View all <ArrowRight size={16} /></Link>
      </div>
      <div className="consumer-grid">
        {listings.slice(0, 4).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      </div>
    </section>
  );
}
