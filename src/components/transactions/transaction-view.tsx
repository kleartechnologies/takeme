"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useCurrentTime } from "@/lib/use-current-time";
import { confirmTransactionCompletion, declineTransactionCancellation, disputeTransaction, getReputationPolicy, getTransactionDetail, requestTransactionCancellation, submitTransactionReview, type ReputationPolicy } from "@/lib/services/transactions";
import type { MarketplaceTransaction } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const statusTitle = { in_progress: "Exchange in progress", completed: "Completed by both parties", cancelled: "Cancelled", disputed: "Disputed — awaiting manual review" };

export function TransactionView({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const now = useCurrentTime(30_000);
  const [transaction, setTransaction] = useState<MarketplaceTransaction | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [policy, setPolicy] = useState<ReputationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  async function reload() {
    const result = await getTransactionDetail(id);
    setTransaction(result.transaction); setReviewed(result.reviewed);
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getTransactionDetail(id), getReputationPolicy()]).then(([result, nextPolicy]) => {
      if (!active) return;
      setTransaction(result.transaction); setReviewed(result.reviewed); setPolicy(nextPolicy); setLoading(false);
    }).catch(() => { if (active) { setError("This transaction is unavailable or you are not a participant."); setLoading(false); } });
    return () => { active = false; };
  }, [id, user]);
  async function act(task: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); await reload(); setNotice(message); setReason(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This action could not be completed."); }
    finally { setBusy(false); }
  }

  if (authLoading || (user && loading)) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center"><h1 className="text-2xl font-bold">Transaction status</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">Sign in as a buyer or seller to view this private deal.</p><Link href={`/login?next=${encodeURIComponent(`/transactions/${id}`)}`} className="button-primary mt-5 min-h-11 px-5">Log in</Link></div>;
  if (!transaction) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error || "Transaction not found."}</div>;
  const buyer = user.uid === transaction.buyerId;
  const ownConfirmed = buyer ? transaction.buyerConfirmedAt : transaction.sellerConfirmedAt;
  const otherConfirmed = buyer ? transaction.sellerConfirmedAt : transaction.buyerConfirmedAt;
  const reviewOpen = transaction.status === "completed" && Boolean(transaction.reviewWindowEndAt && now && new Date(transaction.reviewWindowEndAt).getTime() > now);
  const allowedTags = buyer ? policy?.buyerToSellerTags ?? [] : policy?.sellerToBuyerTags ?? [];
  const canConfirm = transaction.status === "in_progress" && !transaction.cancellationRequestedBy && !ownConfirmed;
  return <div className="mx-auto max-w-2xl">
    <Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">← Your profile</Link>
    <p className="eyebrow mt-2">Private transaction</p><h1 className="page-title mt-2">{statusTitle[transaction.status]}</h1>
    <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--takeme-gray)]">{transaction.type === "auction" ? "Auction winner" : transaction.type === "offer" ? "Accepted offer" : "Fixed-price agreement"}</p>
      <h2 className="mt-2 text-xl font-bold">{transaction.listingTitle}</h2><p className="mt-2 text-2xl font-bold">{money.format(transaction.amountSen / 100)}</p>
      <p className="mt-2 text-sm text-[var(--takeme-gray)]">You are the {buyer ? "buyer" : "seller"}. Payment method: {transaction.paymentMethod.replaceAll("_", " ")}. This is an agreed amount, not proof that TAKEME processed payment.</p>
      <Link href={`/listings/${transaction.listingId}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">View listing →</Link>
    </div>
    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Completion</h2>
      {transaction.status === "in_progress" ? <><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">Confirm only after the item and agreed payment have genuinely been exchanged. Both buyer and seller must confirm before completion counts toward reputation.</p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p className="rounded-xl bg-stone-50 p-3">Buyer: <strong>{transaction.buyerConfirmedAt ? "confirmed" : "waiting"}</strong></p><p className="rounded-xl bg-stone-50 p-3">Seller: <strong>{transaction.sellerConfirmedAt ? "confirmed" : "waiting"}</strong></p></div>
        {ownConfirmed && !otherConfirmed && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">Your confirmation is saved. Waiting for the other party.</p>}
        {canConfirm && <button disabled={busy} onClick={() => void act(() => confirmTransactionCompletion(id), "Your confirmation was saved.")} className="button-primary mt-4 min-h-12 w-full px-4">I confirm the exchange is complete</button>}
        {transaction.cancellationRequestedBy && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Cancellation requested</p><p className="mt-1">{transaction.cancellationReason}</p>{transaction.cancellationRequestedBy !== user.uid ? <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void act(() => requestTransactionCancellation(id, "Agreed to cancellation"), "Both parties cancelled this deal.")} className="button-secondary min-h-11 flex-1 px-3">Agree to cancel</button><button disabled={busy} onClick={() => void act(() => declineTransactionCancellation(id), "Cancellation declined; discuss or open a dispute if needed.")} className="button-secondary min-h-11 flex-1 px-3">Decline</button></div> : <p className="mt-2 text-xs">Waiting for the other party. They may decline or open a dispute.</p>}</div>}
        {!transaction.cancellationRequestedBy && <details className="mt-5 border-t border-gray-100 pt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Cancel or dispute this deal</summary><label className="form-field mt-3"><span>What happened?</span><textarea maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || !reason.trim()} onClick={() => void act(() => requestTransactionCancellation(id, reason), "Cancellation requested; waiting for the other party.")} className="button-secondary min-h-11 px-4">Request cancellation</button><button disabled={busy || !reason.trim()} onClick={() => void act(() => disputeTransaction(id, reason), "Dispute opened. Completion and reviews are paused.")} className="button-secondary min-h-11 px-4">Open dispute</button></div></details>}
      </> : transaction.status === "completed" ? <p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">Both parties confirmed. This transaction now counts once toward buyer and seller activity. TAKEME did not process the payment.</p> : <p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">No completed-transaction credit, review eligibility, or GMV is recorded for this {transaction.status} deal.</p>}
    </section>
    {transaction.status === "completed" && <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Review the {buyer ? "seller" : "buyer"}</h2>
      <p className="mt-1 text-sm text-[var(--takeme-gray)]">Reviews are private until both parties submit or the {policy?.reviewWindowDays ?? 14}-day window ends.</p>
      {reviewed ? <p className="mt-4 rounded-xl bg-[var(--takeme-light-green)] p-4 text-sm font-semibold text-[var(--takeme-dark-green)]">Review submitted. It cannot be edited; it will appear publicly after the double-blind release.</p>
        : !reviewOpen ? <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm">The review window has expired.</p>
          : <><p className="mt-4 text-sm font-semibold">Overall rating</p><div role="group" aria-label="Overall rating" className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} star${star === 1 ? "" : "s"}`} aria-pressed={rating === star} onClick={() => setRating(star)} className={`grid size-11 place-items-center rounded-xl text-xl ${rating >= star ? "bg-amber-100 text-amber-700" : "border border-gray-200 text-gray-400"}`}>★</button>)}</div>
            <p className="mt-5 text-sm font-semibold">What went well? <span className="font-normal text-[var(--takeme-gray)]">Optional, up to four</span></p><div className="mt-2 flex flex-wrap gap-2">{allowedTags.map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 4 ? [...current, tag] : current)} className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${tags.includes(tag) ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]" : "border-gray-200"}`}>{tag}</button>)}</div>
            <label className="form-field mt-5"><span>Written review (optional)</span><textarea maxLength={1000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share a fair, transaction-related experience" /></label>
            <button disabled={busy || rating < 1} onClick={() => void act(() => submitTransactionReview(id, rating, tags, comment), "Review submitted. It stays hidden until both parties review or the window closes.")} className="button-primary mt-4 min-h-12 w-full px-4">Submit immutable review</button></>}
      {transaction.reviewWindowEndAt && <p className="mt-3 text-xs text-[var(--takeme-gray)]">Review window ends {new Date(transaction.reviewWindowEndAt).toLocaleString("en-MY")}.</p>}
    </section>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--takeme-light-green)] p-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
