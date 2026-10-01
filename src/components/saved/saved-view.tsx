"use client";

import { Heart, LoaderCircle, LogIn, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { getSavedPage, removeSavedListing, type SavedPage } from "@/lib/services/saved";
import type { SavedListing } from "@/types/marketplace";

export function SavedView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [items, setItems] = useState<SavedListing[]>([]);
  const [page, setPage] = useState<SavedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedUid, setLoadedUid] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getSavedPage().then((result) => { if (active) { setItems(result.items); setPage(result); setLoadedUid(user.uid); setError(""); setLoading(false); } }).catch(() => { if (active) { setItems([]); setPage(null); setLoadedUid(user.uid); setError("Your saved listings could not be loaded. Please try again."); setLoading(false); } });
    return () => { active = false; };
  }, [user, retry]);

  async function loadMore() {
    if (!page?.hasMore || moreLoading) return;
    setMoreLoading(true); setError("");
    try { const next = await getSavedPage(page.cursor); setItems((current) => [...current, ...next.items]); setPage(next); }
    catch { setError("More saved listings could not be loaded. Please try again."); }
    finally { setMoreLoading(false); }
  }
  async function remove(id: string) {
    try { await removeSavedListing(id); setItems((current) => current.filter((item) => item.listingId !== id)); }
    catch { setError("That saved listing could not be removed. Please try again."); }
  }

  if (!configured) return <FirebaseSetupState />;
  if (authLoading || user && (loading || loadedUid !== user.uid)) return <><h1 className="mb-5 text-2xl font-bold">Saved listings</h1><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <ListingSkeleton key={index} />)}</div></>;
  if (!user) return <div className="grid min-h-[55vh] place-items-center rounded-3xl border border-gray-200 bg-white p-8 text-center"><div><Heart size={32} className="mx-auto text-[var(--takeme-dark-green)]" /><h1 className="mt-4 text-2xl font-bold">Your saved listings</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">Log in to keep the items you love in one place.</p><Link href="/login?next=/saved" className="button-primary mt-6 h-12 px-6"><LogIn size={17} /> Log in</Link></div></div>;
  return <><div className="mb-6"><h1 className="text-2xl font-bold sm:text-3xl">Saved listings</h1><p className="mt-1 text-sm text-[var(--takeme-gray)]">Your private watchlist. Real price drops and auction reminders appear in Updates when enabled.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/saved-searches" className="button-secondary min-h-11 px-4">Saved searches</Link><Link href="/updates" className="button-secondary min-h-11 px-4">Updates</Link><Link href="/notification-preferences" className="button-secondary min-h-11 px-4">Alert settings</Link></div></div>{error && <div className="mb-4" role="alert"><ErrorState message={error} /><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-3 min-h-11 px-5">Retry</button></div>}{!loading && !items.length && !error ? <EmptyState title="Nothing saved yet" description="Tap the heart on a listing to find it here later." /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => item.listing ? <div key={item.listingId} className="min-w-0"><ListingCard listing={item.listing} initialSaved onSavedChange={(saved) => { if (!saved) setItems((current) => current.filter((entry) => entry.listingId !== item.listingId)); }} />{item.savedAt && <p className="mt-1 px-1 text-[11px] text-[var(--takeme-gray)]">Saved {new Date(item.savedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>}</div> : <article key={item.listingId} className="flex min-h-56 flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4"><div><p className="font-semibold">Listing unavailable</p><p className="mt-2 text-sm text-[var(--takeme-gray)]">This item was removed or is no longer public.</p></div><button type="button" onClick={() => void remove(item.listingId)} className="button-secondary min-h-11 w-full"><Trash2 size={17} /> Remove</button></article>)}</div>}{page?.hasMore && <button type="button" onClick={() => void loadMore()} disabled={moreLoading} className="button-secondary mx-auto mt-7 min-h-12 px-6">{moreLoading && <LoaderCircle size={17} className="animate-spin" />} Load more</button>}</>;
}
