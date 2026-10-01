"use client";

import { ArrowRight, LoaderCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getHomeRecommendations, type CandidateSource } from "@/lib/services/intelligence";
import { getActiveListings, type ListingPage } from "@/lib/services/listings";

type Discovery = { page: ListingPage; personalized: boolean; sources: Record<string, CandidateSource>; sessionId: string | null };
const emptyPage: ListingPage = { listings: [], cursor: null, hasMore: false };

export function HomeMarketplace() {
  const { user } = useAuth();
  const [state, setState] = useState<Discovery & { loading: boolean; error: string }>({ page: emptyPage, personalized: false, sources: {}, sessionId: null, loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

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

  async function loadMore() {
    if (!state.page.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getActiveListings({ sort: "newest", pageSize: 8 }, state.page.cursor);
      setState((current) => ({ ...current, page: { listings: [...current.page.listings, ...next.listings], cursor: next.cursor, hasMore: next.hasMore }, error: "" }));
    } catch { setState((current) => ({ ...current, error: "More listings couldn’t be loaded. Please try again." })); }
    finally { setLoadingMore(false); }
  }

  return <section id="discovery" className="scroll-mt-24 border-t border-gray-200 py-6" aria-labelledby="fresh-finds-title">
    <div className="mb-4 flex items-end justify-between gap-3"><div><h2 id="fresh-finds-title" className="text-xl font-bold tracking-tight sm:text-2xl">Fresh Finds</h2><p className="mt-1 text-xs text-[var(--takeme-gray)] sm:text-sm">{state.personalized ? "Selected from your marketplace interests." : "Recently listed by TAKEME sellers."}</p></div><Link href="/explore" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--takeme-dark-green)] sm:text-sm">See all <ArrowRight size={15} /></Link></div>
    {!isFirebaseConfigured ? <FirebaseSetupState /> : state.error ? <div role="alert"><ErrorState message={state.error} /><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary mt-4 h-11 px-5">Retry</button></div> : state.loading ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} />)}</div> : state.page.listings.length ? <><div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{state.page.listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index === 0} recommendationSource={state.sources[listing.id]} recommendationSessionId={state.sessionId} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" />)}</div>{state.page.hasMore && <div className="mt-7 text-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary h-11 px-5">{loadingMore && <LoaderCircle size={16} className="animate-spin" />}Load more</button></div>}</> : <div><EmptyState title="No fresh finds yet" description="Be the first to list something on TAKEME." /><Link href="/sell" className="button-primary mt-4 h-11 px-5">Sell something</Link></div>}
  </section>;
}

export function NearYouMarketplace() {
  const [input, setInput] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<{ page: ListingPage; loading: boolean; error: string }>({ page: emptyPage, loading: false, error: "" });
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
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
    if (next === location) setRetry((value) => value + 1);
  }
  async function loadMore() {
    if (!state.page.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getActiveListings({ location, sort: "newest", pageSize: 8 }, state.page.cursor);
      setState((current) => ({ ...current, page: { listings: [...current.page.listings, ...next.listings], cursor: next.cursor, hasMore: next.hasMore } }));
    } catch { setState((current) => ({ ...current, error: "More listings couldn’t be loaded. Please try again." })); }
    finally { setLoadingMore(false); }
  }
  return <section className="border-t border-gray-200 py-7" aria-labelledby="near-you-title">
    <div className="flex items-end justify-between gap-3"><div><h2 id="near-you-title" className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl"><MapPin size={21} className="text-[var(--takeme-dark-green)]" /> Near You</h2><p className="mt-1 text-xs text-[var(--takeme-gray)] sm:text-sm">Browse by a seller’s general area, never your device location.</p></div>{location && <Link href={`/explore?location=${encodeURIComponent(location)}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--takeme-dark-green)] sm:text-sm">See all <ArrowRight size={15} /></Link>}</div>
    <form onSubmit={submit} className="mt-4 flex max-w-md gap-2"><label className="input-shell min-w-0 flex-1"><MapPin size={17} className="shrink-0" /><span className="sr-only">Seller district or city</span><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Jitra, Kedah" /></label><button type="submit" className="button-primary h-12 shrink-0 px-4">Find</button></form>
    {!location ? <p className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-[var(--takeme-gray)]">Enter a district or city to discover listings in that general area.</p> : !isFirebaseConfigured ? <div className="mt-4"><FirebaseSetupState /></div> : state.error ? <div className="mt-4" role="alert"><ErrorState message={state.error} /><button type="button" className="button-secondary mt-3 h-11 px-5" onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setRetry((value) => value + 1); }}>Retry</button></div> : state.loading ? <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div> : state.page.listings.length ? <><div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{state.page.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>{state.page.hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="button-secondary mt-5 h-11 px-5">{loadingMore && <LoaderCircle size={16} className="animate-spin" />} Load more</button>}</> : <p className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-[var(--takeme-gray)]">No active listings match that area yet. Try another general location.</p>}
  </section>;
}
