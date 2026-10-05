"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import { openListingConversation } from "@/lib/services/conversations";

export function MessageSellerAction({ listingId }: { listingId: string }) {
  const { user } = useAuth(); const router = useRouter();
  const requireAction = useProtectedMarketplaceAction();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/listings/${listingId}`)}&intent=chat`} className="button-secondary mt-3 min-h-12 w-full">Log in to message seller</Link>;
  async function open() { setBusy(true); setError(""); try { if (!await requireAction(`/listings/${listingId}`)) return; const id = await openListingConversation(listingId); router.push(`/messages/${id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open conversation."); } finally { setBusy(false); } }
  return <><button type="button" disabled={busy} onClick={() => void open()} className="button-secondary mt-3 min-h-12 w-full">{busy ? "Opening…" : "Message Seller"}</button>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</>;
}
