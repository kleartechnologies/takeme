"use client";

import { Filter, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { categories } from "@/data/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings, type ListingPage, type ListingSort } from "@/lib/services/listings";
import { ListingCard } from "./listing-card";

const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

export function ExploreBrowser() {
  const params = useSearchParams();
  const initialSearch = params.get("q") ?? "";
  const [queryInput, setQueryInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [condition, setCondition] = useState("");
  const [type] = useState("buy_now");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<ListingSort>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [state, setState] = useState<{ key: string; page: ListingPage; error: string }>({ key: "", page: emptyPage, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  const filters = useMemo(() => ({ search, categoryId: search ? undefined : category || undefined, condition: search ? undefined : condition || undefined, listingType: type, location: search ? undefined : location || undefined, maxPrice: maxPrice ? Number(maxPrice) : undefined, sort, pageSize: 12 }), [search, category, condition, type, location, maxPrice, sort]);
  const requestKey = JSON.stringify(filters);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    getActiveListings(filters).then((page) => { if (active) setState({ key: requestKey, page, error: "" }); }).catch((error: unknown) => { if (active) setState({ key: requestKey, page: emptyPage, error: friendlyError(error) }); });
    return () => { active = false; };
  }, [filters, requestKey]);

  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  const loading = state.key !== requestKey;
  const reset = () => { setQueryInput(""); setSearch(""); setCategory(""); setCondition(""); setMaxPrice(""); setLocation(""); setSort("newest"); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const value = queryInput.trim(); if (value.length === 1) { setSearchError("Enter at least 2 characters."); return; } setSearchError(""); setSearch(value); };

  async function loadMore() {
    if (!state.page.cursor) return;
    setLoadingMore(true);
    try {
      const next = await getActiveListings(filters, state.page.cursor);
      setState((current) => ({ key: requestKey, error: "", page: { listings: [...current.page.listings, ...next.listings], cursor: next.cursor, hasMore: next.hasMore } }));
    } catch (error) { setState((current) => ({ ...current, error: friendlyError(error) })); }
    finally { setLoadingMore(false); }
  }

  return (
    <div>
      <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row"><label className="input-shell flex-1"><Search size={19} /><span className="sr-only">Search listing titles</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search listing titles..." /></label><button className="button-primary h-12 px-5" type="submit">Search</button><button type="button" onClick={() => setShowFilters((value) => !value)} className="button-secondary h-12 px-5 lg:hidden"><Filter size={18} /> Filters</button><label className="select-label w-full sm:w-52"><span className="sr-only">Sort listings</span><select value={sort} onChange={(event) => setSort(event.target.value as ListingSort)}><option value="newest" disabled={Boolean(maxPrice)}>Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label></form>
      <p className="mt-2 text-xs leading-5 text-stone-500">Search matches a title word/prefix or the beginning of a full title. Full-text description search is planned for a later search service.</p>
      {searchError && <p className="field-error mt-2" role="alert">{searchError}</p>}
      {search && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--takeme-light-green)] px-3 py-2 text-xs text-[var(--takeme-dark-green)]"><span>Title search is active; category, condition and location facets are paused.</span><button onClick={() => { setQueryInput(""); setSearch(""); }} className="shrink-0 font-semibold">Clear search</button></div>}
      <div className="mt-6 grid gap-7 lg:grid-cols-[240px_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] lg:sticky lg:top-24 lg:block`}><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={17} /> Filters</p><button onClick={reset} className="text-xs font-semibold text-[var(--takeme-dark-green)]">Clear</button></div><div className="filter-stack"><FilterSelect disabled={Boolean(search)} label="Category" value={category} onChange={setCategory} options={[{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} /><FilterSelect disabled={Boolean(search)} label="Condition" value={condition} onChange={setCondition} options={["", "New", "Like new", "Good", "Fair"].map((item) => ({ value: item, label: item || "Any condition" }))} /><FilterSelect label="Listing type" value={type} onChange={() => undefined} options={[{ value: "buy_now", label: "Buy now" }]} /><FilterSelect label="Price" value={maxPrice} onChange={(value) => { setMaxPrice(value); if (value && sort === "newest") setSort("price_low"); }} options={[{ value: "", label: "Any price" }, { value: "300", label: "Up to RM300" }, { value: "700", label: "Up to RM700" }, { value: "1500", label: "Up to RM1,500" }, { value: "3000", label: "Up to RM3,000" }]} /><label className="form-field"><span>Exact location</span><input disabled={Boolean(search)} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Kuala Lumpur" /></label></div></aside>
        <div>
          <div className="mb-5 flex items-center justify-between"><p className="text-sm text-stone-600"><strong className="text-stone-950">{state.page.listings.length}</strong> listings loaded</p>{(search || category || condition || maxPrice || location) && <button onClick={reset} className="flex items-center gap-1 text-xs font-bold text-stone-500"><X size={14} /> Reset</button>}</div>
          {state.error && <ErrorState message={state.error} />}
          {loading ? <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <ListingSkeleton key={index} />)}</div> : !state.error && state.page.listings.length ? <><div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{state.page.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>{state.page.hasMore && <div className="mt-8 text-center"><button disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary h-12 px-6">{loadingMore && <LoaderCircle size={17} className="animate-spin" />}Load more</button></div>}</> : !state.error ? <EmptyState title="No active listings yet" description="Try clearing a filter, or be the first to publish an item." /> : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) { return <label className="form-field"><span>{label}</span><select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function friendlyError(error: unknown) { const message = error instanceof Error ? error.message : "Listings could not be loaded."; return message.includes("index") ? "This filter needs a Firestore index. Deploy the included indexes and try again." : message; }
