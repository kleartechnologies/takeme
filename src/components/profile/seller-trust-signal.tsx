"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTrustSummary } from "@/lib/services/trust";
import type { RoleReputation } from "@/types/marketplace";

export function SellerTrustSignal({ uid }: { uid: string }) {
  const [seller, setSeller] = useState<RoleReputation | null>(null);
  useEffect(() => {
    let active = true;
    getTrustSummary(uid).then((summary) => { if (active) setSeller(summary?.seller ?? null); }).catch(() => undefined);
    return () => { active = false; };
  }, [uid]);
  if (!seller?.completedCount) return null;
  return <div className="mt-3 flex items-center gap-2 text-xs text-[var(--takeme-gray)]">
    {seller.tier && <Image src={`/brand/tiers/${seller.tier}.png`} alt={`${seller.tier} seller tier`} width={80} height={32} className="h-8 w-auto max-w-20 object-contain" />}
    <span>{seller.reviewCount ? `${seller.averageRating?.toFixed(1) ?? "—"} ★ · ` : ""}{seller.completedCount} completed sales</span>
  </div>;
}
