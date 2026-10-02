"use client";

import { CalendarDays, ChevronLeft, MapPin, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { MessageSellerAction } from "@/components/messages/message-seller-action";
import { FollowSellerButton } from "@/components/profile/follow-seller-button";
import { ProfileAvatar, ProfileEmpty, VerifiedLabel } from "@/components/profile/profile-ui";
import { SellerReviews } from "@/components/profile/seller-reviews";
import { ReportAction } from "@/components/trust/report-action";
import { ActionSheet } from "@/components/ui/action-sheet";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState, ListingSkeleton } from "@/components/ui/states";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { formatPublicLocation, parseLegacyGeneralLocation, parsePublicLocation } from "@/lib/general-location";
import { auctionListing } from "@/lib/profile-presentation";
import { getListingsBySeller } from "@/lib/services/listings";
import { clearPublicSellerSummaryCache, getPublicSellerSummary } from "@/lib/services/public-sellers";
import { trackMarketplaceIntent } from "@/lib/services/intelligence";
import type { Listing, PublicSellerSummary } from "@/types/marketplace";

export function SellerProfileView({ uid }: { uid: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ uid: string; profile: PublicSellerSummary | null; listings: Listing[]; error: string }>({ uid: "", profile: null, listings: [], error: "" });
  const [tab, setTab] = useState<"listings" | "auctions" | "reviews">("listings");
  const [chat, setChat] = useState(false);
  const [chatListing, setChatListing] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    // Public projections only, even when the signed-in viewer owns this profile.
    Promise.all([getPublicSellerSummary(uid), getListingsBySeller(uid)])
      .then(([profile, listings]) => { if (active) setState({ uid, profile, listings, error: "" }); })
      .catch(() => { if (active) setState({ uid, profile: null, listings: [], error: "This seller profile could not be loaded. Please try again." }); });
    return () => { active = false; };
  }, [uid, retry]);
  useEffect(() => { if (user && user.uid !== uid && state.uid === uid && state.profile) trackMarketplaceIntent({ type: "SELLER_VIEW", targetId: uid, context: "profile" }); }, [user, uid, state.uid, state.profile]);
  if (!isFirebaseConfigured) return <FirebaseSetupState />;
  if (state.uid !== uid) return <div role="status" aria-label="Loading seller profile"><div className="min-h-56 animate-pulse rounded-2xl bg-gray-100" /><div className="seller-product-grid mt-5">{Array.from({ length: 4 }, (_, index) => <ListingSkeleton key={index} />)}</div></div>;
  if (state.error) return <div role="alert"><ErrorState message={state.error} /><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => { setState((value) => ({ ...value, uid: "" })); setRetry((value) => value + 1); }}>Retry seller profile</button></div>;
  if (!state.profile) return <><ProfileEmpty title="Seller unavailable" description="This seller's public profile could not be loaded." /><button type="button" className="button-secondary min-h-11 px-5" onClick={() => { clearPublicSellerSummaryCache(); setState((value) => ({ ...value, uid: "" })); setRetry((value) => value + 1); }}>Retry seller profile</button></>;
  const seller = state.profile;
  const auctions = state.listings.filter(auctionListing);
  const shown = tab === "auctions" ? auctions : state.listings;
  const area = state.listings.map((item) => parsePublicLocation(item.publicLocation) ?? parseLegacyGeneralLocation(item.location)).find(Boolean);
  return <div className="seller-storefront">
    <div className="profile-page-title"><Link href="/explore" className="icon-button" aria-label="Back to Explore"><ChevronLeft size={21} /></Link><p>{seller.displayName}</p><span className="size-11" /></div>
    {tab !== "reviews" && <><div className="seller-cover" aria-hidden="true" /><section className="seller-identity"><ProfileAvatar photo={seller.photoURL} size={80} /><h1>{seller.displayName}</h1><div className="seller-rating-line"><p className="profile-rating"><Star size={15} aria-hidden="true" />{seller.sellerRating?.toFixed(1) ?? "Not rated"} <span>({seller.sellerReviewCount} reviews)</span></p><VerifiedLabel verified={seller.verificationStatus === "verified"} seller /></div><div className="profile-general-meta">{seller.memberSince && <span><CalendarDays size={13} aria-hidden="true" />Joined {new Date(seller.memberSince).toLocaleDateString("en-MY", { month: "short", year: "numeric" })}</span>}{area && <span><MapPin size={13} aria-hidden="true" />Listing area: {formatPublicLocation(area)}</span>}</div><div className="seller-trust-line"><span>{seller.sellerCompletedTransactionCount} completed sales</span>{seller.sellerTier && <span className="profile-state-badge">{seller.sellerTier} seller</span>}</div><div className="seller-actions"><FollowSellerButton sellerId={uid} />{user?.uid !== uid && state.listings.length > 0 && <button type="button" className="button-primary min-h-11 px-5" onClick={() => { setChat(true); setChatListing(state.listings.length === 1 ? state.listings[0].id : ""); }}><MessageCircle size={17} aria-hidden="true" />Chat</button>}</div>{user?.uid !== uid && <div className="seller-report"><ReportAction targetType="user" targetId={uid} label="Report seller" /></div>}</section></>}
    {tab === "reviews" && <h1 className="sr-only">{seller.displayName} seller reviews</h1>}
    <div className="seller-tabs banner-track" role="group" aria-label="Seller profile sections"><button type="button" aria-pressed={tab === "listings"} onClick={() => setTab("listings")}>Listings {state.listings.length}{state.listings.length === 50 ? "+" : ""}</button><button type="button" aria-pressed={tab === "auctions"} onClick={() => setTab("auctions")}>Auctions {auctions.length}</button><button type="button" aria-pressed={tab === "reviews"} onClick={() => setTab("reviews")}>Reviews {seller.sellerReviewCount}</button></div>
    {tab === "reviews" ? <SellerReviews key={uid} uid={uid} seller={seller} /> : <section aria-label={tab === "auctions" ? "Public auctions" : "Public listings"}>{shown.length ? <div className="seller-product-grid">{shown.map((listing) => <ListingCard key={listing.id} listing={listing} variant="discovery" />)}</div> : <ProfileEmpty title={tab === "auctions" ? "No available auctions" : "No active listings"} description="Available items from this seller will appear here." />}</section>}
    {chat && <ActionSheet title="Chat about an item" description="Messages are linked to a listing. Choose an available item to contact this seller." onClose={() => setChat(false)}><label className="form-field"><span>Listing</span><select value={chatListing} onChange={(event) => setChatListing(event.target.value)}><option value="">Choose a listing</option>{state.listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{chatListing && <MessageSellerAction listingId={chatListing} />}</ActionSheet>}
  </div>;
}
