"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePublicAuth, useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import { getFollowState, setSellerFollow } from "@/lib/services/engagement";
import type { FollowChange } from "@/lib/marketplace-state-events";

export function FollowSellerButton({ sellerId }: { sellerId: string }) {
  const { user, loading } = usePublicAuth();
  const requireAction = useProtectedMarketplaceAction();
  const [state, setState] = useState<{ sellerId: string; viewer: string; following: boolean; followerCount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reads = useRef(0);
  const mutation = useRef(false);
  const viewer = user?.uid ?? "";
  useEffect(() => {
    let active = true;
    const refresh = () => { const request = ++reads.current; return getFollowState(sellerId).then((next) => { if (active && request === reads.current) { setState({ sellerId, viewer, ...next }); setError(""); } }).catch(() => { if (active && request === reads.current) setError("Follow information is unavailable."); }); };
    void refresh();
    const changed = (event: Event) => { const change = (event as CustomEvent<FollowChange>).detail; if (change.uid === viewer && change.sellerId === sellerId) { reads.current++; setState({ sellerId, viewer, following: change.following, followerCount: change.followerCount }); setError(""); } };
    const visible = () => { if (document.visibilityState === "visible" && !mutation.current) void refresh(); };
    window.addEventListener("takeme:follow-changed", changed); document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.removeEventListener("takeme:follow-changed", changed); document.removeEventListener("visibilitychange", visible); };
  }, [sellerId, viewer]);
  const current = state?.sellerId === sellerId && state.viewer === viewer ? state : null;
  async function toggle() {
    if (!current || !user || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      if (!await requireAction(`/sellers/${sellerId}`)) return;
      const following = !current.following;
      reads.current++;
      setState({ sellerId, viewer, following, followerCount: Math.max(0, current.followerCount + (following ? 1 : -1)) });
      try {
        const result = await setSellerFollow(sellerId, following);
        reads.current++;
        setState({ sellerId, viewer, ...result });
      } catch (caught) {
        reads.current++;
        setState(current);
        throw caught;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your follow. Try again.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  if (user?.uid === sellerId) return current ? <span className="text-sm text-[var(--takeme-gray)]">{current.followerCount} followers</span> : null;
  if (loading) return <button type="button" disabled className="button-secondary min-h-11 px-4">Follow seller</button>;
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/sellers/${sellerId}`)}&intent=follow`} className="button-secondary min-h-11 px-4">Log in to follow</Link>;
  return <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !current} aria-pressed={current?.following ?? false} onClick={() => void toggle()} className="button-secondary min-h-11 px-5">{current?.following ? "Following" : "Follow seller"}</button>{current && <span className="text-sm text-[var(--takeme-gray)]">{current.followerCount} followers</span>}{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</div>;
}
