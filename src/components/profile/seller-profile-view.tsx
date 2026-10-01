"use client";

import { CalendarDays, MapPin, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import { ReputationView } from "@/components/profile/reputation-view";
import { ReportAction } from "@/components/trust/report-action";
import { FollowSellerButton } from "@/components/profile/follow-seller-button";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getListingsBySeller } from "@/lib/services/listings";
import { getUserProfile } from "@/lib/services/users";
import { getPublicSellerSummary } from "@/lib/services/public-sellers";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import type { Listing, UserProfile } from "@/types/marketplace";

export function SellerProfileView({ uid }: { uid: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; profile: UserProfile | null; listings: Listing[]; error: string }>({ loading: true, profile: null, listings: [], error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    const safeProfile = getUserProfile(uid).catch(async () => {
      // Legacy profiles with non-general location fields are deliberately
      // denied whole-document reads; use the existing safe seller projection.
      const summary = await getPublicSellerSummary(uid);
      return summary ? { uid, displayName: summary.displayName, photoURL: summary.photoURL, location: "", createdAt: summary.memberSince ?? "", updatedAt: "" } : null;
    });
    Promise.all([safeProfile, getListingsBySeller(uid)]).then(([profile, listings]) => { if (active) setState({ loading: false, profile, listings, error: "" }); }).catch((error: unknown) => { if (active) setState({ loading: false, profile: null, listings: [], error: error instanceof Error ? error.message : "Seller profile could not be loaded." }); });
    return () => { active = false; };
  }, [uid, retry]);
  useEffect(() => { if (user && user.uid !== uid && state.profile) trackMarketplaceIntent({ type: "SELLER_VIEW", targetId: uid, context: "profile" }); }, [user, uid, state.profile]);

  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  if (state.loading) return <div><div className="min-h-56 animate-pulse rounded-3xl bg-stone-100" /><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div></div>;
  if (state.error) return <div role="alert"><ErrorState message="This seller profile could not be loaded. Please try again." /><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setRetry((value) => value + 1); }}>Retry seller profile</button></div>;
  if (!state.profile) return <EmptyState title="Seller not found" description="This profile is unavailable." />;
  const profile = state.profile;
  return <div><section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--takeme-shadow-sm)]"><div className="h-28 bg-[linear-gradient(120deg,var(--takeme-charcoal),var(--takeme-dark-green))]" /><div className="px-5 pb-7 sm:px-8"><div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end"><div className="relative grid size-22 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]">{profile.photoURL ? <Image src={profile.photoURL} alt={profile.displayName} fill sizes="88px" className="object-cover" /> : <UserRound size={34} />}</div><div><h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1><p className="mt-1 text-sm text-[var(--takeme-gray)]">TAKEME seller</p></div></div><div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--takeme-gray)]">{profile.location && <Meta icon={<MapPin size={17} />} text={profile.location} />}{profile.createdAt && <Meta icon={<CalendarDays size={17} />} text={`Member since ${new Date(profile.createdAt).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}`} />}</div><div className="mt-5"><FollowSellerButton sellerId={uid} />{user?.uid !== uid && <ReportAction targetType="user" targetId={uid} label="Report seller" />}</div></div></section><ReputationView uid={uid} publicSellerOnly /><section className="mt-8"><h2 className="text-xl font-bold">Active listings</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{state.listings.length} currently available</p>{state.listings.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">{state.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="mt-5"><EmptyState title="No active listings" description="This seller hasn’t listed anything available right now." /></div>}</section></div>;
}
function Meta({ icon, text }: { icon: React.ReactNode; text: string }) { return <p className="flex min-w-0 items-center gap-2 rounded-2xl bg-[var(--takeme-light-green)] px-4 py-3 text-[var(--takeme-dark-green)]"><span aria-hidden="true" className="shrink-0">{icon}</span><span className="break-words">{text}</span></p>; }
