"use client";

import { Clock3, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ListingSection } from "@/components/listings/listing-section";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getActiveListings } from "@/lib/services/listings";
import type { Listing } from "@/types/marketplace";

export function HomeMarketplace() {
  const [state, setState] = useState<{ loading: boolean; listings: Listing[]; error: string }>({ loading: true, listings: [], error: "" });
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    getActiveListings({ sort: "newest", pageSize: 8 }).then((page) => { if (active) setState({ loading: false, listings: page.listings, error: "" }); }).catch((error: unknown) => { if (active) setState({ loading: false, listings: [], error: error instanceof Error ? error.message : "Listings could not be loaded." }); });
    return () => { active = false; };
  }, []);

  if (!isFirebaseConfigured) return <section className="py-10"><FirebaseSetupState /></section>;
  if (state.error) return <section className="py-10"><ErrorState message={state.error.includes("index") ? "Deploy the included Firestore indexes to load the marketplace." : state.error} /></section>;
  if (state.loading) return <section className="py-10"><div className="mb-6 h-9 w-56 animate-pulse rounded-lg bg-stone-200" /><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div></section>;

  return <>
    {state.listings.length ? <ListingSection eyebrow="Fresh finds" title="Newly listed" description="The latest active listings from TAKEME sellers." listings={state.listings} /> : <section className="py-10"><p className="eyebrow">Fresh finds</p><h2 className="section-title mb-5">Newly listed</h2><EmptyState title="The marketplace is ready" description="No active listings have been published yet. Be the first seller to add one." /></section>}
    <section className="grid gap-4 pb-12 md:grid-cols-3"><FutureState icon={<Sparkles size={20} />} title="Featured listings" text="No featured placements yet." /><FutureState icon={<Clock3 size={20} />} title="Ending soon" text="Auctions arrive in Phase 3." /><FutureState icon={<MapPin size={20} />} title="Near you" text="Location-aware discovery is planned." /></section>
  </>;
}

function FutureState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)]"><span className="text-[var(--takeme-dark-green)]">{icon}</span><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-[var(--takeme-gray)]">{text}</p></div>; }
