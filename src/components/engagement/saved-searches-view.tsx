"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionSheet } from "@/components/ui/action-sheet";
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
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);
  const deleting = useRef(false);
  const exploreLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (!user) return; let active = true; getSavedSearches().then((data) => { if (active) { setItems(data.items); setLoading(false); setError(""); } }).catch(() => { if (active) { setLoading(false); setError("Saved searches could not be loaded."); } }); return () => { active = false; }; }, [user, retry]);
  async function change(item: SavedSearch, patch: { frequency?: Frequency; active?: boolean }) {
    setBusy(item.id); setError("");
    try { await saveSearch(item.criteria, patch.frequency ?? item.frequency, item.id, patch.active ?? item.active); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry)); }
    catch { setError("Search could not be updated. Please try again."); }
    finally { setBusy(""); }
  }
  async function remove(item: SavedSearch) {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(item.id); setError("");
    try {
      await deleteSavedSearch(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setPendingDelete(null);
      // The triggering Delete button no longer exists after successful removal.
      requestAnimationFrame(() => exploreLink.current?.focus());
    }
    catch { setError("Search could not be deleted. Please try again."); }
    finally { deleting.current = false; setBusy(""); }
  }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || loading && user) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in to manage your saved searches." next="/saved-searches" />;
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--takeme-gray)]">You choose which searches to save. Alerts only apply to genuinely new matching listings.</p><Link ref={exploreLink} href="/explore" className="button-primary min-h-11 px-4">Explore listings</Link></div>
    {error && <div role="alert"><ErrorState message={error} /><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-3 min-h-11 px-4">Retry</button></div>}
    {!items.length && !error ? <EmptyState title="No saved searches" description="Search and filter listings in Explore, then tap Save search." /> : <div className="grid gap-4">{items.map((item) => <article key={item.id} className="surface-card min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-bold">{item.criteria.query || item.criteria.category || "Filtered search"}</h2><span className={`status-pill ${!item.active ? "bg-amber-100 text-amber-900" : item.frequency === "off" ? "bg-stone-100 text-stone-700" : "bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"}`}>{!item.active ? "Paused" : item.frequency === "off" ? "Alerts off" : "Active"}</span></div><p className="mt-2 break-words text-sm text-[var(--takeme-gray)]">{[item.criteria.category, item.criteria.condition, item.criteria.type === "buy_now" ? "Fixed price" : item.criteria.type, item.criteria.price ? `Up to RM${item.criteria.price}` : "", item.criteria.location].filter(Boolean).join(" · ") || "All listings"}</p><p className="mt-2 text-xs text-[var(--takeme-gray)]">{item.lastTriggeredAt ? `Last match ${new Date(item.lastTriggeredAt).toLocaleDateString("en-MY")}` : "No new matches yet"}</p></div><Link href={searchHref(item)} className="button-secondary min-h-11 px-4">View results</Link></div>
      {!item.active && <p className="mt-3 text-xs font-semibold text-amber-900">Alerts are paused. Your preferred frequency below applies only after you resume.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium">Alert frequency <select disabled={busy === item.id} value={item.frequency} onChange={(event) => void change(item, { frequency: event.target.value as Frequency })} className="ml-2 min-h-11 rounded-xl border border-gray-300 px-3"><option value="instant">In-app</option><option value="daily" disabled>Daily — not available yet</option><option value="off">Off</option></select></label><Link href={`${searchHref(item)}&savedSearch=${encodeURIComponent(item.id)}`} className="min-h-11 content-center px-3 text-sm font-semibold text-[var(--takeme-dark-green)] underline">Edit filters</Link><button type="button" disabled={busy === item.id} onClick={() => void change(item, { active: !item.active })} className="button-secondary min-h-11 px-4">{item.active ? "Pause" : "Resume"}</button><button type="button" disabled={busy === item.id} onClick={() => setPendingDelete(item)} className="min-h-11 px-3 text-sm font-semibold text-red-700">Delete</button></div>
    </article>)}</div>}
    {pendingDelete && <ActionSheet title="Delete saved search?" description="This saved search will be removed. Its alerts will stop. Your other saved searches will not change." busy={busy === pendingDelete.id} onClose={() => setPendingDelete(null)}>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><button type="button" disabled={busy === pendingDelete.id} onClick={() => setPendingDelete(null)} className="button-secondary min-h-11 flex-1 px-4">Cancel</button><button type="button" disabled={busy === pendingDelete.id} onClick={() => void remove(pendingDelete)} className="min-h-11 flex-1 rounded-full bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy === pendingDelete.id ? "Deleting…" : "Delete"}</button></div>
    </ActionSheet>}
  </div>;
}
