"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { getFollowState, setSellerFollow } from "@/lib/services/engagement";

export function FollowSellerButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState({ following: false, followerCount: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; getFollowState(sellerId).then((next) => { if (active) setState(next); }).catch(() => {}); return () => { active = false; }; }, [sellerId, user]);
  if (user?.uid === sellerId) return <span className="text-sm text-[var(--takeme-gray)]">{state.followerCount} followers</span>;
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/sellers/${sellerId}`)}`} className="button-secondary min-h-11 px-4">Log in to follow</Link>;
  return <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} aria-pressed={state.following} onClick={async () => { setBusy(true); setError(""); try { setState(await setSellerFollow(sellerId, !state.following)); } catch { setError("Could not update your follow. Try again."); } finally { setBusy(false); } }} className="button-secondary min-h-11 px-5">{state.following ? "Following" : "Follow seller"}</button><span className="text-sm text-[var(--takeme-gray)]">{state.followerCount} followers</span>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</div>;
}
