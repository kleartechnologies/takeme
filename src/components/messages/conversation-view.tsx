"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getConversation, getConversationMessages, markConversationSeen, sendConversationMessage, type ConversationMessage, type ConversationSummary } from "@/lib/services/conversations";
import { ReportAction } from "@/components/trust/report-action";
import { PublicSellerSummary } from "@/components/profile/public-seller-summary";

export function ConversationView({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const [next, page] = await Promise.all([getConversation(id), getConversationMessages(id)]); setConversation(next); setMessages(page.items); setCursor(page.cursor); setHasMore(page.hasMore); await markConversationSeen(id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Conversation could not be loaded."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { if (user) queueMicrotask(() => void refresh()); }, [user, refresh]);
  async function older() {
    if (!cursor) return;
    try { const page = await getConversationMessages(id, cursor); setMessages((current) => [...current, ...page.items]); setCursor(page.cursor); setHasMore(page.hasMore); }
    catch { setError("Older messages could not be loaded. Try again."); }
  }
  async function send() {
    if (!body.trim()) return;
    setSending(true); setError("");
    try { await sendConversationMessage(id, body); setBody(""); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Message could not be sent."); }
    finally { setSending(false); }
  }
  if (authLoading || (user && loading && !conversation)) return <div className="mx-auto h-80 max-w-2xl animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 text-center"><h1 className="page-title">Private conversation</h1><Link href={`/login?next=${encodeURIComponent(`/messages/${id}`)}`} className="button-primary mt-5 min-h-11 px-5">Log in</Link></div>;
  if (!conversation) return <div className="mx-auto max-w-2xl"><p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error || "Conversation unavailable."}</p><button type="button" className="button-secondary mt-3 min-h-11 px-5" onClick={() => void refresh()}>Retry</button></div>;
  return <div className="mx-auto max-w-2xl"><Link href="/messages" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--takeme-dark-green)]">← Messages</Link>
    <header className="rounded-3xl border border-gray-200 bg-white p-5"><p className="eyebrow">Listing conversation</p><h1 className="mt-1 text-xl font-bold">{conversation.otherName}</h1><Link href={`/listings/${conversation.listingId}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)] underline">{conversation.listingTitle}</Link>{conversation.transactionId && <Link href={`/transactions/${conversation.transactionId}`} className="ml-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)] underline">View agreed transaction</Link>}{user.uid === conversation.buyerId && <PublicSellerSummary uid={conversation.sellerId} variant="detail" />}<p className="mt-2 text-xs text-[var(--takeme-gray)]">Only you and the other participant can read this conversation. Do not share payment credentials.</p><ReportAction targetType="conversation" targetId={id} label="Report conversation" /></header>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section aria-label="Message history" className="mt-4 rounded-3xl border border-gray-200 bg-white p-4 sm:p-6">{hasMore && <button type="button" className="button-secondary mb-4 min-h-11 w-full" onClick={() => void older()}>Load older messages</button>}{!messages.length && <p className="py-10 text-center text-sm text-[var(--takeme-gray)]">No messages yet. Ask a question or coordinate your exchange.</p>}
      <ol className="flex flex-col gap-3">{[...messages].reverse().map((message) => <li key={message.id} className={`max-w-[90%] rounded-2xl p-3 text-sm leading-6 sm:max-w-[80%] ${message.senderId === user.uid ? "self-end rounded-br-md bg-[var(--takeme-light-green)]" : "self-start rounded-bl-md bg-stone-100"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><div className="mt-1 flex items-center justify-between gap-3"><time className="text-[10px] text-[var(--takeme-gray)]">{message.createdAt ? new Date(message.createdAt).toLocaleString("en-MY") : "Sending"}</time>{message.senderId !== user.uid && <ReportAction targetType="message" targetId={message.id} conversationId={id} label="Report" />}</div></li>)}</ol>
    </section>
    <form className="mt-3 rounded-2xl border border-gray-200 bg-white p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor="message-body" className="sr-only">Your message</label><textarea id="message-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} placeholder="Write a message about this listing" className="w-full resize-y rounded-xl border border-gray-200 p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--takeme-dark-green)]" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-[var(--takeme-gray)]">{body.length}/2000</span><button type="submit" disabled={sending || !body.trim()} className="button-primary min-h-11 px-5">{sending ? "Sending…" : "Send message"}</button></div></form>
  </div>;
}
