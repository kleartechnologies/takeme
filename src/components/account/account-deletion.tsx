"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { auth } from "@/lib/firebase/client";
import { logout } from "@/lib/firebase/auth";
import { friendlyAuthError } from "@/lib/firebase/auth-errors";
import { marketplaceOperator } from "@/content/operator";
import { assertCurrentDeletionOwner, getAccountDeletionAvailability, getAccountDeletionStatus, initiateAccountDeletion, reauthenticateForDeletion, type DeletionStatus } from "@/lib/services/account-deletion";

const blockers: Record<string, string> = {
  live_auction: "An auction with existing bids must finish without changing the bids or winner.",
  auction_finalisation: "The auction result is being finalised.",
  unfinished_deal: "An accepted deal needs a valid completion, cancellation or expiry.",
  unresolved_report: "A marketplace report needs resolution.",
  unresolved_dispute: "A dispute needs resolution.",
  unresolved_case: "A marketplace case needs resolution.",
  unknown_legacy_schema: "Historical data needs classification before it can be safely cleaned.",
};

export function AccountDeletionDisclosure() {
  return <div className="space-y-5 text-sm leading-7 text-[var(--takeme-gray)]">
    <p>Use this page to request deletion of your TAKEME account in your browser. You do not need to reinstall the app. Sign in to the account you own, then confirm your identity before submitting.</p>
    <div><h2 className="text-base font-semibold text-[var(--takeme-charcoal)]">What deletion removes</h2><p>Your public profile, private addresses and meet-up locations, saved items, follow relationships, searches, notifications, preferences and recommendation history are removed. Your uploaded profile and listing files are cleaned up when the relevant deletion stage permits it. Your ordinary authored messages, attachments and previews are removed. Marketplace identity is replaced with “Deleted user”.</p></div>
    <div><h2 className="text-base font-semibold text-[var(--takeme-charcoal)]">If deletion is pending</h2><p>Your public profile is removed and normal marketplace activity stops. You cannot create listings, bids or offers. Safe unsold content is withdrawn. Auctions with existing bids, unfinished accepted deals and unresolved reports or disputes can delay final deletion. Existing bids and legitimate deal outcomes are preserved; deletion does not automatically cancel, complete or settle a deal.</p><p>You can still sign in to check progress and use existing deal-resolution actions. A pending or failed request means your account has not yet been fully deleted.</p></div>
    <div><h2 className="text-base font-semibold text-[var(--takeme-charcoal)]">Limited history and evidence</h2><ul className="list-disc space-y-2 pl-5"><li>Counterparties’ own conversation messages may remain for up to 90 days after the related deal closes. Conversations without a deal expire within 90 days of cleanup.</li><li>Minimal pseudonymised closed-deal history is retained for 12 months. Authentic ratings and predefined tags about surviving members may remain during the history retention period; your identity and free-text review comments are removed. Public reviews about your deleted profile are removed.</li><li>Necessary report/dispute evidence is isolated from ordinary account access until case resolution, then for up to 180 days after closure.</li><li>Security or fraud evidence requires an explicit restricted hold with a documented purpose and expiry.</li><li>Deletion-operation working and audit data is retained for 30 days after successful completion.</li></ul></div>
    <p>Live deletion does not immediately erase historical backups or logs. TAKEME account deletion does not delete your Google account. Success is shown only after required cleanup and deletion of your Firebase Auth account both succeed.</p>
  </div>;
}

export function AccountDeletionFlow() {
  const { user, loading, configured } = useAuth();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [statusOwner, setStatusOwner] = useState<string | null>(null);
  const [passwordEntry, setPasswordEntry] = useState({ uid: "", value: "" });
  const password = passwordEntry.uid === user?.uid ? passwordEntry.value : "";
  const setPassword = (value: string) => setPasswordEntry({ uid: user?.uid ?? "", value });
  const visibleStatus = user && statusOwner !== user.uid ? null : status;
  const [confirmation, setConfirmation] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"password" | "google" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const providers = user?.providerData.map((provider) => provider.providerId) ?? [];
  const method = selectedMethod ?? (providers.includes("password") ? "password" : "google");
  const requested = visibleStatus && visibleStatus.state !== "not_requested" && visibleStatus.state !== "completed";

  useEffect(() => {
    let active = true;
    void getAccountDeletionAvailability().then(result => {
      if (active) { setAvailable(result.available); setAvailabilityError(false); }
    }).catch(() => { if (active) { setAvailable(null); setAvailabilityError(true); } });
    return () => { active = false; };
  }, [configured, availabilityRevision]);

  useEffect(() => {
    if (!user || available !== true) return;
    let active = true;
    const read = async () => {
      try { const next = await getAccountDeletionStatus(); if (active && auth?.currentUser?.uid === user.uid) { setStatusOwner(user.uid); setStatus(next); setStatusUnavailable(false); if (next.state === "completed") { await logout(); requestAnimationFrame(() => statusHeading.current?.focus()); } } }
      catch { if (active) setStatusUnavailable(true); }
    };
    void read();
    const timer = setInterval(() => void read(), 10_000);
    return () => { active = false; clearInterval(timer); };
  }, [user, available]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || available !== true || busy || confirmation !== "DELETE") return;
    setBusy(true); setError("");
    try {
      assertCurrentDeletionOwner(user.uid);
      await reauthenticateForDeletion(user, method, password);
      setPassword("");
      assertCurrentDeletionOwner(user.uid);
      const next = await initiateAccountDeletion(user.uid, Boolean(requested));
      if (auth?.currentUser?.uid !== user.uid) return;
      setStatusOwner(user.uid); setStatus(next); setConfirmation("");
      if (next.state === "completed") await logout();
      requestAnimationFrame(() => statusHeading.current?.focus());
    } catch (caught) { setConfirmation(""); setError(friendlyAuthError(caught)); }
    finally { setPassword(""); setBusy(false); }
  }

  if (visibleStatus?.state === "completed") return <section className="profile-settings-card mt-6" aria-live="polite"><h2 ref={statusHeading} tabIndex={-1} className="text-lg font-semibold">Your TAKEME account was deleted</h2><p className="mt-3 text-sm leading-6">Required live-data cleanup and Firebase Auth account deletion succeeded. Only the limited history and restricted evidence described above may remain until their retention limits expire.</p></section>;
  return <section className="profile-settings-card mt-6" aria-busy={busy}>
    <h2 ref={statusHeading} tabIndex={-1} className="text-lg font-semibold">{requested ? "Account deletion progress" : "Request account deletion"}</h2>
    {loading ? <p role="status" className="mt-3">Loading your account…</p> : !configured ? <p role="alert" className="mt-3">Account deletion and sign-in are temporarily unavailable.</p> : available !== true ? <div className="mt-4 space-y-3"><p role={availabilityError ? "alert" : "status"} className="text-sm leading-6">{availabilityError ? "Deletion availability could not be checked. No deletion request has been submitted." : available === null ? "Checking deletion availability…" : "Account deletion is not enabled for this environment. No deletion request has been submitted. Contact TAKEME support for help."}</p>{availabilityError && <button className="button-primary min-h-12 px-5" onClick={() => setAvailabilityRevision(value => value + 1)}>Check again</button>}<a className="inline-block underline" href={`mailto:${marketplaceOperator.supportEmail}`}>Contact TAKEME support</a></div> : !user ? <div className="mt-4 space-y-3"><p className="text-sm leading-6">Sign in securely with your existing email/password or Google account. Your account information is shown only after authentication.</p><Link href="/login?next=/account-deletion" className="button-primary min-h-12 px-5">Sign in to request deletion</Link></div> : <>
      <p className="mt-3 break-words text-sm">Signed in as {user.email ?? "your TAKEME account"}.</p>
      {statusUnavailable && <p role="status" className="mt-3 text-sm">Progress could not be refreshed. This does not mean deletion succeeded. You can reauthenticate and safely retry.</p>}
      {requested && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6" role="status"><p className="font-semibold">{visibleStatus.state === "failed" ? "Cleanup needs a retry" : visibleStatus.state === "blocked" ? "Deletion needs data classification" : "Deletion pending"}</p><p>Your account is not fully deleted. Normal marketplace activity is blocked.</p>{visibleStatus.blockers?.length ? <ul className="mt-2 list-disc pl-5">{visibleStatus.blockers.map((reason) => <li key={reason}>{blockers[reason] ?? "An existing marketplace obligation needs resolution."}</li>)}</ul> : <p>Required cleanup is still in progress.</p>}<Link href="/profile/transactions" className="mt-3 inline-block font-semibold underline">Resolve existing transactions</Link></div>}
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        {providers.includes("password") && providers.includes("google.com") && <label className="form-field"><span>Confirm identity with</span><select value={method} onChange={(event) => setSelectedMethod(event.target.value as "password" | "google")} disabled={busy}><option value="password">Current password</option><option value="google">Google</option></select></label>}
        {method === "password" ? <label className="form-field"><span>Current password</span><input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} /></label> : <p className="text-sm leading-6">Google will ask you to confirm the same account before the deletion request is submitted.</p>}
        <label className="form-field"><span>Type DELETE to confirm</span><input autoComplete="off" spellCheck={false} required value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} aria-describedby="deletion-confirmation-help" /></label>
        <p id="deletion-confirmation-help" className="text-xs leading-5">This request starts permanent cleanup. It cannot be undone. Final deletion may wait for the obligations described above.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy || confirmation !== "DELETE" || method === "password" && !password} className="min-h-12 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Confirming identity and processing…" : requested ? "Reauthenticate and retry cleanup" : "Reauthenticate and request deletion"}</button>
      </form>
    </>}
  </section>;
}
