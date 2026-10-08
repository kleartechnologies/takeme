"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePublicAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { listingCanonicalUrl } from "@/lib/listing-metadata";
import { getListingsBySeller, subscribeToListing, type PublicAuctionBid } from "@/lib/services/listings";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import type { Listing } from "@/types/marketplace";
import { StandardProductDetail } from "./standard-product-detail";

const emptyBids: PublicAuctionBid[] = [];

export function ListingDetailView({ id, initialListing = null, initialBids = emptyBids, created = false }: { id: string; initialListing?: Listing | null; initialBids?: PublicAuctionBid[]; created?: boolean }) {
  const { user, setup, loading } = usePublicAuth();
  const [state, setState] = useState<{ loading: boolean; listing: Listing | null; related: Listing[]; error: string }>({ loading: !initialListing, listing: initialListing, related: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [bids, setBids] = useState<PublicAuctionBid[]>(initialBids);
  const [shareMessage, setShareMessage] = useState("");
  const trackedView = useRef("");
  // Only a missing public snapshot may retry owner-private data after account verification.
  const privateViewer = !initialListing && !loading && setup?.step === "ready" && setup.policyAvailable === true ? user?.uid : undefined;

  useEffect(() => {
    const listing = state.listing;
    if (!user || !listing || listing.status !== "active") return;
    const key = `${user.uid}:${listing.id}:${listing.listingType}`;
    if (trackedView.current === key) return;
    trackedView.current = key;
    trackMarketplaceIntent({ type: listing.listingType === "buy_now" ? "VIEW_LISTING" : "AUCTION_VIEW", listingId: listing.id, context: "detail" });
  }, [user, state.listing]);

  async function share() {
    if (!state.listing) return;
    const url = listingCanonicalUrl(state.listing.id, process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin);
    try {
      if (navigator.share) await navigator.share({ title: state.listing.title, url });
      else { await navigator.clipboard.writeText(url); setShareMessage("Link copied"); }
      trackMarketplaceIntent({ type: "SHARE_LISTING", listingId: state.listing.id, context: "detail" });
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setShareMessage("Could not share this listing."); }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    let contextSeller = "";
    const unsubscribe = subscribeToListing(id, async (listing, nextBids) => {
      if (!active) return;
      setBids(nextBids);
      if (!listing) { setState({ loading: false, listing: null, related: [], error: "not-found" }); return; }
      if (contextSeller === listing.sellerId) {
        setState((current) => ({ ...current, loading: false, listing, error: "" }));
        return;
      }
      contextSeller = listing.sellerId;
      // Primary product content never waits for optional seller inventory.
      setState({ loading: false, listing, related: [], error: "" });
      const sellerId = listing.sellerId;
      try {
        const related = await getListingsBySeller(listing.sellerId);
        if (active && contextSeller === sellerId) setState(current => ({ ...current, related: related.filter((item) => item.id !== id) }));
      } catch {
        if (active && contextSeller === sellerId) setState(current => ({ ...current, related: [] }));
      }
    }, (error) => { if (active) setState({ loading: false, listing: null, related: [], error: firebaseErrorMessage(error) }); }, { initialListing: retry === 0 ? initialListing : null, initialBids, allowPrivate: !!privateViewer });
    return () => { active = false; unsubscribe(); };
  }, [id, initialListing, initialBids, privateViewer, retry]);

  if (!isFirebaseConfigured) return <main className="page-shell py-10"><FirebaseSetupState /></main>;
  if (state.listing && ["draft", "removed"].includes(state.listing.status) && state.listing.sellerId !== privateViewer) return <DetailSkeleton />;
  if (state.loading) return <DetailSkeleton />;
  if (state.error === "not-found") return <NotFoundState />;
  if (state.error) return <main className="page-shell grid min-h-[55vh] place-items-center py-10 text-center"><div><Image src="/brand/mascot-2d-wink.png" alt="" width={132} height={110} className="mx-auto h-28 w-auto object-contain" /><h1 className="mt-3 text-2xl font-bold">This listing isn’t available</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">{state.error === "permission-denied" ? "It may be private, sold or removed." : state.error}</p><div className="mt-5 flex justify-center gap-3"><Link href="/explore" className="button-primary min-h-11 px-5">Explore listings</Link><button type="button" className="button-secondary min-h-11 px-5" onClick={() => { setState(current => ({ ...current, loading: true, error: "" })); setRetry(value => value + 1); }}>Retry</button></div></div></main>;
  const listing = state.listing!;
  return <StandardProductDetail key={listing.id} listing={listing} related={state.related} userId={user?.uid} created={created} share={share} shareMessage={shareMessage} bids={bids} onAuctionChange={() => setRetry(value => value + 1)} />;
}

function NotFoundState() { return <main className="page-shell grid min-h-[55vh] place-items-center py-10 text-center"><div><Image src="/brand/mascot-2d-wink.png" alt="" width={132} height={110} className="mx-auto h-28 w-auto object-contain" /><h1 className="mt-3 text-2xl font-bold">This listing isn’t available</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">It may be private, sold or removed, or the link may be incorrect.</p><Link href="/explore" className="button-primary mt-6 h-11 px-6">Explore active listings</Link></div></main>; }
function firebaseErrorMessage(error: unknown) { if (typeof error === "object" && error && "code" in error && String(error.code).includes("permission-denied")) return "permission-denied"; return "We couldn’t load this listing. Please try again."; }

function DetailSkeleton() {
  return <main className="page-shell py-3 md:py-7" role="status" aria-label="Loading listing"><div aria-hidden="true" className="grid gap-5 lg:grid-cols-[1.2fr_1fr] animate-pulse"><div className="aspect-[8/5] lg:aspect-[4/3] rounded-2xl bg-stone-100" /><div className="space-y-4 p-4"><div className="h-6 w-4/5 rounded bg-stone-100" /><div className="h-9 w-2/5 rounded bg-stone-100" /><div className="h-5 w-1/4 rounded bg-stone-100" /><div className="h-12 rounded bg-stone-100" /><div className="h-28 rounded-2xl bg-stone-100" /><div className="h-12 rounded-full bg-stone-100" /></div><div className="h-40 rounded-2xl bg-stone-100" /><div className="h-40 rounded-2xl bg-stone-100" /></div></main>;
}
