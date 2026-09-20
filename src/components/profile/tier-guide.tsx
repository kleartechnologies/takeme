"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getReputationPolicy, type ReputationPolicy } from "@/lib/services/transactions";
import type { ReputationTier } from "@/types/marketplace";

const order: ReputationTier[] = ["bronze", "silver", "gold", "platinum"];

export function TierGuide() {
  const [policy, setPolicy] = useState<ReputationPolicy | null>(null);
  useEffect(() => { let active = true; getReputationPolicy().then((value) => { if (active) setPolicy(value); }).catch(() => undefined); return () => { active = false; }; }, []);
  return <div className="mt-5 space-y-5 text-sm leading-7 text-[var(--takeme-gray)]">
    <p>Buyer and Seller tiers are separate. They are earned through legitimate transactions that both parties confirm after the exchange. An accepted offer or winning bid alone does not count.</p>
    <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-bold text-[var(--takeme-charcoal)]">Current completed-transaction thresholds</h2>
      {!policy ? <p className="mt-3">Tier thresholds are temporarily unavailable.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{order.map((tier) => <div key={tier} className="flex min-h-16 items-center gap-3 rounded-xl bg-stone-50 p-3"><Image src={`/brand/tiers/${tier}.png`} alt="" width={90} height={36} className="h-9 w-auto max-w-22 object-contain" /><span className="font-semibold capitalize text-[var(--takeme-charcoal)]">{tier}: {policy.thresholds[tier]}+</span></div>)}</div>}
    </section>
    <p>Reviews contribute to a separate role-specific rating. They become public only after both sides submit or the review window ends. Reviews are not editable after submission. Tiers currently use completed-transaction counts only; no hidden rating or review minimum applies.</p>
    <p>Tiers cannot be bought. Boost and Featured change visibility, not reputation. Account verification also does not grant a tier. Fake transactions and review manipulation are prohibited.</p>
    <p>Requirements may evolve. A tier is a marketplace trust signal, not a guarantee that a future transaction will succeed. TAKEME does not currently process buyer-to-seller payments; an agreed payment method is not proof of payment.</p>
  </div>;
}
