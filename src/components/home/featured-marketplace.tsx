"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { getFeaturedPromotions, type PromotionType } from "@/lib/services/promotions";
import type { Listing } from "@/types/marketplace";

export function FeaturedMarketplace() {
  const [items, setItems] = useState<{ listing: Listing; promotionId: string; type: PromotionType }[]>([]);
  useEffect(() => {
    let active = true;
    getFeaturedPromotions().then((result) => { if (active) setItems(result); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section className="border-t border-gray-200 py-7" aria-label="Featured listings"><div className="mb-4"><h2 className="flex items-center gap-2 text-xl font-bold"><Star size={21} className="text-[var(--takeme-dark-green)]" /> Featured listings</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Paid premium placement. These listings are not trust or reputation badges.</p></div><div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{items.map((item) => <ListingCard key={item.listing.id} listing={item.listing} promotion={{ promotionId: item.promotionId, type: item.type }} promotionContext="home" />)}</div></section>;
}
