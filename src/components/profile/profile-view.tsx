"use client";

import { CalendarDays, LoaderCircle, LogIn, MapPin, Pencil, Trash2, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { EditProfile } from "@/components/profile/edit-profile";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { deleteListing, getListingsBySeller } from "@/lib/services/listings";
import { getUserProfile } from "@/lib/services/users";
import { useCurrentTime } from "@/lib/use-current-time";
import type { Listing, UserProfile } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
type View = "current" | "past";
const isAuction = (listing: Listing) => listing.listingType !== "buy_now";
const isCurrent = (listing: Listing) => listing.status === "active";

function statusLabel(listing: Listing) {
  if (isAuction(listing)) {
    if (listing.auctionStatus === "cancelled") return "Cancelled auction";
    if (listing.auctionStatus === "ended") return "Auction ended";
    if (listing.auctionStatus === "scheduled") return "Scheduled auction";
    return "Live auction";
  }
  if (listing.status === "removed") return "Removed";
  if (listing.status === "sold") return "Sold";
  if (listing.status === "draft") return "Draft";
  return "Live listing";
}

export function ProfileView() {
  const now = useCurrentTime(30_000);
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<{ loading: boolean; profile: UserProfile | null; listings: Listing[]; error: string }>({ loading: true, profile: null, listings: [], error: "" });
  const [view, setView] = useState<View>("current");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirm, setConfirm] = useState<Listing | null>(null);
  const [removingId, setRemovingId] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>('[aria-labelledby="remove-title"] button[aria-label="Close"]')?.focus();
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape" && !removingId) setConfirm(null); }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [confirm, removingId]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserProfile(user.uid), getListingsBySeller(user.uid, true)]).then(([profile, listings]) => { if (active) setState({ loading: false, profile, listings, error: "" }); }).catch(() => { if (active) setState({ loading: false, profile: null, listings: [], error: "Your listings could not be loaded. Please try again." }); });
    return () => { active = false; };
  }, [user]);

  if (!configured) return <FirebaseSetupState />;
  if (authLoading || (user && state.loading)) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="grid min-h-[55vh] place-items-center rounded-3xl border border-gray-200 bg-white p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><UserRound size={28} /></div><h1 className="mt-5 text-2xl font-bold">Your marketplace profile</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--takeme-gray)]">Log in to view and manage your listings.</p><Link href="/login?next=/profile" className="button-primary mt-6 h-12 px-6"><LogIn size={17} /> Log in</Link></div></div>;
  if (state.error) return <ErrorState message={state.error} />;
  const profile = state.profile;
  const current = state.listings.filter(isCurrent);
  const past = state.listings.filter((listing) => !isCurrent(listing));
  const shown = (view === "current" ? current : past).filter((listing) => statusFilter === "all" || statusFilter === "fixed" && !isAuction(listing) || statusFilter === "live" && listing.auctionStatus === "active" || statusFilter === "scheduled" && listing.auctionStatus === "scheduled" || statusFilter === "ended" && listing.auctionStatus === "ended" || statusFilter === "cancelled" && listing.auctionStatus === "cancelled" || statusFilter === "removed" && listing.status === "removed");

  async function remove() {
    if (!confirm || !user) return;
    const id = confirm.id;
    setRemovingId(id); setActionError("");
    try {
      await deleteListing(id);
      const listings = await getListingsBySeller(user.uid, true);
      setState((currentState) => ({ ...currentState, listings }));
      setConfirm(null);
    } catch (error) { setActionError(error instanceof Error ? error.message : "This listing could not be changed. Please try again."); }
    finally { setRemovingId(""); }
  }

  return <div>
    {profile && <div className="mb-5"><EditProfile key={profile.updatedAt} profile={profile} onSaved={(updated) => setState((currentState) => ({ ...currentState, profile: updated }))} /></div>}
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--takeme-shadow-sm)]"><div className="h-28 bg-[linear-gradient(120deg,var(--takeme-charcoal),var(--takeme-dark-green))]" /><div className="px-5 pb-6 sm:px-8"><div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end"><div className="relative grid size-22 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]">{profile?.photoURL ? <Image src={profile.photoURL} alt="" fill sizes="88px" className="object-cover" /> : <UserRound size={34} />}</div><div className="flex-1"><h1 className="text-2xl font-bold tracking-tight">{profile?.displayName || user.displayName || "TAKEME member"}</h1><p className="text-sm text-[var(--takeme-gray)]">{user.email}</p></div></div><div className="mt-6 grid gap-3 text-sm text-[var(--takeme-gray)] sm:grid-cols-2">{profile?.location && <ProfileMeta icon={<MapPin size={17} />} text={profile.location} />}<ProfileMeta icon={<CalendarDays size={17} />} text={`Member since ${new Date(profile?.createdAt ?? user.metadata.creationTime ?? new Date(0).toISOString()).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}`} /></div></div></section>
    <section className="mt-8"><div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">My Listings</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">Manage your live listings and review past items.</p></div><Link href="/sell" className="button-primary h-11 px-5">Create listing</Link></div>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Listing status"><button onClick={() => { setView("current"); setStatusFilter("all"); }} aria-pressed={view === "current"} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === "current" ? "bg-[var(--takeme-dark-green)] text-white" : "border border-gray-200 bg-white text-stone-600"}`}>Current ({current.length})</button><button onClick={() => { setView("past"); setStatusFilter("all"); }} aria-pressed={view === "past"} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === "past" ? "bg-[var(--takeme-dark-green)] text-white" : "border border-gray-200 bg-white text-stone-600"}`}>Past ({past.length})</button><label className="select-label ml-auto w-full sm:w-48"><span className="sr-only">Filter my listings</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All {view} listings</option>{view === "current" ? <><option value="fixed">Fixed-price listings</option><option value="live">Live auctions</option><option value="scheduled">Scheduled auctions</option></> : <><option value="ended">Ended auctions</option><option value="cancelled">Cancelled auctions</option><option value="removed">Removed listings</option></>}</select></label></div>
      {actionError && <div className="mb-4" role="alert"><ErrorState message={actionError} /></div>}
      {shown.length ? <div className="grid gap-3">{shown.map((listing) => <MyListingRow key={listing.id} listing={listing} now={now} onRemove={() => setConfirm(listing)} />)}</div> : <EmptyState title={statusFilter === "all" ? view === "current" ? "No current listings" : "No past listings" : "Nothing in this group"} description={statusFilter === "all" ? view === "current" ? "Publish your first item or auction to start selling." : "Ended, cancelled and removed listings will appear here." : "Choose another status to see your listings."} />}
    </section>
    {confirm && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !removingId) setConfirm(null); }}><section role="dialog" aria-modal="true" aria-labelledby="remove-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><h2 id="remove-title" className="text-xl font-bold">{isAuction(confirm) ? "Cancel this auction?" : "Remove this listing?"}</h2><button className="icon-button" aria-label="Close" disabled={Boolean(removingId)} onClick={() => setConfirm(null)}><X size={20} /></button></div><p className="mt-3 text-sm leading-6 text-[var(--takeme-gray)]">{isAuction(confirm) ? "An auction can only be cancelled before any bids. It will move to Past listings." : "The item will leave the public marketplace and move to Past listings."}</p>{actionError && <p className="mt-4 text-sm text-red-700" role="alert">{actionError}</p>}<div className="mt-6 flex gap-3"><button className="button-secondary h-11 flex-1" disabled={Boolean(removingId)} onClick={() => setConfirm(null)}>Keep it</button><button className="button-primary h-11 flex-1" disabled={Boolean(removingId)} onClick={() => void remove()}>{removingId && <LoaderCircle size={17} className="animate-spin" />}{isAuction(confirm) ? "Cancel auction" : "Remove listing"}</button></div></section></div>}
  </div>;
}

function MyListingRow({ listing, now, onRemove }: { listing: Listing; now: number; onRemove: () => void }) {
  const auction = isAuction(listing);
  const editable = listing.status === "active" && (!auction || (listing.auctionStatus === "scheduled" && (listing.bidCount ?? 0) === 0 && Boolean(listing.auctionStartAt && now < new Date(listing.auctionStartAt).getTime())));
  const removable = listing.status === "active" && (!auction || ((listing.bidCount ?? 0) === 0 && !["ended", "cancelled"].includes(listing.auctionStatus ?? "")));
  const amount = auction ? ((listing.bidCount ?? 0) > 0 ? listing.currentBid ?? 0 : listing.startingBid ?? 0) / 100 : listing.price;
  return <article className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-[var(--takeme-shadow-sm)] sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4"><Link href={`/listings/${listing.id}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:size-24">{listing.imageUrls[0] && <Image src={listing.imageUrls[0]} alt={listing.title} fill sizes="96px" className="object-cover" />}</Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${listing.status === "active" ? "bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]" : "bg-gray-100 text-[var(--takeme-gray)]"}`}>{statusLabel(listing)}</span><span className="text-xs text-gray-500">{auction ? `Auction · ${listing.bidCount ?? 0} ${(listing.bidCount ?? 0) === 1 ? "bid" : "bids"}` : "Fixed price"}</span></div><Link href={`/listings/${listing.id}`} className="mt-1 block truncate font-semibold text-[var(--takeme-charcoal)]">{listing.title}</Link><p className="mt-1 text-sm font-bold">{money.format(amount)}</p>{auction && listing.auctionEndAt && <p className="mt-1 text-xs text-stone-500">{listing.auctionStatus === "scheduled" ? "Starts" : listing.auctionStatus === "active" ? "Ends" : "Ended"} {new Date(listing.auctionStatus === "scheduled" && listing.auctionStartAt ? listing.auctionStartAt : listing.auctionEndAt).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>}</div><div className="col-start-2 flex gap-1 sm:col-auto">{editable && <Link href={`/listings/${listing.id}/edit`} className="icon-button border border-gray-200" aria-label={`Edit ${listing.title}`}><Pencil size={17} /></Link>}{removable && <button onClick={onRemove} className="icon-button border border-red-100 text-red-600 hover:bg-red-50" aria-label={`${auction ? "Cancel" : "Remove"} ${listing.title}`}><Trash2 size={17} /></button>}</div></article>;
}
function ProfileMeta({ icon, text }: { icon: React.ReactNode; text: string }) { return <p className="flex items-center gap-2 rounded-xl bg-stone-50 p-3">{icon}{text}</p>; }
