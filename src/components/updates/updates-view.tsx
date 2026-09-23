"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Megaphone, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getMyTransactions } from "@/lib/services/transactions";
import type { MarketplaceTransaction } from "@/types/marketplace";

type Tab = "all" | "action" | "activity" | "promos" | "support";
const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" }, { id: "action", label: "For Action" }, { id: "activity", label: "Activity" }, { id: "promos", label: "Promos" }, { id: "support", label: "Support" },
];
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

export function UpdatesView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<MarketplaceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getMyTransactions().then((transactions) => { if (active) { setItems(transactions); setError(""); setLoading(false); } })
      .catch(() => { if (active) { setError("Updates could not be loaded. Please try again."); setLoading(false); } });
    return () => { active = false; };
  }, [retry, user]);

  const shown = useMemo(() => tab === "action" ? items.filter((item) => item.status === "in_progress" || item.status === "disputed") : tab === "activity" ? items.filter((item) => item.status === "completed" || item.status === "cancelled") : tab === "all" ? items : [], [items, tab]);

  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <RowsSkeleton />;
  if (!user) return <SignInRequired message="Log in to see transaction updates and items that need your attention." />;

  return <div>
    <div className="banner-track -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Update groups">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === item.id ? "bg-[var(--takeme-dark-green)] text-white" : "border border-gray-200 bg-white text-[var(--takeme-gray)]"}`}>{item.label}{item.id === "action" && items.some((entry) => entry.status === "in_progress" || entry.status === "disputed") ? ` (${items.filter((entry) => entry.status === "in_progress" || entry.status === "disputed").length})` : ""}</button>)}</div>
    <section className="mt-5" role="tabpanel">
      {error ? <div><ErrorState message={error} /><button type="button" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }} className="button-secondary mt-4 h-11 px-5"><LoaderCircle size={16} /> Try again</button></div>
        : loading ? <RowsSkeleton />
        : tab === "promos" ? <HonestState icon={<Megaphone size={25} />} title="No promotion updates" description="TAKEME does not yet provide a global promotion notification feed. Your active listing promotions remain available from Me." actionHref="/profile#selling" actionLabel="Manage listings" />
        : tab === "support" ? <HonestState icon={<ShieldQuestion size={25} />} title="No support updates" description="Support and security announcements are not connected to an inbox yet. Nothing is being hidden here." />
        : shown.length ? <div className="grid gap-3">{shown.map((item) => <TransactionUpdate key={item.id} item={item} uid={user.uid} />)}</div>
        : <EmptyState title={tab === "action" ? "Nothing needs your attention" : tab === "activity" ? "No recent transaction activity" : "You’re all caught up"} description={tab === "action" ? "Transactions that need confirmation or dispute follow-up will appear here." : tab === "activity" ? "Completed and cancelled transactions will appear here." : "Real transaction updates will appear here as your marketplace activity grows."} />}
    </section>
  </div>;
}

function TransactionUpdate({ item, uid }: { item: MarketplaceTransaction; uid: string }) {
  const actionable = item.status === "in_progress" || item.status === "disputed";
  const title = item.status === "in_progress" ? "Transaction ready for your next step" : item.status === "disputed" ? "Transaction needs attention" : item.status === "completed" ? "Transaction completed" : "Transaction cancelled";
  return <Link href={`/transactions/${item.id}`} className="flex min-h-24 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--takeme-shadow-sm)] transition hover:border-[var(--takeme-green)]"><span className={`grid size-11 shrink-0 place-items-center rounded-full ${actionable ? "bg-amber-50 text-amber-700" : "bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"}`}>{actionable ? <CircleAlert size={21} /> : <CheckCircle2 size={21} />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block truncate text-sm text-[var(--takeme-gray)]">{item.listingTitle}</span><span className="mt-2 block text-xs text-[var(--takeme-gray)]">{item.buyerId === uid ? "Buying" : "Selling"} · {money.format(item.amountSen / 100)} · {new Date(item.updatedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</span></span><span className="mt-2 shrink-0 text-lg text-[var(--takeme-dark-green)]" aria-hidden="true">→</span></Link>;
}

function HonestState({ icon, title, description, actionHref, actionLabel }: { icon: React.ReactNode; title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-gray-300 bg-white p-7 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]">{icon}</span><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--takeme-gray)]">{description}</p>{actionHref && actionLabel && <Link href={actionHref} className="button-secondary mt-5 h-11 px-5">{actionLabel}</Link>}</div></div>;
}

function RowsSkeleton() { return <div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}</div>; }
