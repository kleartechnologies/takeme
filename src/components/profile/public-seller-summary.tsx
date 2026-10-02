"use client";

import { BadgeCheck, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { completedSalesLabel, sellerRatingLabel } from "@/lib/public-seller-presentation";
import { clearPublicSellerSummaryCache, getPublicSellerSummary } from "@/lib/services/public-sellers";
import type { PublicSellerSummary as SellerSummary } from "@/types/marketplace";

export function PublicSellerSummary({ uid, variant }: { uid: string; variant: "card" | "detail" }) {
  const [state, setState] = useState<{ uid: string; seller: SellerSummary | null }>({ uid: "", seller: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getPublicSellerSummary(uid).then((seller) => { if (active) setState({ uid, seller }); });
    return () => { active = false; };
  }, [uid, retry]);

  if (state.uid !== uid) return variant === "card"
    ? <div aria-hidden="true" className="mt-2 min-h-10 animate-pulse rounded-lg bg-stone-100" />
    : <div aria-hidden="true" className="mt-5 min-h-28 animate-pulse rounded-2xl bg-stone-100" />;
  if (!state.seller) return variant === "card" ? <div className="min-h-10" /> : <div className="mt-5"><p className="text-sm text-[var(--takeme-gray)]">Seller trust is unavailable right now.</p><button type="button" className="button-secondary mt-2 min-h-11 px-4" onClick={() => { clearPublicSellerSummaryCache(); setState({ uid: "", seller: null }); setRetry((value) => value + 1); }}>Retry</button></div>;
  return variant === "card" ? <CardSeller seller={state.seller} /> : <DetailSeller seller={state.seller} />;
}

function TierBadge({ seller, compact = false }: { seller: SellerSummary; compact?: boolean }) {
  if (!seller.sellerTier) return null;
  return <Image src={`/brand/tiers/${seller.sellerTier}.png`} alt={`${seller.sellerTier} seller tier`} width={compact ? 56 : 96} height={compact ? 23 : 38} className={`${compact ? "h-[18px] max-w-14" : "h-7 max-w-20 sm:h-9 sm:max-w-24"} w-auto shrink-0 object-contain`} />;
}

function CardSeller({ seller }: { seller: SellerSummary }) {
  return <div className="mt-2 min-h-10 pt-1" aria-label={`Seller ${seller.displayName}, ${sellerRatingLabel(seller)}, ${completedSalesLabel(seller.sellerCompletedTransactionCount)}${seller.sellerTier ? `, ${seller.sellerTier} tier` : ""}`}>
    <div className="flex min-w-0 items-center justify-between gap-1.5"><span className="truncate text-[10px] font-semibold text-stone-700 sm:text-xs">{seller.displayName}</span><TierBadge seller={seller} compact /></div>
    <p className="mt-0.5 truncate text-[9px] text-[var(--takeme-gray)] sm:text-[11px]">{sellerRatingLabel(seller)} · {completedSalesLabel(seller.sellerCompletedTransactionCount)}</p>
  </div>;
}

function DetailSeller({ seller }: { seller: SellerSummary }) {
  return <section className="mt-5 min-w-0 max-w-full overflow-hidden border-y border-gray-100 bg-white py-3" aria-label="Seller trust summary">
    <Link href={`/sellers/${seller.uid}`} className="flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--takeme-dark-green)] sm:gap-3">
      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white">{seller.photoURL ? <Image src={seller.photoURL} alt="" fill sizes="48px" className="object-cover" /> : <UserRound size={21} />}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-sm font-bold">{seller.displayName}</span>{seller.verificationStatus === "verified" && <BadgeCheck size={16} aria-label="Verified seller" className="shrink-0 text-[var(--takeme-dark-green)]" />}</span><span className="mt-0.5 block text-xs text-stone-500">View seller profile</span></span>
      <TierBadge seller={seller} />
    </Link>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-stone-700"><span>{sellerRatingLabel(seller)}</span><span>{completedSalesLabel(seller.sellerCompletedTransactionCount)} completed</span></div>
    <p className="mt-2 break-words text-[11px] leading-4 text-[var(--takeme-gray)]">Seller reputation uses completed sales and published buyer reviews. Buyer reputation is tracked separately.</p>
    <Link href="/help/tiers" className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-[var(--takeme-dark-green)] underline underline-offset-4">How seller tiers work</Link>
  </section>;
}
