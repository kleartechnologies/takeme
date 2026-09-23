"use client";

import { Compass, LoaderCircle, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { getHomeRecommendations, trackMarketplaceIntent, type CandidateSource } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";

type FeedState = {
  loading: boolean;
  listings: Listing[];
  sources: Record<string, CandidateSource>;
  personalized: boolean;
  error: string;
};

const initialState: FeedState = { loading: true, listings: [], sources: {}, personalized: false, error: "" };

export function ForYouFeed() {
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<FeedState>(initialState);
  const [retry, setRetry] = useState(0);
  const impressed = useRef(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    impressed.current = false;
    getHomeRecommendations()
      .then((result) => {
        if (active) setState({ loading: false, listings: result.listings, sources: result.candidateSources, personalized: result.personalized, error: "" });
      })
      .catch(() => {
        if (active) setState({ loading: false, listings: [], sources: {}, personalized: false, error: "Your recommendations could not be loaded. Please try again." });
      });
    return () => { active = false; };
  }, [retry, user]);

  useEffect(() => {
    if (!user || state.loading || impressed.current || !state.listings.length) return;
    const target = document.getElementById("for-you-results");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || impressed.current) return;
      impressed.current = true;
      const groups = new Map<CandidateSource, string[]>();
      for (const listing of state.listings.slice(0, 8)) {
        const source = state.sources[listing.id];
        if (source) groups.set(source, [...(groups.get(source) ?? []), listing.id]);
      }
      for (const [candidateSource, listingIds] of groups) {
        trackMarketplaceIntent({ type: "RECOMMENDATION_IMPRESSION", listingIds, candidateSource, context: "home" });
      }
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [state, user]);

  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <FeedSkeleton />;
  if (!user) return <div className="grid min-h-[52vh] place-items-center rounded-3xl border border-gray-200 bg-white p-7 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Sparkles size={27} /></span><h2 className="mt-4 text-2xl font-bold">Make TAKEME yours</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--takeme-gray)]">Sign in, explore listings and save what you like. Your recommendations will improve from real marketplace activity.</p><Link href="/login?next=/for-you" className="button-primary mt-6 h-12 px-6"><LogIn size={17} /> Sign in</Link></div></div>;

  return <div>
    <div className="banner-track -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Recommendation interests"><button type="button" aria-pressed="true" className="min-h-11 shrink-0 rounded-full bg-[var(--takeme-dark-green)] px-5 text-sm font-semibold text-white">All</button></div>
    {!state.loading && !state.error && !state.personalized && <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--takeme-light-green)] p-4 text-sm leading-6 text-[var(--takeme-dark-green)]"><Compass size={19} className="mt-0.5 shrink-0" /><p><strong>Start exploring to personalize your feed.</strong> These discovery picks are from the live marketplace; TAKEME will personalize them after enough real activity.</p></div>}
    <section id="for-you-results" className="mt-6" aria-labelledby="for-you-heading">
      <div className="mb-4"><h2 id="for-you-heading" className="text-xl font-bold">{state.personalized ? "Recommended for you" : "Discover something good"}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{state.personalized ? "Ranked from your recent TAKEME activity." : "Fresh active listings while your feed gets to know you."}</p></div>
      {state.error ? <div><ErrorState message={state.error} /><button type="button" onClick={() => { setState(initialState); setRetry((value) => value + 1); }} className="button-secondary mt-4 h-11 px-5"><LoaderCircle size={16} /> Try again</button></div>
        : state.loading ? <FeedSkeleton />
        : state.listings.length ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{state.listings.map((listing) => <ListingCard key={listing.id} listing={listing} recommendationSource={state.sources[listing.id]} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" />)}</div>
        : <div><EmptyState title="Start exploring to personalize your feed" description="Browse active listings and save the items you like. Recommendations will appear when there is enough activity." /><Link href="/explore" className="button-primary mt-4 h-11 px-5">Explore listings</Link></div>}
    </section>
  </div>;
}

function FeedSkeleton() {
  return <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} />)}</div>;
}
