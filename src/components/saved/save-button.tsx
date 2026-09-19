"use client";

import { Heart, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { isListingSaved, removeSavedListing, saveListing } from "@/lib/services/saved";

export function SaveButton({ listingId, initialSaved, onChange, compact = false }: { listingId: string; initialSaved?: boolean; onChange?: (saved: boolean) => void; compact?: boolean }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [savedUid, setSavedUid] = useState(user?.uid);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || initialSaved !== undefined) return;
    let active = true;
    isListingSaved(listingId).then((value) => { if (active) { setSaved(value); setSavedUid(user.uid); } }).catch(() => { if (active) setError("Could not check saved status."); });
    return () => { active = false; };
  }, [user, listingId, initialSaved]);

  const className = compact
    ? "grid size-11 place-items-center rounded-full border border-gray-200 bg-white/95 text-[var(--takeme-dark-green)] shadow-sm"
    : "button-secondary mt-3 min-h-12 w-full gap-2";
  if (!user && !loading) return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={className} aria-label="Log in to save listing"><Heart size={20} />{!compact && "Save listing"}</Link>;
  const displaySaved = savedUid === user?.uid && saved;

  async function toggle() {
    if (!user || pending) return;
    const next = !displaySaved;
    setSaved(next); setSavedUid(user.uid); setPending(true); setError("");
    try {
      if (next) await saveListing(listingId);
      else await removeSavedListing(listingId);
      onChange?.(next);
    } catch {
      setSaved(!next);
      setError("Could not update saved listings. Please try again.");
    } finally { setPending(false); }
  }

  return <div className={compact ? "relative" : ""}><button type="button" onClick={() => void toggle()} disabled={pending || loading} className={className} aria-label={displaySaved ? "Remove from saved" : "Save listing"} aria-pressed={displaySaved} title={displaySaved ? "Remove from saved" : "Save listing"}>{pending ? <LoaderCircle size={20} className="animate-spin" /> : <Heart size={20} fill={displaySaved ? "currentColor" : "none"} />}{!compact && (displaySaved ? "Saved" : "Save listing")}</button>{error && <p role="alert" className={`text-xs text-red-700 ${compact ? "absolute right-0 top-full z-10 w-44 rounded-lg bg-white p-2 shadow-md" : "mt-1"}`}>{error}</p>}</div>;
}
