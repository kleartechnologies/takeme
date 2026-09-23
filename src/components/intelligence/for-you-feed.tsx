"use client";

import { ArrowRight, Compass, LoaderCircle, LogIn, RotateCcw, Sparkles, ThumbsDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { getMarketplaceDiscovery, trackMarketplaceEvent, type CandidateSource, type DiscoverySection } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";

type Item = { listing: Listing; candidateSource: CandidateSource; sessionId: string | null };
type Section = Omit<DiscoverySection, "listings"> & { listings: Item[] };
type FeedState = { loading: boolean; sections: Section[]; personalized: boolean; error: string };
const initialState: FeedState = { loading: true, sections: [], personalized: false, error: "" };

export function ForYouFeed() {
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<FeedState>(initialState);
  const [retry, setRetry] = useState(0);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    getMarketplaceDiscovery().then((result) => {
      if (active) setState({ loading: false, personalized: result.metadata.personalized, error: "",
        sections: result.sections.map((section) => ({ ...section, listings: section.listings.map((item) => ({ ...item, sessionId: result.sessionId })) })) });
    }).catch(() => {
      if (active) setState({ loading: false, sections: [], personalized: false, error: "Your discoveries could not be loaded. Please try again." });
    });
    return () => { active = false; };
  }, [retry, user]);

  async function loadMore(section: Section) {
    if (!section.nextCursor || loadingSection) return;
    setLoadingSection(section.id);
    setActionError("");
    try {
      const page = await getMarketplaceDiscovery(section.id, section.nextCursor);
      const next = page.sections.find((entry) => entry.id === section.id);
      if (next) setState((previous) => {
        const visibleIds = new Set(previous.sections.flatMap((entry) => entry.listings.map((item) => item.listing.id)));
        return { ...previous, sections: previous.sections.map((current) => current.id !== section.id ? current : {
          ...current, nextCursor: next.nextCursor,
          listings: [...current.listings, ...next.listings.filter((item) => !visibleIds.has(item.listing.id)).map((item) => ({ ...item, sessionId: page.sessionId }))],
        }) };
      });
    } catch { setActionError("More listings could not be loaded. Please try again."); }
    finally { setLoadingSection(null); }
  }

  async function dismiss(item: Item) {
    setHidden((previous) => [...previous, item.listing.id]);
    setUndo({ id: item.listing.id, title: item.listing.title });
    setActionError("");
    try {
      const result = await trackMarketplaceEvent({ type: "NOT_INTERESTED", listingId: item.listing.id });
      if (!result.accepted && result.reason !== "duplicate") throw new Error(result.reason);
    } catch {
      setHidden((previous) => previous.filter((id) => id !== item.listing.id));
      setUndo(null);
      setActionError("Could not update this preference. Please try again.");
    }
  }

  async function restore() {
    if (!undo) return;
    const item = undo;
    setHidden((previous) => previous.filter((id) => id !== item.id));
    setUndo(null);
    try {
      const result = await trackMarketplaceEvent({ type: "INTEREST_RESTORED", listingId: item.id });
      if (!result.accepted) throw new Error(result.reason);
    } catch {
      setHidden((previous) => [...previous, item.id]);
      setUndo(item);
      setActionError("Could not restore this preference. Please try again.");
    }
  }

  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <FeedSkeleton />;
  if (!user) return <div className="grid min-h-[52vh] place-items-center rounded-3xl border border-gray-200 bg-white p-7 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Sparkles size={27} /></span><h2 className="mt-4 text-2xl font-bold">Make TAKEME yours</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--takeme-gray)]">Sign in, explore listings and save what you like. Your recommendations will improve from real marketplace activity.</p><Link href="/login?next=/for-you" className="button-primary mt-6 h-12 px-6"><LogIn size={17} /> Sign in</Link></div></div>;

  return <div>
    {!state.loading && !state.error && !state.personalized && <div className="mb-6 flex items-start gap-3 rounded-2xl bg-[var(--takeme-light-green)] p-4 text-sm leading-6 text-[var(--takeme-dark-green)]"><Compass size={19} className="mt-0.5 shrink-0" /><p><strong>Start exploring to personalize your feed.</strong> These picks are from active listings and real recent interest. Your searches, saves and browsing will shape future picks.</p></div>}
    {undo && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm"><span className="min-w-0 truncate">You’ll see less of {undo.title}.</span><button type="button" onClick={() => void restore()} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 font-semibold text-[var(--takeme-dark-green)]"><RotateCcw size={16} /> Undo</button></div>}
    {actionError && <p role="alert" className="mb-4 text-sm text-red-700">{actionError}</p>}
    {state.error ? <div><ErrorState message={state.error} /><button type="button" onClick={() => { setState(initialState); setRetry((value) => value + 1); }} className="button-secondary mt-4 h-11 px-5"><LoaderCircle size={16} /> Try again</button></div>
      : state.loading ? <FeedSkeleton />
      : state.sections.length ? <div className="space-y-9 md:space-y-12">{state.sections.map((section) => {
        const visible = section.listings.filter((item) => !hidden.includes(item.listing.id));
        if (!visible.length && !section.nextCursor) return null;
        return <section key={section.id} aria-labelledby={`discovery-${section.id}`}>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 id={`discovery-${section.id}`} className="text-xl font-bold tracking-tight sm:text-2xl">{section.title}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{section.reason}</p></div>{section.id === "just_listed" && <Link href="/explore" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--takeme-dark-green)]">Explore all <ArrowRight size={16} /></Link>}</div>
          <div className="banner-track -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">{visible.map((item) => <div key={item.listing.id} className="w-[min(44vw,230px)] shrink-0 snap-start md:w-auto"><ListingCard listing={item.listing} recommendationSource={item.candidateSource} recommendationSessionId={item.sessionId} sizes="(max-width: 767px) 44vw, (max-width: 1023px) 33vw, 25vw" /><button type="button" onClick={() => void dismiss(item)} className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-[var(--takeme-gray)] hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--takeme-dark-green)]" aria-label={`Not interested in ${item.listing.title}`}><ThumbsDown size={14} /> Not interested</button></div>)}</div>
          {section.nextCursor && <button type="button" disabled={loadingSection !== null} onClick={() => void loadMore(section)} className="button-secondary mt-2 min-h-11 px-5">{loadingSection === section.id && <LoaderCircle size={16} className="animate-spin" />} Show more {section.title.toLowerCase()}</button>}
        </section>;
      })}</div>
      : <div><EmptyState title="No discoveries yet" description="There are no active listings to recommend right now. Explore the marketplace or be the first to list something." /><Link href="/explore" className="button-primary mt-4 h-11 px-5">Explore listings</Link></div>}
  </div>;
}

function FeedSkeleton() {
  return <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} />)}</div>;
}
