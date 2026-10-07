"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getConversations, type ConversationSummary } from "@/lib/services/conversations";
import { getPublicListingDetail, type PublicListing } from "@/lib/services/listings";
import { getListingDealState } from "@/lib/services/transactions";
import { conversationDealState, messageTime } from "@/lib/messaging-presentation";
import { discoveryPrice } from "@/lib/listing-display";
import { useCurrentTime } from "@/lib/use-current-time";
import { money } from "./product-context-card";
import styles from "./messaging.module.css";

type Context = { listing: PublicListing | null; hasOffer: boolean; hasDeal: boolean; unavailable: boolean };
export function ConversationRow({ item, context, active, now }: { item: ConversationSummary; context?: Context; active: boolean; now: number }) {
  const unread = (item.unreadCount ?? 0) > 0;
  return <Link href={`/messages/${item.id}`} className={styles.row} aria-current={active ? "page" : undefined}>
    <span className={styles.thumbnail}>{(context?.listing?.imageUrls[0] ?? item.listingImage) ? <Image src={(context?.listing?.imageUrls[0] ?? item.listingImage)!} alt="" fill sizes="62px" className="object-cover" /> : <ImageIcon size={22} />}</span>
    <span className={styles.rowText}><span className={styles.rowTop}><strong>{item.otherName}</strong><time dateTime={item.updatedAt ?? undefined}>{messageTime(item.lastMessageAt ?? item.updatedAt, now, true)}</time></span>
      <span className={`${styles.preview} ${unread ? "font-semibold" : ""}`}>{item.latestMessage ?? (context?.hasDeal ? "Deal agreed · View details" : context?.hasOffer ? "Offer · View details" : "Start the conversation")}</span>
      <span className={styles.rowBottom}><span>{item.listingTitle}</span>{context?.listing && <span className={styles.price}>{money(discoveryPrice(context.listing))}</span>}{unread && <span className={styles.unread} aria-label={`${item.unreadCount} unread messages`}>{item.unreadCount! > 99 ? "99+" : item.unreadCount}</span>}</span>
    </span>
  </Link>;
}

export function MessagesInbox({ activeId }: { activeId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const now = useCurrentTime(60_000);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [contexts, setContexts] = useState<Record<string, Context>>({});
  const [filter, setFilter] = useState("All");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true), inFlight = useRef(false);
  const load = useCallback(async (next: string | null = null, quiet = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!quiet) setLoading(true);
    try {
      const page = await getConversations(next);
      if (!alive.current) return;
      setError("");
      setItems((current) => next ? [...current.filter((item) => !page.items.some((fresh) => fresh.id === item.id)), ...page.items] : quiet ? [...page.items, ...current.filter((item) => !page.items.some((fresh) => fresh.id === item.id))] : page.items);
      if (!quiet) { setCursor(page.cursor); setHasMore(page.hasMore); }
      // Show the private inbox before optional listing/deal enrichment.
      setLoading(false);
      const enriched = await Promise.all(page.items.map(async (item) => {
        const [listing, state] = await Promise.allSettled([getPublicListingDetail(item.listingId), getListingDealState(item.listingId)]);
        const deal = state.status === "fulfilled" ? conversationDealState(item, state.value) : null;
        return [item.id, { listing: listing.status === "fulfilled" ? listing.value.listing : null, hasOffer: Boolean(deal?.offers.length), hasDeal: Boolean(deal?.transaction), unavailable: state.status === "rejected" }] as const;
      }));
      if (alive.current) setContexts((current) => ({ ...current, ...Object.fromEntries(enriched) }));
    } catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : "Messages could not be loaded."); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!user) return;
    queueMicrotask(() => void load());
    // Messaging is callable-backed; direct Firestore listeners are deliberately denied.
    const refresh = () => { if (document.visibilityState === "visible") void load(null, true); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [user, load]);
  const visible = items.filter((item) => filter === "All" || (filter === "Buying" && item.buyerId === user?.uid) || (filter === "Selling" && item.sellerId === user?.uid) || (filter === "Offers" && contexts[item.id]?.hasOffer));
  return <div className={styles.inbox}><h1 className={styles.inboxTitle}>Messages</h1>
    {!authLoading && !user ? <div className={styles.empty}><h2>Your private inbox</h2><p>Sign in to chat about listings and agreed deals.</p><Link className="button-primary min-h-11 px-5 mt-4" href="/login?next=%2Fmessages">Log in</Link></div> : <>
      <div className={styles.filters} aria-label="Filter conversations">{["All", "Buying", "Selling", "Offers"].map((value) => <button key={value} type="button" aria-pressed={value === filter} onClick={() => setFilter(value)}>{value}</button>)}</div>
      {error && <div role="alert" className={styles.error}>{error}<button type="button" className="min-h-11 action-link ml-3 font-semibold" onClick={() => void load()}>Retry</button></div>}
      {(authLoading || loading) && !items.length && Array.from({ length: 6 }, (_, index) => <div key={index} className={`${styles.skeleton} animate-pulse`} aria-hidden="true"><div className="h-16 w-16 rounded-xl bg-gray-100" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 rounded bg-gray-100" /><div className="h-3 rounded bg-gray-100" /><div className="h-3 w-1/2 rounded bg-gray-100" /></div></div>)}
      {filter === "Offers" && Object.values(contexts).some((context) => context.unavailable) && <p role="status" className="text-xs text-[var(--takeme-gray)] py-2">Some offer details are unavailable. Refresh to try again.</p>}
      {!authLoading && !loading && !error && !visible.length && <div className={styles.empty}><Image src="/brand/mascot-2d-happy.png" alt="" width={96} height={96} /><h2>{items.length ? `No ${filter.toLowerCase()} conversations` : "No messages yet"}</h2><p>{items.length ? "Try another filter or load more conversations." : "When you chat with buyers or sellers, your conversations will appear here."}</p>{!items.length && <Link className="button-secondary min-h-11 px-5 mt-4" href="/explore">Explore TAKEME</Link>}</div>}
      {visible.map((item) => <ConversationRow key={item.id} item={item} context={contexts[item.id]} active={activeId === item.id} now={now} />)}
      {hasMore && <button type="button" disabled={loading} className="button-secondary min-h-11 w-full mt-4" onClick={() => void load(cursor)}>{loading ? "Loading…" : "Load more conversations"}</button>}
    </>}
  </div>;
}
