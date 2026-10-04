"use client";

import { ChevronLeft, LoaderCircle, MoreVertical, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ActionSheet } from "@/components/ui/action-sheet";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState } from "@/components/ui/states";
import { ProfileEmpty } from "@/components/profile/profile-ui";
import { deleteListing, getListingsBySeller } from "@/lib/services/listings";
import { auctionTimeRemaining, discoveryPrice } from "@/lib/listing-display";
import { auctionBidLabel } from "@/lib/auction-presentation";
import { auctionListing, listingActions, listingGroup, managementStatus, type ListingGroup } from "@/lib/profile-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import type { Listing } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
export function MyListingsView({ initialTab = "active", auctionOnly = false }: { initialTab?: ListingGroup; auctionOnly?: boolean }) {
  const { user, loading: authLoading, configured } = useAuth();
  const now = useCurrentTime(30_000);
  const [state, setState] = useState<{ uid: string; items: Listing[]; error: string }>({ uid: "", items: [], error: "" });
  const [tab, setTab] = useState(initialTab);
  const [onlyAuctions, setOnlyAuctions] = useState(auctionOnly);
  const [menu, setMenu] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState<Listing | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getListingsBySeller(user.uid, true).then((items) => { if (active) setState({ uid: user.uid, items, error: "" }); }).catch(() => { if (active) setState({ uid: user.uid, items: [], error: "Your listings could not be loaded." }); });
    return () => { active = false; };
  }, [user, retry]);
  async function remove() {
    if (!confirm || !user || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await deleteListing(confirm.id); const items = await getListingsBySeller(user.uid, true); setState({ uid: user.uid, items, error: "" }); setConfirm(null); setMenu(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This listing could not be changed. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || user && state.uid !== user.uid) return <div className="min-h-64 animate-pulse rounded-2xl bg-gray-100" role="status" aria-label="Loading your listings" />;
  if (!user) return <><ProfileEmpty title="Sign in to manage listings" description="Your drafts and listing history are private." /><Link href="/login?next=/profile/listings" className="button-primary min-h-11 px-6">Log in</Link></>;
  if (state.error) return <div role="alert"><ErrorState message={state.error} /><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => setRetry((value) => value + 1)}>Retry listings</button></div>;
  const items = state.items.filter((item) => !onlyAuctions || auctionListing(item));
  const shown = items.filter((item) => listingGroup(item) === tab);
  const groups: [ListingGroup, string][] = [["active", "Active"], ["sold", "Sold"], ["drafts", "Drafts"], ["past", "Past"]];
  const actions = menu ? listingActions(menu, now) : null;
  return <div className="my-listings-view"><div className="profile-page-title"><Link href="/profile" className="icon-button" aria-label="Back to your profile"><ChevronLeft size={21} /></Link><h1>My Listings</h1><Link href="/sell" className="icon-button" aria-label="Create listing"><Plus size={21} /></Link></div>
    <div className="profile-tabs banner-track" role="group" aria-label="Listing status">{groups.map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label} <span>{items.filter((item) => listingGroup(item) === value).length}</span></button>)}</div>
    <label className="profile-auction-filter"><input type="checkbox" checked={onlyAuctions} onChange={(event) => setOnlyAuctions(event.target.checked)} /> Auctions only</label>
    {shown.length ? <div className="my-listing-rows">{shown.map((listing) => <article key={listing.id} className="my-listing-row"><Link href={`/listings/${listing.id}`} aria-label={`View ${listing.title}`} className="my-listing-thumbnail">{listing.imageUrls[0] ? <Image src={listing.imageUrls[0]} alt="" fill sizes="80px" className="object-cover" /> : <Image src="/brand/mascot-2d-happy.png" alt="" fill sizes="80px" className="object-contain p-3" />}</Link><div className="min-w-0"><Link href={`/listings/${listing.id}`} className="my-listing-name">{listing.title}</Link><p className="my-listing-price">{auctionListing(listing) && <span>{auctionBidLabel(listing, now)} </span>}{money.format(discoveryPrice(listing))}</p><p className="my-listing-meta">{auctionListing(listing) ? `${listing.bidCount ?? 0} bids` : "Fixed price"}{listing.auctionStatus === "active" && listing.auctionEndAt ? ` · ${auctionTimeRemaining(listing.auctionEndAt, now)}` : ""}</p><span className="profile-state-badge">{managementStatus(listing)}</span></div><button type="button" className="icon-button self-start" aria-label={`Actions for ${listing.title}`} onClick={() => { setMenu(listing); setError(""); }}><MoreVertical size={18} /></button></article>)}</div> : <ProfileEmpty title={`No ${tab === "past" ? "past items" : tab === "drafts" ? "drafts" : tab + " listings"}`} description="Choose another group or list something new." />}
    <Link href="/sell" className="button-primary my-listings-create"><Plus size={19} /> List a New Item</Link>
    {menu && !confirm && actions && <ActionSheet title="Listing actions" description={menu.title} onClose={() => setMenu(null)}><div className="profile-action-menu"><Link href={`/listings/${menu.id}`}>View listing</Link>{actions.editable && <Link href={`/listings/${menu.id}/edit`}>{actions.resumableDraft ? "Resume draft" : "Edit listing"}</Link>}{actions.promotable && <><Link href={`/listings/${menu.id}/promote?type=boost`}>Boost listing</Link><Link href={`/listings/${menu.id}/promote?type=featured`}>Feature listing</Link></>}{actions.removable && <button type="button" className="text-red-700" onClick={() => setConfirm(menu)}>{auctionListing(menu) ? "Cancel auction…" : "Remove listing…"}</button>}</div></ActionSheet>}
    {confirm && <ActionSheet title={auctionListing(confirm) ? "Cancel this auction?" : "Remove this listing?"} description={auctionListing(confirm) ? "An auction can only be cancelled before any bids. It will move to Past listings." : "The item will leave the public marketplace and move to Past listings."} busy={busy} onClose={() => setConfirm(null)}>{error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" className="button-secondary min-h-11 flex-1" disabled={busy} onClick={() => setConfirm(null)}>Keep it</button><button type="button" className="button-secondary profile-destructive min-h-11 flex-1" disabled={busy} onClick={() => void remove()}>{busy && <LoaderCircle size={17} className="animate-spin" />}{auctionListing(confirm) ? "Cancel auction" : "Remove listing"}</button></div></ActionSheet>}
  </div>;
}
