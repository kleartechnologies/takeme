"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { deleteSavedSearch, getSavedSearches, saveSearch, type Frequency, type SavedSearch } from "@/lib/services/engagement";

function searchHref(item: SavedSearch) {
  const query = new URLSearchParams();
  const c = item.criteria;
  for (const [key, value] of Object.entries({ q: c.query, category: c.category, condition: c.condition, type: c.type, auction: c.auction, price: c.price ?? "", location: c.location, sort: c.sort })) if (value) query.set(key, String(value));
  return `/explore?${query}`;
}

export function SavedSearchesView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { if (!user) return; let active = true; getSavedSearches().then((data) => { if (active) { setItems(data.items); setLoading(false); setError(""); } }).catch(() => { if (active) { setLoading(false); setError("Saved searches could not be loaded."); } }); return () => { active = false; }; }, [user, retry]);
  async function change(item: SavedSearch, patch: { frequency?: Frequency; active?: boolean }) {
    setBusy(item.id); setError("");
    try { await saveSearch(item.criteria, patch.frequency ?? item.frequency, item.id, patch.active ?? item.active); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry)); }
    catch { setError("Search could not be updated. Please try again."); }
    finally { setBusy(""); }
  }
  async function remove(item: SavedSearch) {
    if (!window.confirm("Delete this saved search?")) return;
    setBusy(item.id); setError("");
    try { await deleteSavedSearch(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
    catch { setError("Search could not be deleted. Please try again."); }
    finally { setBusy(""); }
  }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || loading && user) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in to manage your saved searches." />;
  return <div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--takeme-gray)]">You choose which searches to save. Alerts only apply to genuinely new matching listings.</p><Link href="/explore" className="button-primary min-h-11 px-4">Explore listings</Link></div>{error && <div role="alert"><ErrorState message={error} /><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-3 min-h-11 px-4">Retry</button></div>}{!items.length && !error ? <EmptyState title="No saved searches" description="Search and filter listings in Explore, then tap Save search." /> : <div className="grid gap-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--takeme-shadow-sm)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{item.criteria.query || item.criteria.category || "Filtered search"}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{[item.criteria.category, item.criteria.condition, item.criteria.type === "buy_now" ? "Fixed price" : item.criteria.type, item.criteria.price ? `Up to RM${item.criteria.price}` : "", item.criteria.location].filter(Boolean).join(" · ") || "All listings"}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">{item.lastTriggeredAt ? `Last match ${new Date(item.lastTriggeredAt).toLocaleDateString("en-MY")}` : "No new matches yet"}</p></div><Link href={searchHref(item)} className="button-secondary min-h-11 px-4">View results</Link></div><div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium">Alerts <select disabled={busy === item.id} value={item.frequency} onChange={(event) => void change(item, { frequency: event.target.value as Frequency })} className="ml-2 min-h-11 rounded-xl border border-gray-300 px-3"><option value="instant">In-app</option><option value="daily" disabled>Daily — not available yet</option><option value="off">Off</option></select></label><Link href={`${searchHref(item)}&savedSearch=${encodeURIComponent(item.id)}`} className="min-h-11 content-center px-3 text-sm font-semibold text-[var(--takeme-dark-green)] underline">Edit filters</Link><button type="button" disabled={busy === item.id} onClick={() => void change(item, { active: !item.active })} className="button-secondary min-h-11 px-4">{item.active ? "Pause" : "Resume"}</button><button type="button" disabled={busy === item.id} onClick={() => void remove(item)} className="min-h-11 px-3 text-sm font-semibold text-red-700">Delete</button></div></article>)}</div>}</div>;
}
