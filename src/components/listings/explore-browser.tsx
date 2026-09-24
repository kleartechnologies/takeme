"use client";

import { Filter, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CategoryGrid } from "@/components/home/category-grid";
import { HeroBannerCarousel } from "@/components/home/hero-banner-carousel";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { categories } from "@/data/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type ListingPage, type ListingSort } from "@/lib/services/listings";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import { getPromotionPlacements, type PromotionBadge } from "@/lib/services/promotions";
import type { Listing } from "@/types/marketplace";
import { ListingCard } from "./listing-card";
import { useAuth } from "@/components/auth/auth-provider";
import { saveSearch } from "@/lib/services/engagement";

type Filters = { q: string; category: string; condition: string; type: string; auction: string; price: string; location: string; sort: ListingSort };
const defaults: Filters = { q: "", category: "", condition: "", type: "", auction: "", price: "", location: "", sort: "newest" };
const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

function fromParams(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return { q: params.get("q") ?? "", category: params.get("category") ?? "", condition: params.get("condition") ?? "", type: params.get("type") ?? "", auction: params.get("auction") ?? "", price: params.get("price") ?? "", location: params.get("location") ?? "", sort: sort === "price_low" || sort === "price_high" ? sort : "newest" };
}

export function ExploreBrowser() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => fromParams(new URLSearchParams(params.toString())));
  const [queryInput, setQueryInput] = useState(filters.q);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [state, setState] = useState<{ key: string; page: ListingPage; error: string }>({ key: "", page: emptyPage, error: "" });
  const [placement, setPlacement] = useState<{ key: string; orderIds: string[]; badges: Record<string, PromotionBadge> }>({ key: "", orderIds: [], badges: {} });
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearchMessage, setSavedSearchMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.getElementById("mobile-filters");
    dialog?.querySelector<HTMLElement>('button[aria-label="Close filters"]')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open]);

  useEffect(() => {
    const next = fromParams(new URLSearchParams(params.toString()));
    setFilters(next);
    setQueryInput(next.q);
  }, [params]);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    if (next.price && next.sort === "newest") next.sort = "price_low";
    setFilters(next);
    const url = new URL(window.location.href);
    for (const key of Object.keys(defaults) as (keyof Filters)[]) {
      if (next[key] && next[key] !== defaults[key]) url.searchParams.set(key, next[key]);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url.pathname + url.search);
    if (Object.keys(patch).some((field) => field !== "q")) {
      trackMarketplaceIntent({ type: "FILTER_APPLIED", categoryId: next.category || undefined, filterKey: [next.category, next.condition, next.type, next.auction, next.price, next.sort].join("|") || "all", context: "explore" });
    }
  }

  const request = useMemo(() => ({ search: filters.q, categoryId: filters.category || undefined, condition: filters.condition || undefined, listingType: filters.type || undefined, auctionStatus: filters.auction === "active" ? "active" as const : filters.auction === "scheduled" ? "scheduled" as const : undefined, location: filters.location || undefined, maxPrice: filters.price ? Number(filters.price) : undefined, sort: filters.sort, pageSize: 12 }), [filters]);
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    getActiveListings(request).then((page) => { if (active) setState({ key: requestKey, page, error: "" }); }).catch((error: unknown) => { if (active) setState({ key: requestKey, page: emptyPage, error: friendlyError(error) }); });
    return () => { active = false; };
  }, [request, requestKey, retry]);

  const listingIdsKey = state.page.listings.map((item) => item.id).join(",");
  const placementKey = `${requestKey}:${listingIdsKey}`;
  useEffect(() => {
    if (state.key !== requestKey || !listingIdsKey) return;
    let active = true;
    getPromotionPlacements(state.page.listings, { categoryId: filters.category, search: filters.q }).then((result) => {
      if (active) setPlacement({ key: placementKey, ...result });
    }).catch(() => { if (active) setPlacement({ key: placementKey, orderIds: [], badges: {} }); });
    return () => { active = false; };
  }, [placementKey, listingIdsKey, requestKey, state.key, state.page.listings, filters.category, filters.q]);

  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  const loading = state.key !== requestKey;
  const activePlacement = placement.key === placementKey ? placement : null;
  const listingById = new Map(state.page.listings.map((item) => [item.id, item]));
  const displayedListings = activePlacement?.orderIds.length ? activePlacement.orderIds.map((id) => listingById.get(id)).filter((item): item is Listing => Boolean(item)) : state.page.listings;
  const activeCount = [filters.q, filters.category, filters.condition, filters.type, filters.auction, filters.price, filters.location].filter(Boolean).length;
  async function saveCurrentSearch() {
    setSavingSearch(true); setSavedSearchMessage("");
    try {
      const result = await saveSearch({ query: filters.q, category: filters.category, condition: filters.condition, type: filters.type || (filters.auction ? "auction" : ""), auction: filters.auction, price: filters.price ? Number(filters.price) : null, location: filters.location, sort: filters.sort }, params.get("savedSearch") ? undefined : "instant", params.get("savedSearch") ?? undefined);
      if (params.get("savedSearch")) { const url = new URL(window.location.href); url.searchParams.set("savedSearch", result.searchId); window.history.replaceState(null, "", url.pathname + url.search); }
      setSavedSearchMessage(params.get("savedSearch") ? "Saved search updated." : "Search saved. Manage alerts in Saved searches.");
    } catch (error) { setSavedSearchMessage(error instanceof Error ? error.message : "Could not save this search."); }
    finally { setSavingSearch(false); }
  }
  const reset = () => { update(defaults); setQueryInput(""); setSearchError(""); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const value = queryInput.trim(); if (value.length === 1) { setSearchError("Enter at least 2 characters."); return; } setSearchError(""); if (value.length >= 2) trackMarketplaceIntent({ type: "SEARCH", query: value, context: "explore" }); update({ q: value }); };
  const openNearby = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      document.querySelector<HTMLInputElement>('[data-desktop-filters] input[placeholder="e.g. Kuala Lumpur"]')?.focus();
    } else setOpen(true);
  };

  async function loadMore() {
    if (!state.page.cursor) return;
    setLoadingMore(true);
    try {
      const next = await getActiveListings(request, state.page.cursor);
      setState((current) => ({ key: requestKey, error: "", page: { listings: [...current.page.listings, ...next.listings], cursor: next.cursor, hasMore: next.hasMore } }));
    } catch (error) { setState((current) => ({ ...current, error: friendlyError(error) })); }
    finally { setLoadingMore(false); }
  }

  const filterFields = <>
    <FilterSelect label="Category" value={filters.category} onChange={(category) => update({ category })} options={[{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} />
    <FilterSelect label="Condition" value={filters.condition} onChange={(condition) => update({ condition })} options={["", "New", "Like new", "Good", "Fair"].map((item) => ({ value: item, label: item || "Any condition" }))} />
    <FilterSelect label="Listing type" value={filters.type} onChange={(type) => update({ type, auction: type === "auction" ? filters.auction : "" })} options={[{ value: "", label: "All listing types" }, { value: "buy_now", label: "Fixed price" }, { value: "auction", label: "Auction" }]} />
    {(filters.type === "auction" || filters.auction) && <FilterSelect label="Auction status" value={filters.auction} onChange={(auction) => update({ auction, type: auction ? "auction" : filters.type })} options={[{ value: "", label: "Live and scheduled" }, { value: "active", label: "Live now" }, { value: "scheduled", label: "Scheduled" }]} />}
    <FilterSelect label="Maximum price" value={filters.price} onChange={(price) => update({ price })} options={[{ value: "", label: "Any price" }, { value: "300", label: "Up to RM300" }, { value: "700", label: "Up to RM700" }, { value: "1500", label: "Up to RM1,500" }, { value: "3000", label: "Up to RM3,000" }]} />
    <label className="form-field"><span>Location contains</span><input key={filters.location} defaultValue={filters.location} onBlur={(event) => { if (event.target.value !== filters.location) update({ location: event.target.value.trim() }); }} placeholder="e.g. Kuala Lumpur" /></label>
  </>;

  return <div>
    <form onSubmit={submitSearch} role="search" aria-label="Search marketplace listings" className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3"><div className="flex min-w-0 gap-2 sm:contents"><label className="input-shell h-12 min-w-0 flex-1 rounded-full bg-white shadow-sm"><Search size={20} className="shrink-0" /><span className="sr-only">Search listing titles</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search listings" /></label><button className="button-primary h-12 px-4 sm:px-5" type="submit">Search</button></div><div className="flex min-w-0 gap-2 sm:contents"><button type="button" onClick={() => setOpen(true)} className="button-secondary h-12 px-4 lg:hidden" aria-expanded={open} aria-controls="mobile-filters"><Filter size={18} /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}</button><label className="select-label min-w-0 flex-1 sm:w-52 sm:flex-none"><span className="sr-only">Sort listings</span><select value={filters.sort} onChange={(event) => update({ sort: event.target.value as ListingSort })}><option value="newest" disabled={Boolean(filters.price)}>Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label></div></form>
    <div className="mt-2 flex flex-wrap items-center gap-3"><p className="hidden text-xs leading-5 text-stone-500 sm:block">Search matches title words or prefixes. Filters can be combined; a price cap sorts by price.</p>{activeCount > 0 && (user ? <button type="button" disabled={savingSearch} onClick={() => void saveCurrentSearch()} className="min-h-11 text-sm font-semibold text-[var(--takeme-dark-green)] underline">{savingSearch ? "Saving…" : params.get("savedSearch") ? "Update saved search" : "Save search"}</button> : <Link href={`/login?next=${encodeURIComponent(`/explore?${params}`)}`} className="min-h-11 content-center text-sm font-semibold text-[var(--takeme-dark-green)] underline">Log in to save search</Link>)}<Link href="/saved-searches" className="min-h-11 content-center text-sm font-semibold text-[var(--takeme-dark-green)] underline">Saved searches</Link></div>
    {savedSearchMessage && <p className="mt-1 text-xs text-[var(--takeme-dark-green)]" role="status">{savedSearchMessage}</p>}
    {searchError && <p className="field-error mt-2" role="alert">{searchError}</p>}
    <div className="banner-track mt-5 flex gap-2 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Marketplace discovery">
      <button type="button" role="tab" aria-selected={!filters.type && !filters.location} onClick={() => update({ type: "", auction: "", location: "" })} className={`relative min-h-12 shrink-0 px-2 text-sm font-semibold ${!filters.type && !filters.location ? "text-[var(--takeme-dark-green)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--takeme-green)]" : "text-[var(--takeme-gray)]"}`}>Top Picks</button>
      <button type="button" role="tab" aria-selected={Boolean(filters.location)} onClick={openNearby} className={`relative min-h-12 shrink-0 px-2 text-sm font-semibold ${filters.location ? "text-[var(--takeme-dark-green)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--takeme-green)]" : "text-[var(--takeme-gray)]"}`}>Nearby</button>
      <button type="button" role="tab" aria-selected={filters.type === "auction"} onClick={() => update({ type: "auction" })} className={`relative min-h-12 shrink-0 px-2 text-sm font-semibold ${filters.type === "auction" ? "text-[var(--takeme-dark-green)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--takeme-green)]" : "text-[var(--takeme-gray)]"}`}>Auctions</button>
      <button type="button" role="tab" aria-selected="false" aria-disabled="true" title="Free listings are not supported yet" className="min-h-12 shrink-0 cursor-not-allowed px-2 text-sm font-semibold text-gray-400">Free</button>
    </div>
    <div className="mt-4 grid gap-7 sm:mt-6 lg:grid-cols-[240px_1fr]">
      <aside data-desktop-filters className="sticky top-24 hidden h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] lg:block"><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={17} /> Filters</p><button onClick={reset} className="min-h-11 text-xs font-semibold text-[var(--takeme-dark-green)]">Clear all</button></div><div className="filter-stack">{filterFields}</div></aside>
      <div><div className="mb-5 flex items-end justify-between gap-3"><div>{filters.q && <h2 className="text-lg font-bold tracking-tight sm:text-xl">Search results for “{filters.q}”</h2>}<p className={`${filters.q ? "mt-1" : ""} text-sm text-stone-600`}>{loading ? "Loading listings…" : state.error ? "Listings unavailable" : <><strong className="text-stone-950">{state.page.listings.length}</strong> listings loaded</>}</p></div>{activeCount > 0 && <button onClick={reset} className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-bold text-stone-600"><X size={14} /> Clear filters</button>}</div>
        {!loading && state.error && <div role="alert"><ErrorState message={state.error} /><button type="button" onClick={() => { setState((current) => ({ ...current, key: "", error: "" })); setRetry((value) => value + 1); }} className="button-secondary mt-3 min-h-11 px-4">Retry listings</button></div>}
        {loading ? <div className="grid gap-3 min-[380px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <ListingSkeleton key={index} />)}</div> : !state.error && displayedListings.length ? <div className="grid gap-3 min-[380px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">{displayedListings.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index === 0} promotion={activePlacement?.badges[listing.id]} />)}</div> : !state.error ? <EmptyState title={state.page.hasMore ? "More listings may match" : activeCount ? "No listings match these filters" : "No active listings yet"} description={state.page.hasMore ? "Load the next set to continue searching." : activeCount ? "Try a different title or clear a filter to see more items." : "Be the first to publish an item."} /> : null}
        {!loading && !state.error && state.page.hasMore && <div className="mt-8 text-center"><button disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary h-12 px-6">{loadingMore && <LoaderCircle size={17} className="animate-spin" />}Load more listings</button></div>}
      </div>
    </div>
    {activeCount === 0 && <div className="mt-8"><HeroBannerCarousel /><CategoryGrid /></div>}
    {open && <div className="fixed inset-0 z-[70] bg-black/50 lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section id="mobile-filters" role="dialog" aria-modal="true" aria-label="Filter listings" className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Filter listings</h2><button className="icon-button" aria-label="Close filters" onClick={() => setOpen(false)}><X size={20} /></button></div><div className="filter-stack mt-4">{filterFields}</div><div className="mt-5 flex gap-3"><button className="button-secondary h-12 flex-1" onClick={reset}>Clear all</button><button className="button-primary h-12 flex-1" onClick={() => setOpen(false)}>Show listings</button></div></section></div>}
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="form-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function friendlyError(error: unknown) { const message = error instanceof Error ? error.message : "Listings could not be loaded."; return message.includes("index") ? "Listings are temporarily unavailable for this sort. Try another sort or filter." : "Listings could not be loaded. Please try again."; }
