"use client";
import { useRef, useState } from "react";
import { useAdminSession } from "@admin/components/session";
import { call } from "@admin/lib/firebase";

const listingId = "6dV9mQnbYPa51UKXOTOu";
type Result = { listingId: string; status: string; mediaComplete: boolean; historicalReferencesPreserved: boolean; alreadyRemoved: boolean };

/** Direct operational route only: no navigation entry, arbitrary ID input or automatic action. */
export default function SyntheticFixtureCleanup() {
  const { state } = useAdminSession();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function cleanup() {
    if (state !== "allowed" || !confirmed || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await call<Result>("cleanupApprovedSyntheticFixture", { listingId });
      if (result.listingId !== listingId || result.status !== "removed" || result.mediaComplete !== true || result.historicalReferencesPreserved !== true)
        throw new Error("Incomplete cleanup");
      setMessage(result.alreadyRemoved
        ? "Already clean. The approved fixture remains withdrawn, its image is removed, and shared history is preserved."
        : "Cleanup complete. The approved fixture is withdrawn, its image is removed, and shared history is preserved.");
    } catch {
      setError("Cleanup could not be confirmed. Stop and review the server state before retrying; visibility may already be withdrawn.");
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <p className="eyebrow">Internal cleanup</p>
    <h1>Synthetic fixture cleanup</h1>
    <section className="panel">
      <h2>TAKEME Stage 7 Test Green Mug</h2>
      <p>Approved listing: <code>{listingId}</code></p>
      <p>This operation withdraws this one confirmed test listing and permanently removes its approved image. Offers, conversations, notifications, audit history and the account are preserved.</p>
      <p>All other listings are outside this operation. The server rechecks current Admin authority and exact fixture identity.</p>
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy || state !== "allowed"} onChange={event => setConfirmed(event.target.checked)} />I confirm this is the approved synthetic fixture and its image may be removed.</label>
      <button className="danger" disabled={busy || state !== "allowed" || !confirmed} onClick={() => void cleanup()}>{busy ? "Checking and cleaning…" : "Clean approved fixture / verify retry"}</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  </>;
}
