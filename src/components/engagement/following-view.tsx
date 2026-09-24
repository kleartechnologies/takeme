"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getFollowing, setSellerFollow, type FollowingSeller } from "@/lib/services/engagement";

export function FollowingView() {
  const { user, loading: authLoading, configured } = useAuth();
  const [items, setItems] = useState<FollowingSeller[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (!user) return; let active = true; getFollowing().then((page) => { if (active) { setItems(page.items); setCursor(page.cursor); setHasMore(page.hasMore); setLoading(false); } }).catch(() => { if (active) { setError("Following could not be loaded."); setLoading(false); } }); return () => { active = false; }; }, [user]);
  async function loadMore() { if (!cursor) return; setBusy("more"); try { const page = await getFollowing(cursor); setItems((current) => [...current, ...page.items]); setCursor(page.cursor); setHasMore(page.hasMore); } catch { setError("More sellers could not be loaded."); } finally { setBusy(""); } }
  async function unfollow(sellerId: string) { setBusy(sellerId); try { await setSellerFollow(sellerId, false); setItems((current) => current.filter((item) => item.sellerId !== sellerId)); } catch { setError("Could not unfollow this seller."); } finally { setBusy(""); } }
  if (!configured) return <FirebaseSetupState />;
  if (authLoading || loading && user) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in to see sellers you follow." next="/following" />;
  return <div>{error && <div role="alert"><ErrorState message={error} /></div>}{!items.length && !error ? <EmptyState title="Not following anyone yet" description="Follow sellers to hear about their newly published listings." /> : <div className="grid gap-3">{items.map((item) => <article key={item.sellerId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"><div><Link href={`/sellers/${item.sellerId}`} className="font-bold text-[var(--takeme-dark-green)] underline">{item.displayName}</Link><p className="text-sm text-[var(--takeme-gray)]">{item.location || "TAKEME seller"} · {item.sellerReviewCount > 0 ? `${item.sellerAverageRating.toFixed(1)} ★ (${item.sellerReviewCount} reviews)` : "New seller"}{item.sellerTier ? ` · ${item.sellerTier} tier` : ""}</p></div><button type="button" disabled={busy === item.sellerId} onClick={() => void unfollow(item.sellerId)} className="button-secondary min-h-11 px-4">Unfollow</button></article>)}</div>}{hasMore && <button type="button" disabled={busy === "more"} onClick={() => void loadMore()} className="button-secondary mt-5 min-h-11 px-5">Load more</button>}</div>;
}
