"use client";

import { Bell, Check, LoaderCircle, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getNotifications, getUnreadCount, markAllNotificationsRead, openNotification, type Notification } from "@/lib/services/engagement";

type Page = { items: Notification[]; cursor: string | null; hasMore: boolean };
const empty: Page = { items: [], cursor: null, hasMore: false };

export function NotificationsCenter() {
  const { user, loading: authLoading, configured } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState<Page>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getNotifications(), getUnreadCount()]).then(([next, summary]) => { if (active) { setPage(next); setUnreadCount(summary.unreadCount); setError(""); setLoading(false); } }).catch(() => { if (active) { setError("Notifications could not be loaded. Please try again."); setLoading(false); } });
    return () => { active = false; };
  }, [user, retry]);

  const read = useCallback(async (item: Notification) => {
    try {
      const result = await openNotification(item.id);
      setPage((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry) }));
      setUnreadCount((current) => Math.max(0, current - (item.readAt ? 0 : 1)));
      window.dispatchEvent(new Event("takeme:notifications-changed"));
      router.push(result.href);
    } catch { router.push(item.href); }
  }, [router]);

  async function markAll() {
    setBusy(true); setError("");
    try {
      // Each call touches at most 40 records. The server reports if another page remains.
      let remaining = false;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const result = await markAllNotificationsRead();
        remaining = result.hasMore;
        if (!result.hasMore) break;
      }
      const next = await getNotifications();
      setPage(next);
      setUnreadCount((await getUnreadCount()).unreadCount);
      if (remaining) setError("More unread notifications remain. Tap Mark all read again to continue.");
      window.dispatchEvent(new Event("takeme:notifications-changed"));
    } catch { setError("Some notifications could not be marked read. Please try again."); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!page.cursor) return;
    setBusy(true); setError("");
    try {
      const next = await getNotifications(page.cursor);
      setPage((current) => ({ items: [...current.items, ...next.items], cursor: next.cursor, hasMore: next.hasMore }));
    } catch { setError("More notifications could not be loaded. Please try again."); }
    finally { setBusy(false); }
  }

  if (!configured) return <FirebaseSetupState />;
  if (authLoading) return <RowsSkeleton />;
  if (!user) return <SignInRequired message="Log in to see your marketplace notifications." next="/updates" />;
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--takeme-gray)]">Real alerts from your saved items, searches, sellers, auctions and transactions.</p>
      <div className="flex gap-2"><Link href="/notification-preferences" className="button-secondary min-h-11 px-3 text-sm"><Settings2 size={16} /> Preferences</Link><button type="button" disabled={busy || loading || unreadCount <= 0} onClick={() => void markAll()} className="button-secondary min-h-11 px-3 text-sm"><Check size={16} /> Mark all read</button></div>
    </div>
    {error && <div role="alert"><ErrorState message={error} /><button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }} className="button-secondary mt-3 min-h-11 px-4">Try again</button></div>}
    {loading ? <RowsSkeleton /> : !page.items.length && !error ? <EmptyState title="You’re all caught up" description="Useful marketplace alerts will appear here when real events happen." /> : <div className="grid gap-2">{page.items.map((item) => <Link key={item.id} href={item.href} onClick={(event) => { event.preventDefault(); void read(item); }} aria-label={`${item.readAt ? "Read" : "Unread"} ${item.title}. ${item.body}`} className={`flex min-h-20 items-start gap-3 rounded-[1.35rem] border p-4 shadow-[var(--takeme-shadow-sm)] transition hover:shadow-[var(--takeme-shadow-md)] ${item.readAt ? "border-gray-200 bg-white" : "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]/40"}`}><span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[var(--takeme-dark-green)]"><Bell size={20} /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-sm font-bold">{item.title}</span>{!item.readAt && <span className="shrink-0 rounded-full bg-[var(--takeme-dark-green)] px-2 py-0.5 text-[10px] font-bold text-white">Unread</span>}</span><span className="mt-1 block text-sm text-[var(--takeme-gray)]">{item.body}</span><time className="mt-2 block text-xs text-[var(--takeme-gray)]" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time></span></Link>)}</div>}
    {page.hasMore && <button type="button" disabled={busy} onClick={() => void loadMore()} className="button-secondary mt-5 min-h-11 px-5">{busy && <LoaderCircle size={16} className="animate-spin" />} Load more</button>}
    <p className="mt-7 text-sm text-[var(--takeme-gray)]">Looking for current transaction actions? <Link href="/profile#transactions" className="font-semibold text-[var(--takeme-dark-green)] underline">View your transactions</Link>.</p>
  </div>;
}

function RowsSkeleton() { return <div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}</div>; }
