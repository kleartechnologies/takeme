"use client";

import { CalendarDays, ChevronLeft, MapPin, Share2, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuctionPanel } from "@/components/listings/auction-panel";
import { SaveButton } from "@/components/saved/save-button";
import { ListingSection } from "@/components/listings/listing-section";
import { SimilarListings } from "@/components/listings/similar-listings";
import { ListingDealPanel } from "@/components/transactions/listing-deal-panel";
import { SellerTrustSignal } from "@/components/profile/seller-trust-signal";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState, ListingSkeleton } from "@/components/ui/states";
import { getCategoryName } from "@/data/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getListingsBySeller, subscribeToListing } from "@/lib/services/listings";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import { getUserProfile } from "@/lib/services/users";
import { useCurrentTime } from "@/lib/use-current-time";
import type { Listing, UserProfile } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
const senMoney = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ListingDetailView({ id, created = false }: { id: string; created?: boolean }) {
  const now = useCurrentTime();
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; listing: Listing | null; seller: UserProfile | null; related: Listing[]; error: string }>({ loading: true, listing: null, seller: null, related: [], error: "" });
  const [selectedImage, setSelectedImage] = useState(0);
  const [shareMessage, setShareMessage] = useState("");
  const trackedView = useRef("");

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
    const url = window.location.origin + `/listings/${state.listing.id}`;
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
    const unsubscribe = subscribeToListing(id, async (listing) => {
      if (!active) return;
      if (!listing) { setState({ loading: false, listing: null, seller: null, related: [], error: "not-found" }); return; }
      if (contextSeller === listing.sellerId) {
        setState((current) => ({ ...current, loading: false, listing, error: "" }));
        return;
      }
      contextSeller = listing.sellerId;
      try {
        const [seller, related] = await Promise.all([getUserProfile(listing.sellerId), getListingsBySeller(listing.sellerId)]);
        if (active) setState({ loading: false, listing, seller, related: related.filter((item) => item.id !== listing.id), error: "" });
      } catch (error) {
        if (active) setState({ loading: false, listing: null, seller: null, related: [], error: firebaseErrorMessage(error) });
      }
    }, (error) => { if (active) setState({ loading: false, listing: null, seller: null, related: [], error: firebaseErrorMessage(error) }); });
    return () => { active = false; unsubscribe(); };
  }, [id]);

  if (!isFirebaseConfigured) return <main className="page-shell py-10"><FirebaseSetupState /></main>;
  if (state.loading) return <main className="page-shell py-10"><div className="grid gap-7 lg:grid-cols-[1.35fr_0.85fr]"><ListingSkeleton /><div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" /></div></main>;
  if (state.error === "not-found") return <NotFoundState />;
  if (state.error) return <main className="page-shell py-10"><ErrorState message={state.error === "permission-denied" ? "This listing is unavailable or you do not have permission to view it." : state.error} /></main>;
  const listing = state.listing!;
  const owner = user?.uid === listing.sellerId;
  const isAuction = listing.listingType === "auction" || listing.listingType === "buy_now_and_auction";
  const auctionEditable = isAuction && listing.auctionStatus === "scheduled" && (listing.bidCount ?? 0) === 0 && Boolean(listing.auctionStartAt && (now === 0 || now < new Date(listing.auctionStartAt).getTime()));
  const displayAmount = isAuction ? senMoney.format(((listing.bidCount ?? 0) > 0 ? listing.currentBid ?? 0 : listing.startingBid ?? 0) / 100) : money.format(listing.price);

  return (
    <main className="page-shell py-6 md:py-10">
      <Link href="/explore" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--takeme-gray)] hover:text-[var(--takeme-dark-green)]"><ChevronLeft size={17} /> Back to explore</Link>
      {created && listing.status === "active" && <div className="mb-5 flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--takeme-green)]/25 bg-[var(--takeme-light-green)] px-4 py-3"><Image src="/brand/mascot-2d-excited.png" alt="" width={80} height={68} className="h-16 w-auto shrink-0 object-contain" /><div><p className="font-semibold text-[var(--takeme-dark-green)]">Your {isAuction ? "auction is published" : "listing is live"}</p><p className="mt-0.5 text-sm text-[var(--takeme-gray)]">{isAuction && listing.auctionStatus === "scheduled" ? "Buyers can discover it now; bidding opens at the scheduled start time." : "It now appears in the active TAKEME marketplace."}</p></div></div>}
      {!['active', 'ended', 'sold'].includes(listing.status) && <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-100 p-4 text-sm font-semibold text-[var(--takeme-charcoal)]">This listing is {listing.status} and is only visible to its owner.</div>}
      <div className="grid gap-7 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="lg:col-start-1 lg:row-start-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-stone-100">{listing.imageUrls[0] && <Image src={listing.imageUrls[selectedImage] ?? listing.imageUrls[0]} alt={listing.title} fill priority sizes="(max-width:1024px) 100vw, 65vw" className="object-cover" />}</div>
          {listing.imageUrls.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">{listing.imageUrls.map((url, index) => <button key={url} onClick={() => setSelectedImage(index)} className={`relative aspect-square overflow-hidden rounded-xl border-2 ${selectedImage === index ? "border-[var(--takeme-green)]" : "border-transparent"}`} aria-label={`Show image ${index + 1}`}><Image src={url} alt="" fill sizes="100px" className="object-cover" /></button>)}</div>}
        </section>
        <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-md)] sm:p-7 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--takeme-light-green)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--takeme-dark-green)]">{isAuction ? "Auction" : "Fixed price"}</span><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-[var(--takeme-gray)]">{listing.condition}</span></div>
          <h1 className="mt-5 text-2xl font-bold leading-tight tracking-[-0.035em] sm:text-3xl">{listing.title}</h1>
          <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--takeme-charcoal)]">{displayAmount}</p>
          {isAuction && <p className="mt-1 text-xs font-semibold text-[var(--takeme-dark-green)]">{(listing.bidCount ?? 0) > 0 ? "Current bid" : "Starting bid"}</p>}
          <Link href={`/sellers/${listing.sellerId}`} className="mt-5 flex min-h-14 items-center gap-3 rounded-xl bg-stone-50 p-2"><span className="relative grid size-11 place-items-center overflow-hidden rounded-full bg-white">{state.seller?.photoURL ? <Image src={state.seller.photoURL} alt="" fill sizes="44px" className="object-cover" /> : <UserRound size={20} />}</span><div><p className="text-sm font-bold">{state.seller?.displayName ?? "TAKEME seller"}</p><p className="text-xs text-stone-500">View seller profile</p></div></Link>
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--takeme-gray)]"><MapPin size={17} className="text-[var(--takeme-dark-green)]" />{listing.location}</p>
          {isAuction ? <AuctionPanel listing={listing} userId={user?.uid} owner={owner} /> : <ListingDealPanel listing={listing} userId={user?.uid} />}
          {owner && (!isAuction || auctionEditable) && <Link href={`/listings/${listing.id}/edit`} className="button-secondary mt-3 h-12 w-full">Edit your listing</Link>}
          {owner && listing.status === "active" && (!isAuction || (now > 0 && ["active", "scheduled"].includes(listing.auctionStatus ?? "") && Boolean(listing.auctionEndAt && new Date(listing.auctionEndAt).getTime() > now))) && <div className="mt-3 grid grid-cols-2 gap-2"><Link href={`/listings/${listing.id}/promote?type=boost`} className="button-secondary min-h-12 px-3 text-xs"><Sparkles size={16} /> Boost listing</Link><Link href={`/listings/${listing.id}/promote?type=featured`} className="button-secondary min-h-12 px-3 text-xs"><Star size={16} /> Featured</Link></div>}
          {!owner && listing.status === "active" && <SaveButton listingId={listing.id} />}
          <button type="button" onClick={() => void share()} className="button-secondary mt-3 min-h-12 w-full"><Share2 size={18} /> Share listing</button>
          {shareMessage && <p role="status" className="mt-2 text-xs text-[var(--takeme-gray)]">{shareMessage}</p>}
          <SellerTrustSignal uid={listing.sellerId} />
          <div className="mt-5 grid gap-2 text-xs leading-5 text-[var(--takeme-gray)]"><p className="flex gap-2"><ShieldCheck size={16} className="shrink-0 text-[var(--takeme-dark-green)]" /> {isAuction ? "Bids and results are validated by trusted server logic. An auction win is not a completed exchange or payment." : "TAKEME checkout is not active. Record only a deal you genuinely intend to complete; arrange payment safely with the other party."}</p><p className="flex gap-2"><CalendarDays size={16} className="shrink-0" /> Listed {new Date(listing.createdAt).toLocaleDateString("en-MY")}</p></div>
        </aside>
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] sm:p-7 lg:col-start-1 lg:row-start-2"><h2 className="text-xl font-bold">About this item</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-[var(--takeme-gray)]">{listing.description}</p><div className="mt-6 grid grid-cols-2 gap-5 border-t border-gray-100 pt-6 text-sm"><Fact label="Condition" value={listing.condition} /><Fact label="Category" value={getCategoryName(listing.categoryId)} /><Fact label="Listing type" value={isAuction ? "Auction" : "Fixed price"} /><Fact label="Status" value={listing.auctionStatus === "scheduled" ? "Scheduled" : listing.auctionStatus === "cancelled" ? "Cancelled" : listing.status === "active" ? "Live" : listing.status === "ended" ? "Ended" : listing.status === "removed" ? "Removed" : listing.status === "sold" ? "Sold" : "Draft"} /><Fact label="Published" value={new Date(listing.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })} /></div></section>
      </div>
      {state.related.length > 0 && <div className="mt-6"><ListingSection title="More from this seller" listings={state.related} /></div>}
      {listing.status === "active" && <SimilarListings listing={listing} />}
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold text-stone-400">{label}</p><p className="mt-1 capitalize font-bold text-stone-700">{value}</p></div>; }
function NotFoundState() { return <main className="page-shell grid min-h-[55vh] place-items-center py-10 text-center"><div><Image src="/brand/mascot-2d-wink.png" alt="" width={132} height={110} className="mx-auto h-28 w-auto object-contain" /><h1 className="mt-3 text-3xl font-bold">Listing not found</h1><p className="mt-2 text-[var(--takeme-gray)]">It may have been removed or the link is incorrect.</p><Link href="/explore" className="button-primary mt-6 h-11 px-6">Explore active listings</Link></div></main>; }
function firebaseErrorMessage(error: unknown) { if (typeof error === "object" && error && "code" in error && String(error.code).includes("permission-denied")) return "permission-denied"; return "We couldn’t load this listing. Please try again."; }
