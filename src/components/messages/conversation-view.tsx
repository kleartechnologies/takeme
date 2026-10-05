"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Ellipsis, Send, ShieldCheck, Star, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getConversation, getConversationMessages, markConversationSeen, sendConversationMessage, type ConversationMessage, type ConversationSummary } from "@/lib/services/conversations";
import { getPublicListingDetail, type PublicListing } from "@/lib/services/listings";
import { getPublicSellerSummary } from "@/lib/services/public-sellers";
import { getListingDealState, getTransactionDetail } from "@/lib/services/transactions";
import { conversationDealState, messageTime } from "@/lib/messaging-presentation";
import { pendingMessageSend, type PendingMessageSend } from "@/lib/message-send-request";
import { useCurrentTime } from "@/lib/use-current-time";
import { ReportAction } from "@/components/trust/report-action";
import { ActionSheet } from "@/components/ui/action-sheet";
import type { MarketplaceOffer, MarketplaceTransaction, PublicSellerSummary } from "@/types/marketplace";
import { ProductContextCard } from "./product-context-card";
import { ConversationDeals } from "./conversation-deals";
import styles from "./messaging.module.css";

export function ConversationView({ id, makeOffer = false }: { id: string; makeOffer?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-80 animate-pulse bg-gray-50" />;
  if (!user) return <div className={styles.empty}><h2>Private conversation</h2><Link href={`/login?next=${encodeURIComponent(`/messages/${id}${makeOffer ? "?offer=1" : ""}`)}${makeOffer ? "&intent=offer" : ""}`} className="button-primary mt-5 min-h-11 px-5">Log in</Link></div>;
  return <ConversationSession key={`${user.uid}:${id}`} id={id} userId={user.uid} makeOffer={makeOffer} />;
}

function ConversationSession({ id, userId, makeOffer }: { id: string; userId: string; makeOffer: boolean }) {
  const { setup } = useAuth();
  const mayMarkSeen = setup?.step === "ready" && setup.policyAvailable === true;
  const now = useCurrentTime(30_000);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [profile, setProfile] = useState<PublicSellerSummary | null>(null);
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [transaction, setTransaction] = useState<MarketplaceTransaction | null>(null);
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [dealError, setDealError] = useState("");
  const [menu, setMenu] = useState(false);
  const alive = useRef(true), sendRequest = useRef(false), olderRequest = useRef(false);
  const pendingSend = useRef<PendingMessageSend | null>(null);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const history = useRef<HTMLElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const restoreComposerFocus = useRef(false);
  const followBottom = useRef(true);
  const loadedOlder = useRef(false);
  const fetchCurrent = useCallback(async () => {
    if (!alive.current) return;
    try {
      const [next, page] = await Promise.all([getConversation(id), getConversationMessages(id)]);
      if (!alive.current) return;
      setConversation(next); setError("");
      setMessages((current) => [...page.items, ...current.filter((item) => !page.items.some((fresh) => fresh.id === item.id))]);
      if (!loadedOlder.current) { setCursor(page.cursor); setHasMore(page.hasMore); }
      const [product, trust, state] = await Promise.allSettled([getPublicListingDetail(next.listingId), getPublicSellerSummary(next.otherId), getListingDealState(next.listingId)]);
      if (!alive.current) return;
      setListing(product.status === "fulfilled" ? product.value.listing : null);
      setProfile(trust.status === "fulfilled" ? trust.value : null);
      let deal = state.status === "fulfilled" ? conversationDealState(next, state.value) : { offers: [], transaction: null };
      const transactionId = next.transactionId ?? deal.transaction?.id;
      if (transactionId) {
        try {
          const detail = await getTransactionDetail(transactionId);
          deal = conversationDealState(next, { offers: deal.offers, transaction: detail.transaction });
          if (alive.current) setReviewed(detail.reviewed);
        } catch { if (alive.current) setDealError("Deal details could not be loaded. Try again."); }
      }
      if (!alive.current) return;
      setOffers(deal.offers); setTransaction(deal.transaction);
      if (state.status === "rejected" && !deal.transaction) setDealError("Offer details could not be loaded. Try again.");
      else if (!next.transactionId || deal.transaction) setDealError("");
      // Read-only browsing by an outdated owner must not trigger a protected
      // write (or a policy redirect) merely because unread messages were viewed.
      if (mayMarkSeen && document.visibilityState === "visible" && (next.unreadBy?.[userId] ?? 0) > 0) await markConversationSeen(id);
    } catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : "Conversation could not be loaded."); }
    finally { if (alive.current) setLoading(false); }
  }, [id, userId, mayMarkSeen]);
  const refresh = useCallback(async (quiet = false): Promise<void> => {
    // A post-action refresh must follow an older in-flight read, not be dropped.
    if (quiet && pendingRefresh.current) { await pendingRefresh.current; return; }
    const request = (pendingRefresh.current ?? Promise.resolve()).then(fetchCurrent);
    pendingRefresh.current = request;
    try { await request; } finally { if (pendingRefresh.current === request) pendingRefresh.current = null; }
  }, [fetchCurrent]);
  useEffect(() => {
    alive.current = true; queueMicrotask(() => void refresh());
    const update = () => { if (document.visibilityState === "visible") void refresh(true); };
    const interval = window.setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    return () => { alive.current = false; clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);
  useEffect(() => { if (followBottom.current && history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages, offers, transaction]);
  useEffect(() => {
    if (!sending && restoreComposerFocus.current) {
      restoreComposerFocus.current = false;
      if (document.activeElement === document.body) composer.current?.querySelector<HTMLTextAreaElement>("textarea:not([disabled])")?.focus();
    }
  }, [sending]);
  async function older() {
    if (!cursor || olderRequest.current) return;
    olderRequest.current = true; setOlderBusy(true); followBottom.current = false;
    loadedOlder.current = true;
    try {
      const page = await getConversationMessages(id, cursor);
      if (!alive.current) return;
      setMessages((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch { if (alive.current) setError("Older messages could not be loaded. Try again."); }
    finally { olderRequest.current = false; if (alive.current) setOlderBusy(false); }
  }
  async function send() {
    if (!body.trim() || sendRequest.current || conversation?.status === "closed") return;
    restoreComposerFocus.current = Boolean(composer.current?.contains(document.activeElement));
    sendRequest.current = true; setSending(true); setError("");
    try {
      const request = pendingMessageSend(pendingSend.current, userId, id, body);
      pendingSend.current = request;
      await sendConversationMessage(id, request.body, request.idempotencyKey);
      pendingSend.current = null;
      if (!alive.current) return;
      setBody(""); followBottom.current = true; await refresh();
    }
    catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : "Message could not be sent."); }
    finally { sendRequest.current = false; if (alive.current) setSending(false); }
  }
  if (loading) return <div className={styles.conversation}><div className="h-16 bg-white animate-pulse" /><div className="m-3 h-24 rounded-xl bg-gray-100 animate-pulse" /><div className="m-3 h-16 w-2/3 rounded-2xl bg-white animate-pulse" /></div>;
  if (!conversation) return <div className={styles.empty}><p role="alert" className={styles.error}>{error || "Conversation unavailable."}</p><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => void refresh()}>Retry</button><Link href="/messages" className="min-h-11 inline-flex items-center mt-3 text-sm">Back to Messages</Link></div>;
  const dealProps = { conversation, listing, offers, transaction, reviewed, userId, now, refresh, makeOffer };
  return <div className={styles.conversation}>
    <header className={styles.chatHeader}><Link href="/messages" aria-label="Back to Messages" className="icon-button lg:hidden"><ArrowLeft size={20} /></Link><Link className={styles.identity} href={`/sellers/${conversation.otherId}`}>
      <span className={styles.avatar}>{profile?.photoURL ? <Image src={profile.photoURL} alt="" fill sizes="40px" className="object-cover" /> : <UserRound size={22} />}</span><span className="min-w-0"><strong className="truncate">{conversation.otherName}{profile?.verificationStatus === "verified" && <ShieldCheck size={14} aria-label="Verified" className="text-[var(--takeme-dark-green)] shrink-0" />}</strong>{profile && userId === conversation.buyerId && <small>{profile.sellerRating != null ? <><Star size={11} className="inline text-amber-600" /> {profile.sellerRating.toFixed(1)} ({profile.sellerReviewCount} seller reviews)</> : "No seller reviews yet"}</small>}</span></Link>
      <button type="button" aria-label="Conversation options" className="icon-button" onClick={() => setMenu(true)}><Ellipsis size={21} /></button>
    </header>
    <div className={styles.productPinned}><ProductContextCard listing={listing} listingId={conversation.listingId} title={conversation.listingTitle} image={conversation.listingImage} /></div>
    <section ref={history} aria-label="Message history" className={styles.history} onScroll={() => { if (history.current) followBottom.current = history.current.scrollHeight - history.current.scrollTop - history.current.clientHeight < 80; }}>
      <p className={styles.safety}>Private to both participants. Never share passwords or verification codes.</p>
      {hasMore && <button type="button" disabled={olderBusy} className="button-secondary mb-4 min-h-11 w-full" onClick={() => void older()}>{olderBusy ? "Loading…" : "Load older messages"}</button>}
      {!messages.length && <p className="py-8 text-center text-xs text-[var(--takeme-gray)]">Ask a question or arrange your exchange here.</p>}
      <ol className={styles.messageList}>{[...messages].reverse().map((message) => <li key={message.id} className={`${styles.bubble} ${message.senderId === userId ? styles.outgoing : styles.incoming}`}><p>{message.body}</p><time dateTime={message.createdAt ?? undefined} title={message.createdAt ? new Date(message.createdAt).toLocaleString("en-MY") : undefined}>{messageTime(message.createdAt, now)}</time>{message.senderId !== userId && <details><summary>Message options</summary><ReportAction targetType="message" targetId={message.id} conversationId={id} label="Report message" /></details>}</li>)}</ol>
      <ConversationDeals {...dealProps} placement="events" />
    </section>
    <div className={styles.chatBottom}>
      {error && <div role="alert" className={styles.error}>{error}<button className="min-h-11 underline ml-2" type="button" onClick={() => void refresh()}>Retry</button></div>}
      {dealError ? <div role="alert" className={styles.error}>{dealError}<button className="min-h-11 underline ml-2" type="button" onClick={() => void refresh()}>Retry</button></div> : <ConversationDeals key={makeOffer ? "offer" : "chat"} {...dealProps} placement="actions" />}
      <form ref={composer} className={styles.composer} onSubmit={(event) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="message-body">Your message</label><textarea id="message-body" value={body} disabled={sending || conversation.status === "closed"} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={1} placeholder={conversation.status === "closed" ? "Conversation closed" : "Type a message…"} /><button type="submit" disabled={sending || !body.trim() || conversation.status === "closed"} aria-label={sending ? "Sending message" : "Send message"} className={styles.send}><Send size={21} /></button></form>
      <p className={styles.composerNote}>{sending ? "Sending…" : `${body.length}/2000`}</p>
    </div>
    {menu && <ActionSheet title="Conversation options" description="Only public identity and participant-scoped deal information are shown." onClose={() => setMenu(false)}><div className="grid gap-2"><Link href={`/sellers/${conversation.otherId}`} className="button-secondary min-h-11">View public profile</Link><Link href={`/listings/${conversation.listingId}`} className="button-secondary min-h-11">View listing</Link>{transaction && <Link href={`/transactions/${transaction.id}`} className="button-secondary min-h-11">View Deal</Link>}<ReportAction targetType="conversation" targetId={id} label="Report conversation" /><ReportAction targetType="user" targetId={conversation.otherId} label="Report user" /><p className="text-xs leading-6 text-[var(--takeme-gray)]">Never share passwords or verification codes. Use Report if something feels wrong.</p></div></ActionSheet>}
  </div>;
}
