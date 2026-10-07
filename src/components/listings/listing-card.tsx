"use client";

import { Clock3, MapPin, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { Listing } from "@/types/marketplace";
import { SaveButton } from "@/components/saved/save-button";
import { PublicSellerSummary } from "@/components/profile/public-seller-summary";
import { DiscoveryCardContent } from "./discovery-card-content";
import { trackMarketplaceIntent, type CandidateSource } from "@/lib/services/intelligence";
import { trackPromotionIntent, type PromotionBadge } from "@/lib/services/promotions";
import { auctionBidLabel } from "@/lib/auction-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import { listingCardPrice } from "@/lib/listing-display";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function auctionLabel(listing: Listing) {
  if (listing.auctionStatus === "scheduled") return "Scheduled auction";
  if (listing.auctionStatus === "ended") return "Auction ended";
  if (listing.auctionStatus === "cancelled") return "Auction cancelled";
  return "Live auction";
}

export function ListingCard({ listing, sizes = "(max-width: 380px) 100vw, (max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw", priority = false, initialSaved, onSavedChange, recommendationSource, recommendationSessionId, promotion, promotionContext = "explore", variant = "default" }: { listing: Listing; sizes?: string; priority?: boolean; initialSaved?: boolean; onSavedChange?: (saved: boolean) => void; recommendationSource?: CandidateSource; recommendationSessionId?: string | null; promotion?: PromotionBadge; promotionContext?: "home" | "explore"; variant?: "default" | "discovery" }) {
  const { user } = useAuth();
  const now = useCurrentTime(60_000);
  const card = useRef<HTMLElement>(null);
  const impression = useRef("");
  const recommendationImpression = useRef("");
  const isAuction = listing.listingType === "auction" || listing.listingType === "buy_now_and_auction";
  const price = listingCardPrice(listing);
  useEffect(() => {
    if (!promotion || !user || impression.current === promotion.promotionId || !card.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || impression.current === promotion.promotionId) return;
      impression.current = promotion.promotionId;
      trackPromotionIntent("PROMOTION_IMPRESSION", promotion, listing.id, promotionContext);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [listing.id, promotion, promotionContext, user]);
  useEffect(() => {
    if (!recommendationSessionId || !user || !card.current || typeof IntersectionObserver === "undefined") return;
    const key = `${recommendationSessionId}:${listing.id}`;
    if (recommendationImpression.current === key) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || recommendationImpression.current === key) return;
      recommendationImpression.current = key;
      trackMarketplaceIntent({ type: "RECOMMENDATION_IMPRESSION", listingIds: [listing.id], sessionId: recommendationSessionId });
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [listing.id, recommendationSessionId, user]);
  const recordClick = () => {
    if (recommendationSource && recommendationSessionId) trackMarketplaceIntent({ type: "RECOMMENDATION_CLICK", listingId: listing.id, sessionId: recommendationSessionId });
    if (promotion) trackPromotionIntent("PROMOTION_CLICK", promotion, listing.id, promotionContext);
  };
  return (
    <article ref={card} className={`${variant === "discovery" ? "discovery-product " : ""}group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--takeme-border)] bg-white shadow-[var(--takeme-shadow-sm)] transition hover:border-[var(--takeme-green)] hover:shadow-[var(--takeme-shadow-md)]`}>
      <div className={`${variant === "discovery" ? "discovery-product-image " : ""}relative aspect-[4/3] overflow-hidden bg-stone-100`}>
        <Link href={`/listings/${listing.id}`} onClick={recordClick} aria-label={`View ${listing.title}`} className="relative block h-full w-full">
          {listing.imageUrls[0] && <Image src={listing.imageUrls[0]} alt={listing.title} fill sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className="object-cover transition duration-500 group-hover:scale-[1.04]" />}
        </Link>
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">
          {(isAuction || variant !== "discovery") && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm sm:text-xs ${isAuction ? "bg-orange-700 text-white" : "bg-white/95 text-[var(--takeme-dark-green)]"}`}>{isAuction ? auctionLabel(listing) : listing.condition}</span>}
          {promotion && <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/95 px-2 py-1 text-[9px] font-semibold text-[var(--takeme-dark-green)] sm:text-[11px]">{promotion.type === "featured" ? <Star size={11} /> : <Sparkles size={11} />}{promotion.type === "featured" ? "Featured · paid" : "Boosted · paid"}</span>}
        </div>
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3"><SaveButton listingId={listing.id} listing={listing} allowTerminalRemoval initialSaved={initialSaved} onChange={onSavedChange} compact /></div>
      </div>
      <Link href={`/listings/${listing.id}`} onClick={recordClick} className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        {variant === "discovery" ? <DiscoveryCardContent listing={listing} /> : <>
        <p className="line-clamp-2 text-sm font-semibold leading-5 tracking-[-0.02em] text-[var(--takeme-charcoal)] sm:text-base">{listing.title}</p>
        <p className="mt-1 text-lg font-bold leading-6 tracking-tight text-[var(--takeme-dark-green)] sm:text-xl">{price === null ? (listing.bidCount ?? 0) === 0 ? "No bids" : "—" : money.format(price)}</p>
        {isAuction && <p className="mt-0.5 text-[11px] font-medium text-[var(--takeme-dark-green)] sm:text-xs">{auctionBidLabel(listing, now)} · {listing.bidCount ?? 0} {(listing.bidCount ?? 0) === 1 ? "bid" : "bids"}</p>}
        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--takeme-gray)]">
          <span className="flex min-w-0 items-center gap-1"><MapPin size={13} className="shrink-0" /><span className="truncate">{listing.location}</span></span>
        </div>
        <PublicSellerSummary uid={listing.sellerId} variant="card" />
        {isAuction && listing.auctionStatus !== "cancelled" && <p className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-3 text-[11px] font-semibold text-stone-600 sm:text-xs"><Clock3 size={13} /> {listing.auctionStatus === "scheduled" ? "Starts" : listing.auctionStatus === "ended" ? "Ended" : "Ends"} {listing.auctionEndAt ? new Date(listing.auctionStatus === "scheduled" ? listing.auctionStartAt! : listing.auctionEndAt).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "soon"}</p>}
        </>}
      </Link>
    </article>
  );
}
