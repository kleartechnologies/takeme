"use client";

import { Bell, Bookmark, CalendarDays, Gavel, Heart, ListChecks, MapPin, MessageSquare, Settings, ShoppingBag, Star, Store, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { OwnerPublishedReviews, ReputationView } from "@/components/profile/reputation-view";
import { ProfileAvatar, ProfileMenuLink, VerifiedLabel } from "@/components/profile/profile-ui";
import { TransactionHistory } from "@/components/transactions/transaction-history";
import { FirebaseSetupState } from "@/components/ui/firebase-state";
import { ErrorState } from "@/components/ui/states";
import { getListingsBySeller } from "@/lib/services/listings";
import { getTrustSummary } from "@/lib/services/trust";
import { getUserProfile } from "@/lib/services/users";
import { getFollowState, getFollowing } from "@/lib/services/engagement";
import { getSavedPage } from "@/lib/services/saved";
import { getMyTransactions } from "@/lib/services/transactions";
import { auctionListing, listingGroup } from "@/lib/profile-presentation";
import type { Listing, TrustSummary, UserProfile } from "@/types/marketplace";

export function ProfileView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<{ uid: string; profile: UserProfile | null; trust: TrustSummary | null; listings: Listing[]; error: string }>({ uid: "", profile: null, trust: null, listings: [], error: "" });
  const [stats, setStats] = useState<{ uid: string; followers?: string; following?: string; saved?: string; buying?: string }>({ uid: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserProfile(user.uid), getListingsBySeller(user.uid, true), getTrustSummary(user.uid).catch(() => null)])
      .then(([profile, listings, trust]) => { if (active) setState({ uid: user.uid, profile, trust, listings, error: "" }); })
      .catch(() => { if (active) setState({ uid: user.uid, profile: null, trust: null, listings: [], error: "Your marketplace account could not be loaded. Please try again." }); });
    Promise.allSettled([getFollowState(user.uid), getFollowing(), getSavedPage(), getMyTransactions()]).then(([followers, following, saved, transactions]) => {
      if (active) setStats({ uid: user.uid,
        ...(followers.status === "fulfilled" ? { followers: String(followers.value.followerCount) } : {}),
        ...(following.status === "fulfilled" ? { following: String(following.value.items.length) + (following.value.hasMore ? "+" : "") } : {}),
        ...(saved.status === "fulfilled" ? { saved: String(saved.value.items.length) + (saved.value.hasMore ? "+" : "") } : {}),
        ...(transactions.status === "fulfilled" ? { buying: String(transactions.value.filter((item) => item.buyerId === user.uid).length) } : {}),
      });
    });
    return () => { active = false; };
  }, [user, retry]);
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || user && state.uid !== user.uid) return <div role="status" aria-label="Loading your profile" className="min-h-60 animate-pulse rounded-2xl bg-gray-100" />;
  if (!user) return <section className="profile-signed-out"><UserRound size={32} aria-hidden="true" /><h1>Your TAKEME account</h1><p>Sign in to manage your marketplace activity and private status.</p><Link href="/login?next=/profile" className="button-primary min-h-11 px-6">Log in</Link></section>;
  if (state.error) return <div role="alert"><ErrorState message={state.error} /><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => setRetry((value) => value + 1)}>Retry profile</button></div>;
  const { profile, trust, listings } = state;
  const reviewCount = (trust?.buyer.reviewCount ?? 0) + (trust?.seller.reviewCount ?? 0);
  const ratingSum = (trust?.buyer.ratingSum ?? 0) + (trust?.seller.ratingSum ?? 0);
  const accountStats = stats.uid === user.uid ? stats : null;
  const selling = listings.filter((listing) => listingGroup(listing) === "active");
  const auctions = selling.filter(auctionListing);
  const joined = profile?.createdAt || user.metadata.creationTime;
  return <div className="owner-profile">
    <section className="profile-identity" aria-label="Your account identity"><ProfileAvatar photo={profile?.photoURL || user.photoURL} /><div className="min-w-0 flex-1"><h1>{profile?.displayName || user.displayName || "TAKEME member"}</h1><VerifiedLabel verified={trust?.verificationStatus === "verified"} /><p className="profile-rating">{reviewCount ? <><Star size={14} aria-hidden="true" />{(ratingSum / reviewCount).toFixed(1)} <span>({reviewCount} reviews)</span></> : <span>No published ratings yet</span>}</p></div><Link href={"/sellers/" + user.uid} className="icon-button" aria-label="View your public seller profile">→</Link></section>
    <div className="profile-general-meta">{profile?.location && <span><MapPin size={13} aria-hidden="true" />{profile.location}</span>}{joined && <span><CalendarDays size={13} aria-hidden="true" />Joined {new Date(joined).toLocaleDateString("en-MY", { month: "short", year: "numeric" })}</span>}</div>
    <div className="profile-stats" aria-label="Your marketplace statistics">{accountStats?.followers !== undefined && <span><strong>{accountStats.followers}</strong>Followers</span>}<Link href="/following"><strong>{accountStats?.following ?? "—"}</strong>Following</Link><Link href="/saved"><strong>{accountStats?.saved ?? "—"}</strong>Saved</Link></div>
    <div className="profile-quick-cards"><Link href="/profile/transactions?role=buying"><ShoppingBag size={23} aria-hidden="true" /><strong>Buying</strong><span>{accountStats?.buying === undefined ? "View purchases" : accountStats.buying + " recent deals"}</span></Link><Link href="/profile/listings"><Store size={23} aria-hidden="true" /><strong>Selling</strong><span>{selling.length} active</span></Link><Link href="/profile/listings?type=auction"><Gavel size={23} aria-hidden="true" /><strong>Auctions</strong><span>{auctions.length} active / scheduled</span></Link></div>
    <div className="profile-dashboard"><div className="profile-account-menu"><h2 className="sr-only">Marketplace shortcuts</h2><div className="profile-menu"><ProfileMenuLink href="/profile/listings" icon={<Store size={19} />} label="My Listings" /><ProfileMenuLink href="/profile/listings?tab=drafts" icon={<ListChecks size={19} />} label="Drafts" /><ProfileMenuLink href="/profile/listings?tab=sold" icon={<ShoppingBag size={19} />} label="Sold Items" /><ProfileMenuLink href="/profile/transactions?role=buying" icon={<ShoppingBag size={19} />} label="Purchases" /><ProfileMenuLink href="/profile/transactions" icon={<ListChecks size={19} />} label="My Transactions" /><ProfileMenuLink href="/saved" icon={<Heart size={19} />} label="Saved Items" /><ProfileMenuLink href="/saved-searches" icon={<Bookmark size={19} />} label="Saved Searches" /><ProfileMenuLink href="/following" icon={<Users size={19} />} label="Following" /><ProfileMenuLink href="/messages" icon={<MessageSquare size={19} />} label="Messages" /><ProfileMenuLink href="/updates" icon={<Bell size={19} />} label="Notifications" /><OwnerPublishedReviews key={user.uid} uid={user.uid} /></div><div className="profile-menu mt-4"><ProfileMenuLink href="/profile/settings" icon={<Settings size={19} />} label="Settings & account" /></div></div><div className="profile-private-status"><ReputationView uid={user.uid} initialSummary={trust} /></div></div>
    <details className="profile-recent"><summary>Recent transactions</summary><TransactionHistory key={user.uid} uid={user.uid} /></details>
  </div>;
}
