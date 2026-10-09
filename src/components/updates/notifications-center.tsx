"use client";

import { listingImage } from "@/lib/listing-media";
import { ArrowDown, ArrowRight, ArrowUpDown, Bell, CheckCheck, CheckCircle2, Gavel, Heart, LoaderCircle, MessageCircle, Settings2, ShoppingBag, Star, Tag, TriangleAlert, Trophy, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { getNotifications, getUnreadCount, markAllNotificationsRead, openNotification, type Notification } from "@/lib/services/engagement";
import { getPublicListingDetail } from "@/lib/services/listings";
import { appendUpdates, filterUpdates, groupUpdates, notificationPresentation, UPDATE_FILTERS, updateTime, type UpdateFilter } from "@/lib/notification-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import styles from "./updates.module.css";

type Page = { items: Notification[]; cursor: string | null; hasMore: boolean };
type ListingMedia = { title: string; image: string | null };
const empty: Page = { items: [], cursor: null, hasMore: false };
const icons = { message: MessageCircle, offer: Tag, counter: ArrowUpDown, accepted: CheckCircle2, auction: Gavel, outbid: TriangleAlert, won: Trophy, saved: Heart, seller: UserRound, deal: ShoppingBag, review: Star, bell: Bell };

export function NotificationsCenter() {
  const { user, loading, configured } = useAuth();
  if (!configured) return <FirebaseSetupState />;
  if (loading) return <RowsSkeleton />;
  if (!user) return <SignInRequired message="Log in to see your marketplace updates." next="/updates" />;
  // Account changes remount the private feed so a previous user's rows never flash.
  return <UpdatesFeed key={user.uid} />;
}

function UpdatesFeed() {
  const router = useRouter();
  const now = useCurrentTime(60_000);
  const [page, setPage] = useState<Page>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"all" | "more" | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<UpdateFilter>("All");
  const [media, setMedia] = useState<Record<string, ListingMedia>>({});
  const requestedMedia = useRef(new Set<string>());
  const operation = useRef(false);
  const alive = useRef(true);

  const refresh = useCallback(() => Promise.all([getNotifications(), getUnreadCount()]).then(([next, summary]) => {
    if (alive.current) { setPage(next); setUnreadCount(summary.unreadCount); setError(""); setLoading(false); }
  }).catch(() => {
    if (alive.current) { setError("Couldn’t load updates. Please try again."); setLoading(false); }
  }), []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const visible = () => { if (document.visibilityState === "visible" && !operation.current) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { alive.current = false; document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  useEffect(() => {
    const ids = [...new Set(page.items.flatMap(item => item.listingId ? [item.listingId] : []))].filter(id => !requestedMedia.current.has(id));
    if (!ids.length) return;
    ids.forEach(id => requestedMedia.current.add(id));
    // Optional public thumbnails never block the private feed or replace event-time wording.
    void Promise.all(ids.map(async id => {
      try { const { listing } = await getPublicListingDetail(id); return [id, { title: listing.title, image: listingImage(listing, "thumbnail") ?? null }] as const; }
      catch { return [id, null] as const; }
    })).then(results => {
      const loaded: Record<string, ListingMedia> = {};
      for (const [id, value] of results) if (value) loaded[id] = value;
      if (alive.current) setMedia(current => ({ ...current, ...loaded }));
    });
  }, [page.items]);

  async function read(item: Notification) {
    if (operation.current) return;
    operation.current = true; setOpening(item.id); setError("");
    try {
      const result = await openNotification(item.id);
      if (!alive.current) return;
      setPage(current => ({ ...current, items: current.items.map(entry => entry.id === item.id ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() } : entry) }));
      // Read truth and badge count come from the same server contracts, including concurrent opens.
      const summary = await getUnreadCount().catch(() => null);
      if (!alive.current) return;
      if (summary) setUnreadCount(summary.unreadCount);
      window.dispatchEvent(new Event("takeme:notifications-changed"));
      router.push(result.href);
    } catch { if (alive.current) setError("Couldn’t open this update. Try again; it hasn’t been marked read here."); }
    finally { operation.current = false; if (alive.current) setOpening(null); }
  }

  async function markAll() {
    if (operation.current) return;
    operation.current = true; setBusy("all"); setError("");
    try {
      let remaining = false;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const result = await markAllNotificationsRead(); remaining = result.hasMore;
        if (!remaining) break;
      }
      await refresh();
      if (remaining && alive.current) setError("More unread updates remain. Mark all read again to continue.");
    } catch {
      if (alive.current) setError("Some updates couldn’t be marked read. Please try again.");
    } finally {
      // Also refresh the shell after a partial server success.
      window.dispatchEvent(new Event("takeme:notifications-changed"));
      operation.current = false; if (alive.current) setBusy(null);
    }
  }

  async function loadMore() {
    if (!page.cursor || operation.current) return;
    operation.current = true; setBusy("more"); setError("");
    try {
      const next = await getNotifications(page.cursor);
      if (alive.current) setPage(current => ({ items: appendUpdates(current.items, next.items), cursor: next.cursor, hasMore: next.hasMore }));
    } catch { if (alive.current) setError("Earlier updates couldn’t be loaded. Please try again."); }
    finally { operation.current = false; if (alive.current) setBusy(null); }
  }

  const visible = filterUpdates(page.items, filter);
  const groups = groupUpdates(visible, now);
  return <>
    <div className={styles.heading}><div><h1>Updates</h1><p>Your marketplace, in one place.</p></div><Link href="/notification-preferences" className={styles.settings} aria-label="Notification settings"><Settings2 size={20} /></Link></div>
    <div className={styles.toolbar}><p className={styles.summary} role="status">{loading ? "Loading your updates…" : error && !page.items.length ? "Updates unavailable" : unreadCount ? <><strong>{unreadCount} unread</strong> · newest first</> : "You’re up to date"}</p><button type="button" disabled={Boolean(busy || opening) || loading || unreadCount <= 0} onClick={() => void markAll()} className={styles.textButton}>{busy === "all" ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCheck size={15} />}Mark all read</button></div>
    <div className={styles.filters} role="group" aria-label="Filter updates">{UPDATE_FILTERS.map(name => <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div>
    {error && <div role="alert" className={styles.error}><TriangleAlert size={18} aria-hidden="true" /><p>{error}</p>{!page.items.length && <button type="button" onClick={() => { setLoading(true); void refresh(); }}>Retry</button>}</div>}
    {loading ? <RowsSkeleton /> : visible.length ? <div aria-label={`${filter} updates`} aria-busy={Boolean(busy || opening)}>{groups.map(group => <section key={group.label} className={styles.group} aria-label={group.label}><h2>{group.label}</h2><ul className={styles.list}>{group.items.map(item => <li key={item.id}><NotificationRow item={item} media={item.listingId ? media[item.listingId] : undefined} now={now} disabled={Boolean(busy || opening)} opening={opening === item.id} onOpen={() => void read(item)} /></li>)}</ul></section>)}</div> : !error && <EmptyUpdates filter={filter} hasMore={page.hasMore} />}
    {!loading && page.hasMore && <div className={styles.loadMore}><button type="button" disabled={Boolean(busy || opening)} onClick={() => void loadMore()} className="button-secondary">{busy === "more" ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowDown size={15} />}Load earlier updates</button></div>}
    {!loading && page.items.length > 0 && <div className={styles.dealLink}><Link href="/profile/transactions">View your deals<ArrowRight size={14} /></Link></div>}
  </>;
}

function NotificationRow({ item, media, now, disabled, opening, onOpen }: { item: Notification; media?: ListingMedia; now: number; disabled: boolean; opening: boolean; onOpen: () => void }) {
  const presentation = notificationPresentation(item.type);
  const Icon = icons[presentation.icon];
  const [failedImage, setFailedImage] = useState(false);
  const thumbnail = item.type !== "message_received" && media?.image && !failedImage;
  const context = media?.title && !item.body.includes(media.title) ? media.title : null;
  return <Link href={item.href} onClick={event => { event.preventDefault(); if (!disabled) onOpen(); }} aria-disabled={disabled || undefined} aria-label={`${item.readAt ? "Read" : "Unread"} ${presentation.label}: ${item.title}. ${context ? `${context}. ` : ""}${item.body}. ${presentation.action}`} className={styles.row} data-unread={!item.readAt || undefined}>
    <span className={styles.media} data-tone={presentation.icon} aria-hidden="true">{thumbnail ? <><Image src={media.image!} alt="" width={56} height={56} unoptimized className={styles.mediaImage} onError={() => setFailedImage(true)} /><span className={styles.eventBadge}><Icon size={12} /></span></> : <Icon size={25} strokeWidth={1.8} />}</span>
    <span className={styles.content}><span className={styles.rowTitle}>{item.title}{!item.readAt && <span className={styles.dot} aria-hidden="true" />}</span>{context && <span className={styles.context}>{context}</span>}<span className={styles.body}>{item.body}</span><span className={styles.rowFoot}><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString("en-MY")}>{updateTime(item.createdAt, now)}</time><span className={styles.cta}>{opening ? "Opening…" : presentation.action}<ArrowRight size={12} aria-hidden="true" /></span></span></span>
  </Link>;
}
function EmptyUpdates({ filter, hasMore }: { filter: UpdateFilter; hasMore: boolean }) {
  return <section className={styles.empty}><Image src="/brand/mascot-2d-happy.png" alt="" width={98} height={98} /><h2>{filter === "All" ? "You’re all caught up" : `No ${filter.toLowerCase()} here yet`}</h2><p>{hasMore ? "Check earlier updates for more marketplace activity." : filter === "All" ? "New messages, offers and auction activity will appear here." : `Your ${filter.toLowerCase()} updates will appear here when something happens.`}</p>{filter === "All" && !hasMore && <Link href="/explore" className="button-secondary">Explore TAKEME<ArrowRight size={15} /></Link>}</section>;
}
function RowsSkeleton() { return <div className={styles.skeleton} role="status" aria-label="Loading updates">{Array.from({ length: 4 }, (_, index) => <div key={index} className={`${styles.skeletonRow} animate-pulse`} aria-hidden="true"><span /><div><i /><i /><i /></div></div>)}</div>; }
