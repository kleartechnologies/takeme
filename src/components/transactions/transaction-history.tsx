"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyTransactions } from "@/lib/services/transactions";
import type { MarketplaceTransaction } from "@/types/marketplace";

export function TransactionHistory({ uid, role }: { uid: string; role?: "buying" | "selling" }) {
  const [items, setItems] = useState<MarketplaceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getMyTransactions().then((transactions) => { if (active) { setItems(transactions); setLoading(false); } })
      .catch(() => { if (active) { setError("Transactions could not be loaded."); setLoading(false); } });
    return () => { active = false; };
  }, [uid, retry]);
  const visible = items.filter((item) => !role || (role === "buying" ? item.buyerId === uid : item.sellerId === uid));
  return <section className="mt-4"><h2 className="text-lg font-bold">{role === "buying" ? "Your purchases" : role === "selling" ? "Your sales" : "My transactions"}</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Standard deals require both parties to confirm. TAKEME does not process standard buyer-to-seller payments.</p>
    {loading ? <div className="mt-3 min-h-20 animate-pulse rounded-2xl bg-stone-100" /> : error ? <div role="alert" className="mt-3"><p className="text-sm text-red-700">{error}</p><button type="button" className="button-secondary mt-2 min-h-11 px-4" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Retry transactions</button></div> : visible.length ? <div className="mt-4 grid gap-2">{visible.map((item) => <Link key={item.id} href={`/transactions/${item.id}`} className="flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"><span className="min-w-0"><span className="block truncate font-semibold">{item.listingTitle}</span><span className="mt-1 block text-xs capitalize text-[var(--takeme-gray)]">{item.buyerId === uid ? "Buying" : "Selling"} · {item.type.replaceAll("_", " ")} · {item.settlementMode}</span></span><span className="shrink-0 text-right text-xs font-semibold capitalize text-[var(--takeme-dark-green)]">{item.status.replaceAll("_", " ")}<span className="mt-1 block text-lg">→</span></span></Link>)}</div> : <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-[var(--takeme-gray)]">No agreed transactions yet. Sending an offer or bidding does not create a completed transaction.</p>}
  </section>;
}
