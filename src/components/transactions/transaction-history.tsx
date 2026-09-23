"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyTransactions } from "@/lib/services/transactions";
import type { MarketplaceTransaction } from "@/types/marketplace";

export function TransactionHistory({ uid }: { uid: string }) {
  const [items, setItems] = useState<MarketplaceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getMyTransactions().then((transactions) => { if (active) { setItems(transactions); setLoading(false); } })
      .catch(() => { if (active) { setError("Transactions could not be loaded."); setLoading(false); } });
    return () => { active = false; };
  }, [uid]);
  return <section className="mt-8"><h2 className="text-xl font-bold">My transactions</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Standard deals require both parties to confirm. Protected deals require verified settlement events.</p>
    {loading ? <div className="mt-3 min-h-20 animate-pulse rounded-2xl bg-stone-100" /> : error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : items.length ? <div className="mt-4 grid gap-2">{items.map((item) => <Link key={item.id} href={`/transactions/${item.id}`} className="flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"><span className="min-w-0"><span className="block truncate font-semibold">{item.listingTitle}</span><span className="mt-1 block text-xs capitalize text-[var(--takeme-gray)]">{item.buyerId === uid ? "Buying" : "Selling"} · {item.type.replaceAll("_", " ")} · {item.settlementMode}</span></span><span className="shrink-0 text-right text-xs font-semibold capitalize text-[var(--takeme-dark-green)]">{item.status.replaceAll("_", " ")}<span className="mt-1 block text-lg">→</span></span></Link>)}</div> : <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-[var(--takeme-gray)]">No agreed transactions yet. Sending an offer or bidding does not create a completed transaction.</p>}
  </section>;
}
