"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getConversations, type ConversationSummary } from "@/lib/services/conversations";

export function MessagesInbox() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (next: string | null = null) => {
    setLoading(true); setError("");
    try { const page = await getConversations(next); setItems((current) => next ? [...current, ...page.items] : page.items); setCursor(page.cursor); setHasMore(page.hasMore); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Messages could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) queueMicrotask(() => void load()); }, [user, load]);
  if (authLoading) return <div className="h-64 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <section className="rounded-3xl border border-gray-200 bg-white p-6 text-center"><h1 className="page-title">Messages</h1><p className="mt-3 text-sm text-[var(--takeme-gray)]">Sign in to ask sellers about listings and coordinate your deals.</p><Link className="button-primary mt-5 min-h-11 px-5" href="/login?next=%2Fmessages">Log in</Link></section>;
  return <div className="mx-auto max-w-2xl"><h1 className="page-title">Messages</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">Conversations about listings and agreed exchanges.</p>
    {error && <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" className="ml-3 min-h-11 font-bold underline" onClick={() => void load(cursor)}>Retry</button></div>}
    {loading && !items.length && <div className="mt-5 h-44 animate-pulse rounded-2xl bg-stone-100" />}
    {!loading && !error && !items.length && <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 text-center"><h2 className="font-bold">No conversations yet</h2><p className="mt-2 text-sm text-[var(--takeme-gray)]">Open a listing and tap Message Seller to get started.</p><Link className="button-secondary mt-4 min-h-11 px-5" href="/explore">Explore listings</Link></div>}
    <div className="mt-5 divide-y divide-gray-100 rounded-2xl bg-white">{items.map((item) => <Link key={item.id} href={`/messages/${item.id}`} className="flex min-h-24 items-center gap-3 rounded-xl bg-white px-2 py-4 transition hover:bg-[var(--takeme-light-green)] focus-visible:outline-2 focus-visible:outline-[var(--takeme-dark-green)]"><span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">{item.listingImage && <Image src={item.listingImage} alt="" fill sizes="64px" className="object-cover" />}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{item.otherName}</strong>{item.unreadCount ? <span className="rounded-full bg-[var(--takeme-dark-green)] px-2 py-0.5 text-xs font-bold text-white">{item.unreadCount}</span> : null}</span><span className="mt-1 block truncate text-xs text-[var(--takeme-gray)]">{item.latestMessage ?? "No messages yet"}</span><span className="mt-1 block truncate text-xs font-medium text-[var(--takeme-dark-green)]">{item.listingTitle}</span></span><time className="self-start whitespace-nowrap text-[10px] text-[var(--takeme-gray)]">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("en-MY") : ""}</time></Link>)}</div>
    {hasMore && <button type="button" disabled={loading} className="button-secondary mt-4 min-h-11 w-full" onClick={() => void load(cursor)}>Load more conversations</button>}
  </div>;
}
