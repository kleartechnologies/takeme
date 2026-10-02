"use client";

import { MapPin } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getHomeRecommendations, type CandidateSource } from "@/lib/services/intelligence";
import { getActiveListings, type ListingPage } from "@/lib/services/listings";

import { DiscoveryEmptyState, DiscoverySectionHeader } from "./discovery-section";

type Discovery = { page: ListingPage; personalized: boolean; sources: Record<string, CandidateSource>; sessionId: string | null };
const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

// Home previews one row (2/3/4 cards by viewport). See all keeps inventory browsing
// and pagination on Explore; discovery requests and their ranking stay unchanged.

export function HomeMarketplace() {
  const { user } = useAuth();
  const [state, setState] = useState<Discovery & { loading: boolean; error: string }>({ page: emptyPage, personalized: false, sources: {}, sessionId: null, loading: true, error: "" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    const load = async (): Promise<Discovery> => {
      if (user) {
        try {
          const recommended = await getHomeRecommendations();
          return { page: { listings: recommended.listings, cursor: null, hasMore: false }, personalized: recommended.personalized, sources: recommended.candidateSources, sessionId: recommended.sessionId };
        } catch { /* Continue with recent public discovery when recommendations are unavailable. */ }
      }
      return { page: await getActiveListings({ sort: "newest", pageSize: 8 }), personalized: false, sources: {}, sessionId: null };
    };
    load().then((result) => { if (active) setState({ ...result, loading: false, error: "" }); })
      .catch(() => { if (active) setState({ page: emptyPage, personalized: false, sources: {}, sessionId: null, loading: false, error: "Fresh finds couldn’t be loaded. Please try again." }); });
    return () => { active = false; };
  }, [user, retry]);

  return <section id="discovery" className="discovery-section scroll-mt-24" aria-labelledby="fresh-finds-title">
    <DiscoverySectionHeader id="fresh-finds-title" title="Fresh Finds" subtitle={state.personalized ? "Selected from your marketplace interests." : "Recently listed on TAKEME"} href="/explore" />
    {!isFirebaseConfigured ? <FirebaseSetupState /> : state.error ? <div role="alert"><ErrorState message={state.error} /><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-4 h-11 px-5">Retry</button></div> : state.loading ? <div className="home-product-grid home-discovery-preview">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} discovery />)}</div> : state.page.listings.length ? <div className="home-product-grid home-discovery-preview">{state.page.listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} variant="discovery" priority={index === 0} recommendationSource={state.sources[listing.id]} recommendationSessionId={state.sessionId} sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw" />)}</div> : <DiscoveryEmptyState title="Nothing here yet." description="Be the first to list something on TAKEME." action="Sell something" href="/sell" />}
  </section>;
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
