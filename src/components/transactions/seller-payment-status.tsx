"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getSellerPaymentOnboarding } from "@/lib/services/transactions";
import type { SellerPaymentOnboarding } from "@/types/marketplace";

export function SellerPaymentStatus() {
  const [state, setState] = useState<{ loading: boolean; profile: SellerPaymentOnboarding | null }>({ loading: true, profile: null });
  useEffect(() => {
    let active = true;
    getSellerPaymentOnboarding().then((profile) => { if (active) setState({ loading: false, profile }); })
      .catch(() => { if (active) setState({ loading: false, profile: null }); });
    return () => { active = false; };
  }, []);
  if (state.loading) return <div className="mt-7 min-h-28 animate-pulse rounded-2xl bg-stone-100" />;
  return <section className="mt-7 rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)]" aria-label="Protected transaction seller status">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><ShieldCheck size={22} /></span><div className="min-w-0"><h2 className="text-lg font-bold">Protected transaction eligibility</h2><p className="mt-1 text-sm leading-6 text-[var(--takeme-gray)]">Protected payments are not enabled yet. Stripe Connect onboarding, charges and payouts cannot be started from TAKEME.</p></div></div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><Status label="Onboarding" value={state.profile?.status.replaceAll("_", " ") ?? "Unavailable"} /><Status label="Charges" value={state.profile?.enabled && state.profile.chargesEnabled ? "Enabled" : "Not enabled"} /><Status label="Payouts" value={state.profile?.enabled && state.profile.payoutsEnabled ? "Enabled" : "Not enabled"} /></div>
    <p className="mt-3 text-xs leading-5 text-[var(--takeme-gray)]">Final eligibility, fees, payout timing and protection terms require provider, product and legal approval.</p>
  </section>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <p className="rounded-xl bg-stone-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-stone-500">{label}</span><strong className="mt-1 block capitalize">{value}</strong></p>;
}
