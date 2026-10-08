"use client";

import { MapPin } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getHomeRecommendations, type RecommendationPage } from "@/lib/services/intelligence";
import { getActiveListings, type ListingPage } from "@/lib/services/listings";

import { parsePublicCataloguePage, type PublicCataloguePage } from "@/lib/public-catalogue";

import { DiscoveryEmptyState, DiscoverySectionHeader } from "./discovery-section";

const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

/** Public first row is stable across account changes. Personalization never replaces it. */
export function HomeMarketplace({ initialPage, title = "Fresh Finds" }: { initialPage: PublicCataloguePage | null; title?: string }) {
  const [state, setState] = useState({ page: initialPage ?? emptyPage, error: initialPage ? "" : "Fresh finds couldn’t be loaded. Please try again." });
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const response = await fetch("/api/public-catalogue", { credentials: "omit", cache: "no-store" });
      const page = response.ok ? parsePublicCataloguePage(await response.json()) : null;
      if (!page) throw new Error("unavailable");
      setState({ page, error: "" });
    } catch { setState(current => ({ ...current, error: "Fresh finds couldn’t be loaded. Please try again." })); }
    finally { setRetrying(false); }
  }
  return <section id="discovery" className="discovery-section scroll-mt-24" aria-labelledby="fresh-finds-title">
    <DiscoverySectionHeader id="fresh-finds-title" title={title} subtitle="Recently listed on TAKEME" href="/explore" />
    {state.error ? <div role="alert"><ErrorState message={state.error} /><button type="button" disabled={retrying} onClick={() => void retry()} className="button-secondary mt-4 h-11 px-5">{retrying ? "Trying again…" : "Retry"}</button></div> : state.page.listings.length ? <div className="home-product-grid home-discovery-preview">{state.page.listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} variant="discovery" priority={index === 0} sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw" />)}</div> : <DiscoveryEmptyState title="Nothing here yet." description="Be the first to list something on TAKEME." action="Sell something" href="/sell" />}
  </section>;
}

export function HomeMarketplaceSkeleton() {
  return <section className="discovery-section" aria-label="Loading Fresh Finds"><DiscoverySectionHeader id="fresh-finds-loading" title="Fresh Finds" subtitle="Recently listed on TAKEME" href="/explore" /><div className="home-product-grid home-discovery-preview">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} discovery />)}</div></section>;
}

/** Secondary region only: failures/sign-out never remove the public first feed. */
export function PersonalizedMarketplace() {
  const { user, loading, setup, setupError } = useAuth();
  const [result, setResult] = useState<{ uid: string; page: RecommendationPage } | null>(null);
  const uid = !loading && !setupError && setup?.step === "ready" && setup.policyAvailable === true ? user?.uid : undefined;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    getHomeRecommendations().then(page => { if (active) setResult({ uid, page }); }).catch(() => {});
    return () => { active = false; };
  }, [uid]);
  const page = uid && result?.uid === uid ? result.page : null;
  if (!page?.listings.length) return null;
  return <section className="discovery-section" aria-labelledby="personalized-finds-title"><DiscoverySectionHeader id="personalized-finds-title" title="For You" subtitle="Selected from your marketplace interests." href="/for-you" /><div className="home-product-grid home-discovery-preview">{page.listings.map(listing => <ListingCard key={listing.id} listing={listing} variant="discovery" recommendationSource={page.candidateSources[listing.id]} recommendationSessionId={page.sessionId} />)}</div></section>;
}

export function NearYouMarketplace() {
  const [input, setInput] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<{ page: ListingPage; loading: boolean; error: string }>({ page: emptyPage, loading: false, error: "" });
  const [retry, setRetry] = useState(0);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  useEffect(() => {
    if (!isFirebaseConfigured || !location) return;
    let active = true;
    getActiveListings({ location, sort: "newest", pageSize: 8 })
      .then((page) => { if (active) setState({ page, loading: false, error: "" }); })
      .catch(() => { if (active) setState({ page: emptyPage, loading: false, error: "Listings for this area couldn’t be loaded. Please try again." }); });
    return () => { active = false; };
  }, [location, retry]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    if (!next) return;
    setState({ page: emptyPage, loading: true, error: "" });
    setLocation(next);
    setAreaPickerOpen(false);
    if (next === location) setRetry((value) => value + 1);
  }
  return <section className="discovery-section" aria-labelledby="near-you-title">
    <DiscoverySectionHeader id="near-you-title" title="Near You" subtitle="Items around your area" icon={MapPin} href={location ? `/explore?location=${encodeURIComponent(location)}` : "/explore"} />
    <details className={`home-area-picker${location ? " home-area-picker--selected" : ""}`} open={areaPickerOpen} onToggle={(event) => setAreaPickerOpen(event.currentTarget.open)}><summary className="discovery-see-all cursor-pointer"><MapPin size={16} aria-hidden="true" />{location ? `${location} · Change area` : "Choose area to find nearby items"}</summary><form onSubmit={submit} className="mt-2 flex max-w-md gap-2"><label className="input-shell min-w-0 flex-1"><span className="sr-only">Seller district or city</span><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Jitra, Kedah" /></label><button type="submit" className="button-primary h-12 shrink-0 px-4">Find</button></form><p className="mt-2 text-xs text-[var(--takeme-gray)]">General seller area only. No device location is used.</p></details>
    {!location ? null : !isFirebaseConfigured ? <div className="mt-4"><FirebaseSetupState /></div> : state.error ? <div className="mt-4" role="alert"><ErrorState message={state.error} /><button type="button" className="button-secondary mt-3 h-11 px-5" onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setRetry((value) => value + 1); }}>Retry</button></div> : state.loading ? <div className="home-product-grid home-discovery-preview mt-2">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} discovery />)}</div> : state.page.listings.length ? <div className="home-product-grid home-discovery-preview mt-2">{state.page.listings.map((listing) => <ListingCard key={listing.id} listing={listing} variant="discovery" />)}</div> : <p className="mt-2 text-xs text-[var(--takeme-gray)]">No active listings match that area yet. Try another general location.</p>}
  </section>;
}
