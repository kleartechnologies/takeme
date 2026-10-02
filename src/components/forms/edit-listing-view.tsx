"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { ErrorState } from "@/components/ui/states";
import { getListing } from "@/lib/services/listings";
import { useCurrentTime } from "@/lib/use-current-time";
import type { Listing } from "@/types/marketplace";
import { SellForm } from "./sell-form";

export function EditListingView({ id }: { id: string }) {
  const now = useCurrentTime();
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<{ loading: boolean; listing: Listing | null; error: string }>({ loading: true, listing: null, error: "" });
  useEffect(() => {
    if (!user) return;
    let active = true;
    getListing(id).then((listing) => { if (!active) return; if (!listing) setState({ loading: false, listing: null, error: "Listing not found." }); else if (listing.sellerId !== user.uid) setState({ loading: false, listing: null, error: "You are not allowed to edit this listing." }); else setState({ loading: false, listing, error: "" }); }).catch((error: unknown) => { if (active) setState({ loading: false, listing: null, error: permissionMessage(error) }); });
    return () => { active = false; };
  }, [id, user]);
  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in as the listing owner to edit it." next={`/listings/${id}/edit`} />;
  if (state.loading) return <div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />;
  if (state.error) return <ErrorState message={state.error} />;
  if (state.listing?.status === "removed") return <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center"><h2 className="text-2xl font-bold">This listing has been removed</h2><p className="mt-2 text-[var(--takeme-gray)]">Removed listings are retained for history and cannot be republished in Phase 2.</p><Link href="/profile" className="button-secondary mt-6 h-11 px-5">Back to My Listings</Link></div>;
  if (state.listing && !["draft", "active"].includes(state.listing.status)) return <div className="mx-auto max-w-xl p-8 text-center"><h2 className="text-2xl font-bold">This listing cannot be edited</h2><p className="mt-3 text-sm leading-6 text-[var(--takeme-gray)]">Only active listings and eligible drafts can be edited.</p><Link href="/profile/listings" className="button-secondary mt-6 min-h-11 px-5">My listings</Link></div>;
  const draftAuction = state.listing?.listingType === "auction" && state.listing.status === "draft" && state.listing.auctionStatus === "scheduled" && (state.listing.bidCount ?? 0) === 0;
  const auctionLocked = state.listing?.listingType === "auction" && !draftAuction && (state.listing.auctionStatus !== "scheduled" || (state.listing.bidCount ?? 0) > 0 || !state.listing.auctionStartAt || (now !== 0 && now >= new Date(state.listing.auctionStartAt).getTime()));
  if (auctionLocked) return <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center"><h2 className="text-2xl font-bold">Auction settings are locked</h2><p className="mx-auto mt-2 max-w-lg text-[var(--takeme-gray)]">For bidder integrity, auction details cannot be changed after bidding starts or once a bid exists.</p><Link href={`/listings/${id}`} className="button-secondary mt-6 h-11 px-5">Back to auction</Link></div>;
  return <SellForm listing={state.listing!} />;
}

function permissionMessage(error: unknown) { if (typeof error === "object" && error && "code" in error && String(error.code).includes("permission-denied")) return "This listing is unavailable or you do not have permission to edit it."; return error instanceof Error ? error.message : "Listing could not be loaded."; }
