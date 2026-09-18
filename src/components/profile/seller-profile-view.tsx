"use client";

import { CalendarDays, MapPin, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getListingsBySeller } from "@/lib/services/listings";
import { getUserProfile } from "@/lib/services/users";
import type { Listing, UserProfile } from "@/types/marketplace";

export function SellerProfileView({ uid }: { uid: string }) {
  const [state, setState] = useState<{ loading: boolean; profile: UserProfile | null; listings: Listing[]; error: string }>({ loading: true, profile: null, listings: [], error: "" });
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    Promise.all([getUserProfile(uid), getListingsBySeller(uid)]).then(([profile, listings]) => { if (active) setState({ loading: false, profile, listings, error: "" }); }).catch((error: unknown) => { if (active) setState({ loading: false, profile: null, listings: [], error: error instanceof Error ? error.message : "Seller profile could not be loaded." }); });
    return () => { active = false; };
  }, [uid]);

  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  if (state.loading) return <div><div className="min-h-56 animate-pulse rounded-3xl bg-stone-100" /><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div></div>;
  if (state.error) return <ErrorState message={state.error} />;
  if (!state.profile) return <EmptyState title="Seller not found" description="This profile is unavailable." />;
  const profile = state.profile;
  return <div><section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--takeme-shadow-sm)]"><div className="h-28 bg-[linear-gradient(120deg,var(--takeme-charcoal),var(--takeme-dark-green))]" /><div className="px-5 pb-7 sm:px-8"><div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end"><div className="relative grid size-22 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]">{profile.photoURL ? <Image src={profile.photoURL} alt={profile.displayName} fill sizes="88px" className="object-cover" /> : <UserRound size={34} />}</div><div><h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1><p className="mt-1 text-sm text-[var(--takeme-gray)]">TAKEME seller</p></div></div><div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--takeme-gray)]">{profile.location && <Meta icon={<MapPin size={17} />} text={profile.location} />}<Meta icon={<CalendarDays size={17} />} text={`Member since ${new Date(profile.createdAt).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}`} /></div></div></section><section className="mt-8"><h2 className="text-xl font-bold">Active listings</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{state.listings.length} currently available</p>{state.listings.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{state.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="mt-5"><EmptyState title="No active listings" description="This seller does not have anything available right now." /></div>}</section></div>;
}
function Meta({ icon, text }: { icon: React.ReactNode; text: string }) { return <p className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">{icon}{text}</p>; }
