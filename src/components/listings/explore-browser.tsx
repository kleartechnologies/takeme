"use client";

import { ArrowUpDown, Bookmark, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CategoryGrid } from "@/components/home/category-grid";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState, ListingSkeleton } from "@/components/ui/states";
import { ActionSheet } from "@/components/ui/action-sheet";
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
const priceOptions = [{ value: "", label: "Any price" }, { value: "300", label: "Up to RM300" }, { value: "700", label: "Up to RM700" }, { value: "1500", label: "Up to RM1,500" }, { value: "3000", label: "Up to RM3,000" }];

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
    <FilterSelect label="Maximum price" value={filters.price} onChange={(price) => update({ price })} options={filters.price && Number.isFinite(Number(filters.price)) && Number(filters.price) >= 0 && !priceOptions.some(option => option.value === filters.price) ? [...priceOptions, { value: filters.price, label: `Up to RM${Number(filters.price).toLocaleString("en-MY")}` }] : priceOptions} />
    <label className="form-field"><span>Location contains</span><input key={filters.location} defaultValue={filters.location} onBlur={(event) => { if (event.target.value !== filters.location) update({ location: event.target.value.trim() }); }} placeholder="e.g. Kuala Lumpur" /></label>
  </>;

  const selectedCategory = categories.find((item) => item.id === filters.category)?.name;
  const activeSummary = [filters.q && `Search: “${filters.q}”`, filters.location && `Area: ${filters.location}`, filters.price && `Up to RM${filters.price}`, filters.auction && (filters.auction === "active" ? "Live now" : "Scheduled"), filters.type === "buy_now" && "Fixed price"].filter(Boolean).join(" · ");
  return <div>
    <form onSubmit={submitSearch} role="search" aria-label="Search marketplace listings" className="explore-search-row">
      <div className="explore-search-field"><button type="submit" aria-label="Search TAKEME" className="icon-button shrink-0"><Search size={19} /></button><label className="min-w-0 flex-1"><span className="sr-only">Search listing titles</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={selectedCategory ? `Search in ${selectedCategory}…` : "Search TAKEME"} /></label></div>
      <button type="button" onClick={() => setOpen(true)} className="explore-filter-button icon-button" aria-label={activeCount ? `Filters (${activeCount})` : "Filters"} aria-expanded={open}><SlidersHorizontal size={21} />{activeCount > 0 && <span className="explore-filter-count" aria-hidden="true">{activeCount}</span>}</button>
    </form>
    {searchError && <p className="field-error mt-2" role="alert">{searchError}</p>}
    {savedSearchMessage && <p className="mt-2 text-xs text-[var(--takeme-dark-green)]" role="status">{savedSearchMessage}</p>}
    <CategoryGrid compact selectedId={filters.category} />
    <div className="explore-heading-row">
      <div className="min-w-0"><h2 className="explore-heading">{selectedCategory ?? "Explore"}</h2><p className="explore-count" role="status">{loading ? "Finding items…" : state.error ? "Items unavailable" : `${state.page.listings.length}${state.page.hasMore ? "+" : ""} items`}</p></div>
      <label className="explore-sort"><ArrowUpDown size={15} aria-hidden="true" /><span className="sr-only">Sort listings</span><select value={filters.sort} onChange={(event) => update({ sort: event.target.value as ListingSort })}><option value="newest" disabled={Boolean(filters.price)}>Latest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label>
    </div>
    <div className="explore-chips banner-track" role="group" aria-label="Quick listing filters">
      <button type="button" aria-pressed={!filters.condition && !filters.type && !filters.auction} onClick={() => update({ condition: "", type: "", auction: "" })}>All</button>
      {["New", "Like new", "Good", "Fair"].map((condition) => <button key={condition} type="button" aria-pressed={filters.condition === condition} onClick={() => update({ condition: filters.condition === condition ? "" : condition })}>{condition === "Like new" ? "Like New" : condition}</button>)}
      <button type="button" aria-pressed={filters.type === "auction"} onClick={() => update({ type: filters.type === "auction" ? "" : "auction", auction: "" })}>Auctions</button>
      {activeCount > 0 && <button type="button" onClick={reset}><X size={13} className="inline" aria-hidden="true" /> Clear filters</button>}
    </div>
    {activeSummary && <div className="explore-applied-filters"><p>{activeSummary}</p></div>}
    <div aria-busy={loading || loadingMore}>
      {!loading && state.error && <div role="alert"><ErrorState message={state.error} /><button type="button" onClick={() => { setState((current) => ({ ...current, key: "", error: "" })); setRetry((value) => value + 1); }} className="button-secondary mt-3 min-h-11 px-4">Retry listings</button></div>}
      {loading ? <div className="explore-product-grid">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} discovery />)}</div> : !state.error && displayedListings.length ? <div className="explore-product-grid">{displayedListings.map((listing, index) => <ListingCard key={listing.id} listing={listing} variant="discovery" sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw" priority={index === 0} promotion={activePlacement?.badges[listing.id]} />)}</div> : !state.error ? <div className="discovery-empty explore-empty"><Image src="/brand/mascot-2d-happy.png" alt="" width={64} height={54} /><div><h3 className="text-sm font-semibold">{state.page.hasMore ? "More items may match" : activeCount ? "No matches found" : "No active listings yet"}</h3><p className="mt-1 text-xs text-[var(--takeme-gray)]">{state.page.hasMore ? "Load the next set to keep browsing." : activeCount ? "Try changing your filters or search." : "New finds will appear here when sellers publish."}</p>{activeCount > 0 && <button type="button" onClick={reset} className="discovery-see-all">Clear filters</button>}</div></div> : null}
      {!loading && !state.error && state.page.hasMore && <div className="mt-6 text-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary min-h-11 px-6">{loadingMore && <LoaderCircle size={17} className="animate-spin" />}{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </div>
    {open && <ActionSheet title="Filters" description="Refine products by category, condition, price or general area." onClose={() => setOpen(false)}><div className="filter-stack explore-filter-fields">{filterFields}</div><div className="mt-5 flex gap-3"><button type="button" className="button-secondary min-h-11 flex-1" onClick={reset}>Reset</button><button type="button" className="button-primary min-h-11 flex-1" onClick={() => setOpen(false)}>Show results</button></div><div className="explore-saved-searches"><Link href="/saved-searches"><Bookmark size={16} aria-hidden="true" /> Saved searches</Link>{activeCount > 0 && (user ? <button type="button" disabled={savingSearch} onClick={() => void saveCurrentSearch()}>{savingSearch ? "Saving…" : params.get("savedSearch") ? "Update saved search" : "Save search"}</button> : <Link href={`/login?next=${encodeURIComponent(`/explore?${params}`)}`}>Log in to save search</Link>)}</div>{savedSearchMessage && <p className="mt-2 text-xs text-[var(--takeme-dark-green)]" role="status">{savedSearchMessage}</p>}</ActionSheet>}
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="form-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function friendlyError(error: unknown) { const message = error instanceof Error ? error.message : "Listings could not be loaded."; return message.includes("index") ? "Listings are temporarily unavailable for this sort. Try another sort or filter." : "Listings could not be loaded. Please try again."; }
