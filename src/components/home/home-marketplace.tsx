"use client";

import { ArrowRight, LoaderCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type ListingPage, type ListingQuery } from "@/lib/services/listings";

type Tab = "top" | "nearby" | "auctions" | "free";
const tabs: { id: Tab; label: string }[] = [
  { id: "top", label: "Top Picks" },
  { id: "nearby", label: "Nearby" },
  { id: "auctions", label: "Auctions" },
  { id: "free", label: "Free" },
];
const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

function requestFor(tab: Tab, location: string): ListingQuery {
  return { sort: "newest", pageSize: 8, ...(tab === "auctions" ? { listingType: "auction" } : {}), ...(tab === "nearby" ? { location } : {}) };
}

export function HomeMarketplace() {
  const [tab, setTab] = useState<Tab>("top");
  const [locationInput, setLocationInput] = useState("");
  const [location, setLocation] = useState("");
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; page: ListingPage; loading: boolean; error: string }>({ key: "", page: emptyPage, loading: true, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const cache = useRef(new Map<string, ListingPage>());
  const key = tab === "nearby" ? `nearby:${location}` : tab;
  const currentKey = useRef(key);

  useEffect(() => {
    currentKey.current = key;
    if (!isFirebaseConfigured || tab === "free" || (tab === "nearby" && !location)) return;
    let active = true;
    const cached = cache.current.get(key);
    if (cached) {
      setState({ key, page: cached, loading: false, error: "" });
      return;
    }
    setState({ key, page: emptyPage, loading: true, error: "" });
    getActiveListings(requestFor(tab, location)).then((page) => {
      cache.current.set(key, page);
      if (active) setState({ key, page, loading: false, error: "" });
    }).catch(() => { if (active) setState({ key, page: emptyPage, loading: false, error: "We couldn’t load the marketplace right now. Please try again." }); });
    return () => { active = false; };
  }, [key, tab, location, retry]);

  function selectTab(next: Tab) { setTab(next); setLoadingMore(false); }
  function keyboardTab(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((item) => item.id === tab);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(tabs[next].id);
    document.getElementById(`discovery-tab-${tabs[next].id}`)?.focus();
  }
  function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocation(locationInput.trim());
  }
  async function loadMore() {
    if (!state.page.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getActiveListings(requestFor(tab, location), state.page.cursor);
      const combined = { listings: [...state.page.listings, ...page.listings], cursor: page.cursor, hasMore: page.hasMore };
      cache.current.set(key, combined);
      if (currentKey.current === key) setState({ key, page: combined, loading: false, error: "" });
    } catch { if (currentKey.current === key) setState((previous) => ({ ...previous, error: "More listings couldn’t be loaded. Please try again." })); }
    finally { setLoadingMore(false); }
  }

  const title = tab === "top" ? "Top Picks" : tab === "nearby" ? "Nearby" : tab === "auctions" ? "Auctions" : "Free Items";
  const viewAll = tab === "auctions" ? "/explore?type=auction" : tab === "nearby" ? `/explore?location=${encodeURIComponent(location)}` : "/explore";
  const loading = state.key !== key || state.loading;
  return <section id="discovery" className="scroll-mt-24 border-t border-gray-200 pt-2">
    <div role="tablist" aria-label="Discover listings" className="banner-track flex gap-6 overflow-x-auto overscroll-x-contain border-b border-gray-200 sm:gap-9">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" id={`discovery-tab-${item.id}`} aria-controls="discovery-panel" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={keyboardTab} onClick={() => selectTab(item.id)} className={`relative min-h-12 shrink-0 whitespace-nowrap px-0.5 text-sm font-semibold transition-colors ${tab === item.id ? "text-[var(--takeme-dark-green)] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--takeme-green)]" : "text-[var(--takeme-gray)] hover:text-[var(--takeme-dark-green)]"}`}>{item.label}</button>)}
    </div>
    <div id="discovery-panel" role="tabpanel" aria-labelledby={`discovery-tab-${tab}`} tabIndex={0} className="pt-5">
      <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2><p className="mt-1 text-xs text-[var(--takeme-gray)] sm:text-sm">{tab === "top" ? "Freshly listed items from TAKEME sellers." : tab === "auctions" ? "Live and upcoming auctions." : tab === "nearby" ? "Find listings by the seller’s stated location, not your device location." : "Free items are not supported yet."}</p></div>{tab !== "free" && (tab !== "nearby" || location) && <Link href={viewAll} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--takeme-dark-green)] sm:text-sm">View all <ArrowRight size={15} /></Link>}</div>
      {tab === "nearby" && <form onSubmit={submitLocation} className="mb-5 flex max-w-md gap-2"><label className="input-shell min-w-0 flex-1"><MapPin size={17} className="shrink-0" /><span className="sr-only">Seller location</span><input value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder="e.g. Kuala Lumpur" /></label><button type="submit" className="button-secondary h-12 shrink-0 px-4">Find</button></form>}
      {tab === "free" ? <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm leading-6 text-[var(--takeme-gray)]">TAKEME listings currently require a positive price. Free items will appear here when the marketplace supports them. <Link href="/explore" className="font-semibold text-[var(--takeme-dark-green)] underline underline-offset-4">Browse listings</Link></div>
        : tab === "nearby" && !location ? <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm leading-6 text-[var(--takeme-gray)]">Enter a seller location above to see matching listings. This is a text location filter, not distance or GPS search.</div>
        : !isFirebaseConfigured ? <FirebaseSetupState />
        : state.error ? <div role="alert"><ErrorState message={state.error} /><button type="button" onClick={() => { cache.current.delete(key); setRetry((value) => value + 1); }} className="button-secondary mt-4 h-11 px-5">Retry</button></div>
        : loading ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} />)}</div>
        : state.page.listings.length ? <><div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{state.page.listings.map((listing) => <ListingCard key={listing.id} listing={listing} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" />)}</div>{state.page.hasMore && <div className="mt-7 text-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary h-11 px-5">{loadingMore && <LoaderCircle size={16} className="animate-spin" />}Load more</button></div>}</>
        : <div><EmptyState title="Nothing here yet" description={tab === "nearby" ? "No active listings match that seller location. Try another location or browse all items." : "Be the first to list something."} /><Link href="/sell" className="button-primary mt-4 h-11 px-5">Sell Something</Link></div>}
    </div>
  </section>;
}
