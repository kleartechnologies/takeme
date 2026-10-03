"use client";

import { ArrowDown, ArrowRight, Check, Heart, LoaderCircle, MapPin, Search, Star, Trash2, TriangleAlert, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listings/listing-card";
import { ActionSheet } from "@/components/ui/action-sheet";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { ListingSkeleton } from "@/components/ui/states";
import { getSavedPage, removeSavedListing } from "@/lib/services/saved";
import { deleteSavedSearch, getFollowing, getSavedSearches, saveSearch, setSellerFollow, type FollowingSeller, type Frequency, type SavedSearch } from "@/lib/services/engagement";
import type { FollowChange, SavedChange } from "@/lib/marketplace-state-events";
import { auctionOutcome, savedAvailability, savedCollection, savedSearchCriteria, savedSearchHref, savedSearchStatus, savedTab, SAVED_TABS, type SavedTab } from "@/lib/saved-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import styles from "./saved.module.css";

const names = { items: "Items", auctions: "Auctions", sellers: "Sellers", searches: "Searches" };
const descriptions = { items: "Your favourite finds, most recently saved first.", auctions: "Keep an eye on the auctions you saved.", sellers: "People whose listings you want to return to.", searches: "Your filters, ready for the next good find." };
const fetchSaved = () => getSavedPage(null, 12);
const fetchFollowing = () => getFollowing();

/** Private panels remount by account. Late promises cannot populate another account's UI. */
function usePrivatePage<T>(fetch: () => Promise<T>, failure: string, refreshKey = "") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const operation = useRef(false);
  const version = useRef(0);
  const reload = useCallback(() => {
    const request = ++version.current;
    return fetch().then(next => { if (alive.current && request === version.current) { setData(next); setError(""); setLoading(false); } }).catch(() => { if (alive.current && request === version.current) { setError(failure); setLoading(false); } });
  }, [fetch, failure]);
  useEffect(() => {
    alive.current = true;
    void reload();
    const visible = () => { if (document.visibilityState === "visible" && !operation.current) void reload(); };
    document.addEventListener("visibilitychange", visible);
    return () => { alive.current = false; document.removeEventListener("visibilitychange", visible); };
  }, [reload, refreshKey]);
  const begin = useCallback(() => { if (operation.current) return false; operation.current = true; version.current++; return true; }, []);
  const end = useCallback(() => { operation.current = false; }, []);
  const updateFromEvent = useCallback((update: (current: T | null) => T | null) => { version.current++; setData(update); }, []);
  const isBusy = useCallback(() => operation.current, []);
  const isAlive = useCallback(() => alive.current, []);
  return { data, setData, loading, error, setError, reload, begin, end, isBusy, isAlive, updateFromEvent };
}

export function SavedView() {
  const { user, loading, configured } = useAuth();
  const tab = savedTab(useSearchParams().get("tab"));
  return <>
    <div className={styles.heading}><h1>Saved</h1><p>Items, auctions, sellers and searches. All in one place.</p></div>
    <nav className={styles.tabs} aria-label="Saved collections">{SAVED_TABS.map(name => <Link key={name} href={name === "items" ? "/saved" : `/saved?tab=${name}`} aria-current={tab === name ? "page" : undefined}>{names[name]}</Link>)}</nav>
    {!configured ? <FirebaseSetupState /> : loading ? <SavedSkeleton tab={tab} /> : !user ? <SignInRequired message="Log in to keep your saved finds and followed sellers in one place." next={tab === "items" ? "/saved" : `/saved?tab=${tab}`} /> : <PrivateHub key={user.uid} uid={user.uid} tab={tab} />}
  </>;
}
function PrivateHub({ uid, tab }: { uid: string; tab: SavedTab }) {
  return tab === "sellers" ? <SellersPanel uid={uid} /> : tab === "searches" ? <SearchesPanel /> : <ListingsPanel uid={uid} tab={tab} />;
}
function ListingsPanel({ uid, tab }: { uid: string; tab: "items" | "auctions" }) {
  const feed = usePrivatePage(fetchSaved, "Couldn’t load your saved items. Please try again.", tab);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const now = useCurrentTime(60_000);
  const { updateFromEvent, reload, isBusy } = feed;
  const explore = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const changed = (event: Event) => {
      const change = (event as CustomEvent<SavedChange>).detail;
      if (change.uid !== uid) return;
      if (!change.saved) updateFromEvent(current => current ? { ...current, items: current.items.filter(item => item.listingId !== change.listingId) } : current);
      else if (!isBusy()) void reload();
    };
    window.addEventListener("takeme:saved-changed", changed);
    return () => window.removeEventListener("takeme:saved-changed", changed);
  }, [uid, updateFromEvent, reload, isBusy]);
  async function more() {
    if (!feed.data?.cursor || !feed.begin()) return; setBusy("more"); feed.setError("");
    try {
      const next = await getSavedPage(feed.data.cursor, 12);
      if (feed.isAlive()) feed.setData(current => current ? { ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(previous => previous.listingId === item.listingId))] } : next);
    } catch { if (feed.isAlive()) feed.setError("Couldn’t load earlier saved items. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  async function remove(id: string) {
    if (!feed.begin()) return; setBusy(id); feed.setError("");
    try { await removeSavedListing(id); if (feed.isAlive()) { feed.setData(current => current ? { ...current, items: current.items.filter(item => item.listingId !== id) } : current); setNotice("Removed from saved."); explore.current?.focus(); } }
    catch { if (feed.isAlive()) feed.setError("Couldn’t remove this saved item. It is still saved. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  const items = savedCollection(feed.data?.items ?? [], tab);
  return <section aria-label={`Saved ${names[tab].toLowerCase()}`}>
    <p className={styles.intro}>{descriptions[tab]}</p><span role="status" className="sr-only">{notice}</span>
    {feed.error && <SavedError message={feed.error} retry={() => void feed.reload()} />}
    {feed.loading ? <SavedSkeleton tab={tab} /> : !items.length && !feed.error ? <SavedEmpty tab={tab} hasMore={feed.data?.hasMore} /> : <div className={styles.productGrid}>{items.map(item => item.listing ? <div key={item.listingId} className={styles.savedCard}>
      <div className={styles.cardFrame}><ListingCard listing={item.listing} variant="discovery" initialSaved sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" onSavedChange={saved => { if (!saved) { setNotice("Removed from saved."); explore.current?.focus(); } }} />{["Sold", "Unavailable", "Ending soon", "Awaiting finalization"].includes(savedAvailability(item.listing, now)) && <span className={styles.availability} data-status={savedAvailability(item.listing, now)}>{savedAvailability(item.listing, now)}</span>}</div>
      {tab === "auctions" && auctionOutcome(item.listing) && <p className={styles.outcome}>{auctionOutcome(item.listing)}</p>}
      {item.savedAt && <p className={styles.savedDate}>Saved {new Date(item.savedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</p>}
      {(item.listing.status === "sold" || item.listing.status === "ended" || item.listing.auctionStatus === "ended" || item.listing.auctionStatus === "cancelled") && <Link className={styles.similar} href={`/explore?category=${encodeURIComponent(item.listing.categoryId)}`}>View similar<ArrowRight size={13} /></Link>}
    </div> : <article key={item.listingId} className={styles.unavailable}><span className={styles.unavailableArt}><Heart size={30} /></span><div><h2>Listing unavailable</h2><p>Removed or no longer public. You can remove it from saved.</p></div><button type="button" disabled={busy === item.listingId} onClick={() => void remove(item.listingId)}><Trash2 size={15} />{busy === item.listingId ? "Removing…" : "Remove"}</button></article>)}</div>}
    {!feed.loading && feed.data?.hasMore && <LoadMore busy={busy === "more"} disabled={Boolean(busy)} onClick={() => void more()} />}
    <Link ref={explore} className={styles.exploreLink} href={tab === "auctions" ? "/explore?type=auction" : "/explore"}>Explore {tab === "auctions" ? "auctions" : "TAKEME"}<ArrowRight size={14} /></Link>
  </section>;
}
function SellersPanel({ uid }: { uid: string }) {
  const feed = usePrivatePage(fetchFollowing, "Couldn’t load your followed sellers. Please try again.");
  const { updateFromEvent, reload, isBusy } = feed;
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const explore = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const changed = (event: Event) => { const change = (event as CustomEvent<FollowChange>).detail; if (change.uid !== uid) return; if (!change.following) updateFromEvent(current => current ? { ...current, items: current.items.filter(item => item.sellerId !== change.sellerId) } : current); else if (!isBusy()) void reload(); };
    window.addEventListener("takeme:follow-changed", changed); return () => window.removeEventListener("takeme:follow-changed", changed);
  }, [uid, updateFromEvent, reload, isBusy]);
  async function unfollow(seller: FollowingSeller) {
    if (!feed.begin()) return; setBusy(seller.sellerId); feed.setError("");
    try { await setSellerFollow(seller.sellerId, false); if (feed.isAlive()) { feed.setData(current => current ? { ...current, items: current.items.filter(item => item.sellerId !== seller.sellerId) } : current); setNotice(`No longer following ${seller.displayName}.`); explore.current?.focus(); } }
    catch { if (feed.isAlive()) feed.setError("Couldn’t unfollow this seller. You are still following them. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  async function more() {
    if (!feed.data?.cursor || !feed.begin()) return; setBusy("more"); feed.setError("");
    try { const next = await getFollowing(feed.data.cursor); if (feed.isAlive()) feed.setData(current => current ? { ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(previous => previous.sellerId === item.sellerId))] } : next); }
    catch { if (feed.isAlive()) feed.setError("Couldn’t load more sellers. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  return <section aria-label="Following sellers"><p className={styles.intro}>{descriptions.sellers}</p><span role="status" className="sr-only">{notice}</span>{feed.error && <SavedError message={feed.error} retry={() => void feed.reload()} />}{feed.loading ? <SavedSkeleton tab="sellers" /> : !feed.data?.items.length && !feed.error ? <SavedEmpty tab="sellers" /> : <div className={styles.sellerGrid}>{feed.data?.items.map(seller => <article key={seller.sellerId} className={styles.sellerCard}><Link href={`/sellers/${seller.sellerId}`} className={styles.sellerIdentity} aria-label={`View ${seller.displayName}'s seller profile`}><SellerAvatar seller={seller} /><span><h2>{seller.displayName}</h2><span className={styles.rating}>{seller.sellerReviewCount > 0 ? <><Star size={13} />{seller.sellerAverageRating.toFixed(1)}<span> · {seller.sellerReviewCount} seller {seller.sellerReviewCount === 1 ? "review" : "reviews"}</span></> : "No seller reviews yet"}</span>{seller.location && <span className={styles.location}><MapPin size={12} />{seller.location}</span>}</span></Link><div className={styles.sellerActions}><Link href={`/sellers/${seller.sellerId}`}>View profile<ArrowRight size={13} /></Link><button type="button" aria-label={`Unfollow ${seller.displayName}`} aria-pressed="true" disabled={Boolean(busy)} onClick={() => void unfollow(seller)}><Check size={14} />{busy === seller.sellerId ? "Updating…" : "Following"}</button></div></article>)}</div>}{!feed.loading && feed.data?.hasMore && <LoadMore busy={busy === "more"} disabled={Boolean(busy)} onClick={() => void more()} />}<Link ref={explore} className={styles.exploreLink} href="/explore">Explore listings & sellers<ArrowRight size={14} /></Link></section>;
}
function SellerAvatar({ seller }: { seller: FollowingSeller }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.avatar}>{seller.photoURL && !failed ? <Image src={seller.photoURL} alt="" width={48} height={48} unoptimized onError={() => setFailed(true)} /> : <UserRound size={24} />}</span>;
}
function SearchesPanel() {
  const feed = usePrivatePage(getSavedSearches, "Couldn’t load your saved searches. Please try again.");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);
  const explore = useRef<HTMLAnchorElement>(null);
  async function change(item: SavedSearch, patch: { frequency?: Frequency; active?: boolean }) {
    if (!feed.begin()) return; setBusy(item.id); feed.setError("");
    try { await saveSearch(item.criteria, patch.frequency ?? item.frequency, item.id, patch.active ?? item.active); if (feed.isAlive()) { feed.setData(current => current ? { items: current.items.map(entry => entry.id === item.id ? { ...entry, ...patch } : entry) } : current); setNotice("Saved search updated."); } }
    catch { if (feed.isAlive()) feed.setError("Couldn’t update this search. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  async function remove(item: SavedSearch) {
    if (!feed.begin()) return; setBusy(item.id); feed.setError("");
    try { await deleteSavedSearch(item.id); if (feed.isAlive()) { feed.setData(current => current ? { items: current.items.filter(entry => entry.id !== item.id) } : current); setPendingDelete(null); setNotice("Saved search deleted."); } }
    catch { if (feed.isAlive()) feed.setError("Couldn’t delete this search. It is still saved. Please try again."); }
    finally { feed.end(); if (feed.isAlive()) setBusy(""); }
  }
  return <section aria-label="Saved searches"><p className={styles.intro}>{descriptions.searches}</p><span role="status" className="sr-only">{notice}</span>{feed.error && <SavedError message={feed.error} retry={() => void feed.reload()} />}{feed.loading ? <SavedSkeleton tab="searches" /> : !feed.data?.items.length && !feed.error ? <SavedEmpty tab="searches" /> : <div className={styles.searchGrid}>{feed.data?.items.map(item => <article key={item.id} className={styles.searchCard}><div className={styles.searchHeading}><span className={styles.searchIcon}><Search size={19} /></span><div><h2>{item.criteria.query || savedSearchCriteria(item.criteria)[0] || "Filtered search"}</h2><span className={styles.searchStatus}>{savedSearchStatus(item)}</span></div></div><div className={styles.criteria}>{savedSearchCriteria(item.criteria).map((text, i) => <span key={i}>{text}</span>)}</div><p className={styles.savedDate}>Saved {new Date(item.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}{item.lastTriggeredAt && ` · Last match ${new Date(item.lastTriggeredAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`}</p><div className={styles.searchActions}><Link href={savedSearchHref(item.criteria)}>View results<ArrowRight size={13} /></Link><button type="button" disabled={Boolean(busy)} aria-label={`Delete saved search ${item.criteria.query || "with these filters"}`} onClick={() => setPendingDelete(item)}><Trash2 size={14} />Delete</button></div><details className={styles.searchSettings}><summary>Manage search & alerts</summary><div><label>Alerts<select aria-label={`Alerts for ${item.criteria.query || "filtered search"}`} disabled={Boolean(busy)} value={item.frequency} onChange={event => void change(item, { frequency: event.target.value as Frequency })}><option value="instant">In-app</option><option value="daily" disabled>Daily — unavailable</option><option value="off">Off</option></select></label><button type="button" disabled={Boolean(busy)} onClick={() => void change(item, { active: !item.active })}>{item.active ? "Pause" : "Resume"}</button><Link href={`${savedSearchHref(item.criteria)}&savedSearch=${encodeURIComponent(item.id)}`}>Edit filters</Link></div>{!item.active && <p>Alerts are paused until you resume this search.</p>}</details></article>)}</div>}<Link ref={explore} className={styles.exploreLink} href="/explore">Find & save a search<ArrowRight size={14} /></Link>{pendingDelete && <ActionSheet title="Delete saved search?" description="This saved search will be removed and its alerts will stop." busy={Boolean(busy)} onClose={() => setPendingDelete(null)} fallbackFocus={() => explore.current}>{feed.error && <p role="alert" className="mb-4 text-sm text-red-700">{feed.error}</p>}<div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => setPendingDelete(null)} className="button-secondary min-h-11 flex-1">Cancel</button><button type="button" disabled={Boolean(busy)} onClick={() => void remove(pendingDelete)} className="min-h-11 flex-1 rounded-full bg-red-700 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Deleting…" : "Delete"}</button></div></ActionSheet>}</section>;
}
function SavedEmpty({ tab, hasMore = false }: { tab: SavedTab; hasMore?: boolean }) {
  const text = { items: ["Nothing saved yet", "Tap the heart on items you like and they’ll appear here."], auctions: ["No auctions saved yet", "Save an auction to keep its bids and status close by."], sellers: ["No sellers followed yet", "Follow sellers you like to return to their listings."], searches: ["No saved searches yet", "Save a search from Explore to quickly check new listings later."] };
  return <div className={styles.empty}><Image src="/brand/mascot-2d-happy.png" alt="" width={98} height={98} /><h2>{hasMore ? `No ${names[tab].toLowerCase()} on this page` : text[tab][0]}</h2><p>{hasMore ? "Load earlier saves to see more of your collection." : text[tab][1]}</p></div>;
}
function SavedError({ message, retry }: { message: string; retry: () => void }) { return <div className={styles.error} role="alert"><TriangleAlert size={18} /><p>{message}</p><button type="button" onClick={retry}>Retry</button></div>; }
function LoadMore({ busy, disabled, onClick }: { busy: boolean; disabled: boolean; onClick: () => void }) { return <div className={styles.loadMore}><button type="button" className="button-secondary min-h-11 px-5" disabled={disabled} onClick={onClick}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowDown size={15} />}Load earlier {busy ? "…" : "saves"}</button></div>; }
export function SavedSkeleton({ tab = "items" }: { tab?: SavedTab }) { return <div role="status" aria-label={`Loading saved ${tab}`} className={tab === "items" || tab === "auctions" ? styles.productGrid : styles.sellerGrid}>{Array.from({ length: tab === "items" || tab === "auctions" ? 6 : 3 }, (_, i) => tab === "items" || tab === "auctions" ? <ListingSkeleton discovery key={i} /> : <div key={i} className={`${styles.panelSkeleton} animate-pulse`} aria-hidden="true"><span /><div><i /><i /></div></div>)}</div>; }
