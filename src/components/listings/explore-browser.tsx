"use client";

import { Filter, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { categories } from "@/data/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type ListingPage, type ListingSort } from "@/lib/services/listings";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import { ListingCard } from "./listing-card";

type Filters = { q: string; category: string; condition: string; type: string; auction: string; price: string; location: string; sort: ListingSort };
const defaults: Filters = { q: "", category: "", condition: "", type: "", auction: "", price: "", location: "", sort: "newest" };
const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

function fromParams(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return { q: params.get("q") ?? "", category: params.get("category") ?? "", condition: params.get("condition") ?? "", type: params.get("type") ?? "", auction: params.get("auction") ?? "", price: params.get("price") ?? "", location: params.get("location") ?? "", sort: sort === "price_low" || sort === "price_high" ? sort : "newest" };
}

export function ExploreBrowser() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => fromParams(new URLSearchParams(params.toString())));
  const [queryInput, setQueryInput] = useState(filters.q);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [state, setState] = useState<{ key: string; page: ListingPage; error: string }>({ key: "", page: emptyPage, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);

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
  }, [request, requestKey]);

  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  const loading = state.key !== requestKey;
  const activeCount = [filters.q, filters.category, filters.condition, filters.type, filters.auction, filters.price, filters.location].filter(Boolean).length;
  const reset = () => { update(defaults); setQueryInput(""); setSearchError(""); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const value = queryInput.trim(); if (value.length === 1) { setSearchError("Enter at least 2 characters."); return; } setSearchError(""); if (value.length >= 2) trackMarketplaceIntent({ type: "SEARCH", query: value, context: "explore" }); update({ q: value }); };

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
    <form onSubmit={submitSearch} className="flex flex-wrap gap-3"><label className="input-shell min-w-[180px] flex-1"><Search size={19} /><span className="sr-only">Search listing titles</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search listing titles..." /></label><button className="button-primary h-12 px-5" type="submit">Search</button><button type="button" onClick={() => setOpen(true)} className="button-secondary h-12 px-5 lg:hidden" aria-expanded={open} aria-controls="mobile-filters"><Filter size={18} /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}</button><label className="select-label w-full sm:w-52"><span className="sr-only">Sort listings</span><select value={filters.sort} onChange={(event) => update({ sort: event.target.value as ListingSort })}><option value="newest" disabled={Boolean(filters.price)}>Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label></form>
    <p className="mt-2 text-xs leading-5 text-stone-500">Search matches title words or prefixes. Filters can be combined; a price cap sorts by price.</p>
    {searchError && <p className="field-error mt-2" role="alert">{searchError}</p>}
    <div className="mt-6 grid gap-7 lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-24 hidden h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] lg:block"><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={17} /> Filters</p><button onClick={reset} className="min-h-11 text-xs font-semibold text-[var(--takeme-dark-green)]">Clear all</button></div><div className="filter-stack">{filterFields}</div></aside>
      <div><div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm text-stone-600"><strong className="text-stone-950">{loading ? "…" : state.page.listings.length}</strong> listings loaded</p>{activeCount > 0 && <button onClick={reset} className="flex min-h-11 items-center gap-1 text-xs font-bold text-stone-600"><X size={14} /> Clear filters</button>}</div>
        {state.error && <ErrorState message={state.error} />}
        {loading ? <div className="grid gap-3 min-[380px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <ListingSkeleton key={index} />)}</div> : !state.error && state.page.listings.length ? <div className="grid gap-3 min-[380px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">{state.page.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : !state.error ? <EmptyState title={activeCount ? "No matches in this set" : "No active listings yet"} description={activeCount ? "Try a different title or clear a filter to see more items." : "Be the first to publish an item."} /> : null}
        {!loading && !state.error && state.page.hasMore && <div className="mt-8 text-center"><button disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary h-12 px-6">{loadingMore && <LoaderCircle size={17} className="animate-spin" />}Load more listings</button></div>}
      </div>
    </div>
    {open && <div className="fixed inset-0 z-[70] bg-black/50 lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section id="mobile-filters" role="dialog" aria-modal="true" aria-label="Filter listings" className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Filter listings</h2><button className="icon-button" aria-label="Close filters" onClick={() => setOpen(false)}><X size={20} /></button></div><div className="filter-stack mt-4">{filterFields}</div><div className="mt-5 flex gap-3"><button className="button-secondary h-12 flex-1" onClick={reset}>Clear all</button><button className="button-primary h-12 flex-1" onClick={() => setOpen(false)}>Show listings</button></div></section></div>}
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="form-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function friendlyError(error: unknown) { const message = error instanceof Error ? error.message : "Listings could not be loaded."; return message.includes("index") ? "Listings are temporarily unavailable for this sort. Try another sort or filter." : "Listings could not be loaded. Please try again."; }
