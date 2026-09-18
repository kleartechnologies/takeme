"use client";

import { CalendarDays, LoaderCircle, LogIn, MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { deleteListing, getListingsBySeller } from "@/lib/services/listings";
import { getUserProfile } from "@/lib/services/users";
import type { Listing, UserProfile } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

export function ProfileView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<{ loading: boolean; profile: UserProfile | null; listings: Listing[]; error: string }>({ loading: true, profile: null, listings: [], error: "" });
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserProfile(user.uid), getListingsBySeller(user.uid, true)]).then(([profile, listings]) => { if (active) setState({ loading: false, profile, listings, error: "" }); }).catch((error: unknown) => { if (active) setState({ loading: false, profile: null, listings: [], error: error instanceof Error ? error.message : "Your listings could not be loaded." }); });
    return () => { active = false; };
  }, [user]);

  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="grid min-h-[55vh] place-items-center rounded-3xl border border-gray-200 bg-white p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><UserRound size={28} /></div><h1 className="mt-5 text-2xl font-bold">Your marketplace profile</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--takeme-gray)]">Log in to view and manage your listings.</p><Link href="/login" className="button-primary mt-6 h-12 px-6"><LogIn size={17} /> Log in</Link></div></div>;
  if (state.loading) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (state.error) return <ErrorState message={state.error.includes("index") ? "Deploy the included Firestore indexes to load your listings." : state.error} />;
  const profile = state.profile;
  const activeCount = state.listings.filter((listing) => listing.status === "active").length;
  const removedCount = state.listings.filter((listing) => listing.status === "removed").length;

  async function remove(id: string) {
    if (!window.confirm("Remove this listing from the public marketplace? This keeps the record for future history.")) return;
    setRemovingId(id);
    try { await deleteListing(id); setState((current) => ({ ...current, listings: current.listings.map((listing) => listing.id === id ? { ...listing, status: "removed" } : listing) })); }
    catch (error) { setState((current) => ({ ...current, error: error instanceof Error ? error.message : "Listing could not be removed." })); }
    finally { setRemovingId(""); }
  }

  return <div><section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--takeme-shadow-sm)]"><div className="h-28 bg-[linear-gradient(120deg,var(--takeme-charcoal),var(--takeme-dark-green))]" /><div className="px-5 pb-6 sm:px-8"><div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end"><div className="relative grid size-22 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]">{profile?.photoURL ? <Image src={profile.photoURL} alt="" fill sizes="88px" className="object-cover" /> : <UserRound size={34} />}</div><div className="flex-1"><h1 className="text-2xl font-bold tracking-tight">{profile?.displayName || user.displayName || "TAKEME member"}</h1><p className="text-sm text-[var(--takeme-gray)]">{user.email}</p></div></div><div className="mt-6 grid gap-3 text-sm text-[var(--takeme-gray)] sm:grid-cols-2">{profile?.location && <ProfileMeta icon={<MapPin size={17} />} text={profile.location} />}<ProfileMeta icon={<CalendarDays size={17} />} text={`Member since ${new Date(profile?.createdAt ?? user.metadata.creationTime ?? Date.now()).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}`} /></div></div></section><div className="mt-6 grid grid-cols-2 gap-3"><Stat value={String(activeCount)} label="Active listings" /><Stat value={String(removedCount)} label="Removed" /></div><section className="mt-8"><div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">My Listings</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">Manage published and removed items.</p></div><Link href="/sell" className="button-primary h-10 px-4">Create listing</Link></div>{state.listings.length ? <div className="grid gap-3">{state.listings.map((listing) => <MyListingRow key={listing.id} listing={listing} removing={removingId === listing.id} onRemove={() => void remove(listing.id)} />)}</div> : <EmptyState title="No listings yet" description="Publish your first item and it will appear here." />}</section></div>;
}

function MyListingRow({ listing, removing, onRemove }: { listing: Listing; removing: boolean; onRemove: () => void }) { return <article className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-[var(--takeme-shadow-sm)] sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4"><Link href={`/listings/${listing.id}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:size-24"><Image src={listing.imageUrls[0]} alt={listing.title} fill sizes="96px" className="object-cover" /></Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${listing.status === "active" ? "bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]" : "bg-gray-100 text-[var(--takeme-gray)]"}`}>{listing.status}</span><span className="text-xs text-gray-400">Buy now</span></div><Link href={`/listings/${listing.id}`} className="mt-1 block truncate font-semibold text-[var(--takeme-charcoal)]">{listing.title}</Link><p className="mt-1 text-sm font-bold">{money.format(listing.price)}</p></div><div className="col-start-2 flex gap-1 sm:col-auto">{listing.status !== "removed" && <Link href={`/listings/${listing.id}/edit`} className="icon-button border border-gray-200" aria-label={`Edit ${listing.title}`}><Pencil size={17} /></Link>} {listing.status !== "removed" && <button disabled={removing} onClick={onRemove} className="icon-button border border-red-100 text-red-600 hover:bg-red-50" aria-label={`Remove ${listing.title}`}>{removing ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}</button>}</div></article>; }
function ProfileMeta({ icon, text }: { icon: React.ReactNode; text: string }) { return <p className="flex items-center gap-2 rounded-xl bg-stone-50 p-3">{icon}{text}</p>; }
function Stat({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-[var(--takeme-shadow-sm)]"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs font-medium text-[var(--takeme-gray)]">{label}</p></div>; }
