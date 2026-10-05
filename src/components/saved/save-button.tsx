"use client";

import { Heart, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import { isListingSaved, removeSavedListing, saveListing } from "@/lib/services/saved";
import type { SavedChange } from "@/lib/marketplace-state-events";
import { protectedWriteMaintenanceMessage } from "@/lib/protected-write-maintenance";

export function SaveButton({ listingId, initialSaved, onChange, compact = false }: { listingId: string; initialSaved?: boolean; onChange?: (saved: boolean) => void; compact?: boolean }) {
  const { user, loading } = useAuth();
  const requireAction = useProtectedMarketplaceAction();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [savedUid, setSavedUid] = useState(user?.uid);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const reads = useRef(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => { const request = ++reads.current; return isListingSaved(listingId).then((value) => { if (active && request === reads.current) { setSaved(value); setSavedUid(user.uid); setError(""); } }).catch(() => { if (active && request === reads.current) setError("Could not check saved status."); }); };
    if (initialSaved === undefined) void refresh();
    const changed = (event: Event) => { const change = (event as CustomEvent<SavedChange>).detail; if (change.uid === user.uid && change.listingId === listingId) { reads.current++; setSaved(change.saved); setSavedUid(user.uid); setError(""); } };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("takeme:saved-changed", changed);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.removeEventListener("takeme:saved-changed", changed); document.removeEventListener("visibilitychange", visible); };
  }, [user, listingId, initialSaved]);

  const className = compact
    ? "grid size-11 place-items-center rounded-full border border-gray-200 bg-white/95 text-[var(--takeme-dark-green)] shadow-sm"
    : "button-secondary mt-3 min-h-12 w-full gap-2";
  if (!user && !loading) return <Link href={`/login?next=${encodeURIComponent(pathname)}&intent=save`} onClick={event => { event.preventDefault(); void requireAction().catch(() => undefined); }} className={className} aria-label="Log in to save listing"><Heart size={20} />{!compact && "Save listing"}</Link>;
  const displaySaved = savedUid === user?.uid && saved;

  async function toggle() {
    if (!user || pending) return;
    try { if (!await requireAction()) return; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not check your account. Please try again."); return; }
    const next = !displaySaved;
    reads.current++;
    setSaved(next); setSavedUid(user.uid); setPending(true); setError("");
    try {
      if (next) await saveListing(listingId);
      else await removeSavedListing(listingId);
      onChange?.(next);
    } catch (caught) {
      setSaved(!next);
      setError(protectedWriteMaintenanceMessage(caught) ?? "Could not update saved listings. Please try again.");
    } finally { setPending(false); }
  }

  return <div className={compact ? "relative" : ""}><button type="button" onClick={() => void toggle()} disabled={pending || loading} className={className} aria-label={displaySaved ? "Remove from saved" : "Save listing"} aria-pressed={displaySaved} title={displaySaved ? "Remove from saved" : "Save listing"}>{pending ? <LoaderCircle size={20} className="animate-spin" /> : <Heart size={20} fill={displaySaved ? "currentColor" : "none"} />}{!compact && (displaySaved ? "Saved" : "Save listing")}</button>{error && <p role="alert" className={`text-xs text-red-700 ${compact ? "absolute right-0 top-full z-10 w-44 rounded-lg bg-white p-2 shadow-md" : "mt-1"}`}>{error}</p>}</div>;
}
