"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useCurrentTime } from "@/lib/use-current-time";
import {
  addProtectedDisputeEvidence,
  confirmTransactionCompletion,
  declineTransactionCancellation,
  disputeTransaction,
  getReputationPolicy,
  getTransactionDetail,
  requestTransactionCancellation,
  respondToProtectedDispute,
  submitTransactionReview,
  type ReputationPolicy,
} from "@/lib/services/transactions";
import type { MarketplaceTransaction, ProtectedTimelineEvent, ProtectedTransactionDetail } from "@/types/marketplace";
import { openTransactionConversation } from "@/lib/services/conversations";
import { useRouter } from "next/navigation";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const statusTitle = { in_progress: "Exchange in progress", completed: "Completed", cancelled: "Cancelled", disputed: "Disputed — awaiting review" };
const emptyProtected: ProtectedTransactionDetail = { payment: null, payout: null, refunds: [], dispute: null, timeline: [] };

function date(value: string | null) {
  return value ? new Date(value).toLocaleString("en-MY") : "Not recorded";
}
function stateLabel(value: string) {
  return value.replaceAll("_", " ");
}
function eventLabel(event: ProtectedTimelineEvent) {
  const labels: Record<string, string> = {
    transaction_created: "Protected transaction created", payment_created: "Payment started", payment_authorized: "Payment authorised",
    payment_protected: "Payment protected", seller_fulfilment_started: "Seller started fulfilment", shipment_recorded: "Shipment recorded",
    delivery_recorded: "Delivery recorded", buyer_received: "Buyer confirmed receipt", dispute_opened: "Dispute opened",
    evidence_added: "Evidence note added", seller_response_added: "Seller response added", dispute_resolved: "Dispute resolved",
    refund_requested: "Refund requested", refund_completed: "Refund completed", payout_eligible: "Payout became eligible",
    payout_started: "Payout processing", payout_completed: "Payout completed", transaction_completed: "Transaction completed",
  };
  return labels[event.eventType] ?? stateLabel(event.eventType);
}

export function TransactionView({ id }: { id: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const now = useCurrentTime(30_000);
  const [transaction, setTransaction] = useState<MarketplaceTransaction | null>(null);
  const [protectedDetail, setProtectedDetail] = useState<ProtectedTransactionDetail>(emptyProtected);
  const [reviewed, setReviewed] = useState(false);
  const [policy, setPolicy] = useState<ReputationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [sellerResponse, setSellerResponse] = useState("");
  const [evidence, setEvidence] = useState("");
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [retry, setRetry] = useState(0);

  function applyDetail(result: Awaited<ReturnType<typeof getTransactionDetail>>) {
    setTransaction(result.transaction);
    setReviewed(result.reviewed);
    setProtectedDetail({ payment: result.payment, payout: result.payout, refunds: result.refunds, dispute: result.dispute, timeline: result.timeline });
  }
  async function reload() {
    applyDetail(await getTransactionDetail(id));
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getTransactionDetail(id), getReputationPolicy()]).then(([result, nextPolicy]) => {
      if (!active) return;
      applyDetail(result); setPolicy(nextPolicy); setLoading(false);
    }).catch(() => { if (active) { setError("This transaction is unavailable or you are not a participant."); setLoading(false); } });
    return () => { active = false; };
  }, [id, user, retry]);
  async function act(task: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); await reload(); setNotice(message); setReason(""); setSellerResponse(""); setEvidence(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This action could not be completed."); }
    finally { setBusy(false); }
  }

  if (authLoading || (user && loading)) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center"><h1 className="text-2xl font-bold">Transaction status</h1><p className="mt-2 text-sm text-[var(--takeme-gray)]">Sign in as a buyer or seller to view this private deal.</p><Link href={`/login?next=${encodeURIComponent(`/transactions/${id}`)}`} className="button-primary mt-5 min-h-11 px-5">Log in</Link></div>;
  if (!transaction) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700"><p>{error || "Transaction not found."}</p><button type="button" className="button-secondary mt-3 min-h-11 px-4" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Retry transaction</button></div>;
  const buyer = user.uid === transaction.buyerId;
  const protectedMode = transaction.settlementMode === "protected";
  const ownConfirmed = buyer ? transaction.buyerConfirmedAt : transaction.sellerConfirmedAt;
  const otherConfirmed = buyer ? transaction.sellerConfirmedAt : transaction.buyerConfirmedAt;
  const reviewOpen = transaction.status === "completed" && Boolean(transaction.reviewWindowEndAt && now && new Date(transaction.reviewWindowEndAt).getTime() > now);
  const allowedTags = buyer ? policy?.buyerToSellerTags ?? [] : policy?.sellerToBuyerTags ?? [];
  const canConfirm = !protectedMode && transaction.status === "in_progress" && !transaction.cancellationRequestedBy && !ownConfirmed;
  const standardTimeline = [
    { label: "Agreement created", at: transaction.createdAt },
    ...(transaction.buyerConfirmedAt ? [{ label: "Buyer confirmed exchange", at: transaction.buyerConfirmedAt }] : []),
    ...(transaction.sellerConfirmedAt ? [{ label: "Seller confirmed exchange", at: transaction.sellerConfirmedAt }] : []),
    ...(transaction.completedAt ? [{ label: "Transaction completed", at: transaction.completedAt }] : []),
    ...(transaction.cancelledAt ? [{ label: "Transaction cancelled", at: transaction.cancelledAt }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return <div className="mx-auto max-w-2xl">
    <Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">← Your profile</Link>
    <p className="eyebrow mt-2">Private transaction</p><h1 className="page-title mt-2">{statusTitle[transaction.status]}</h1>
    <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--takeme-gray)]">{transaction.type === "auction" ? "Auction winner" : transaction.type === "offer" ? "Accepted offer" : "Fixed-price agreement"}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${protectedMode ? "bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]" : "bg-stone-100 text-stone-600"}`}>{protectedMode ? "Protected" : "Standard"}</span></div>
      <h2 className="mt-2 text-xl font-bold">{transaction.listingTitle}</h2><p className="mt-2 text-2xl font-bold">{money.format(transaction.amountSen / 100)}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">You are the {buyer ? "buyer" : "seller"}. {protectedMode ? "Payment and payout states are recorded separately from the marketplace transaction." : `Payment method: ${transaction.paymentMethod.replaceAll("_", " ")}. This agreed amount is not proof that TAKEME processed payment.`}</p>
      <Link href={`/listings/${transaction.listingId}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">View listing →</Link>
      <button type="button" disabled={busy} className="button-secondary mt-3 min-h-11 w-full" onClick={() => void act(async () => { const conversationId = await openTransactionConversation(id); router.push(`/messages/${conversationId}`); }, "Conversation opened.")}>Open Conversation</button>
    </div>

    {protectedMode ? <ProtectedStatus detail={protectedDetail} /> : <StandardCompletion transaction={transaction} busy={busy} canConfirm={canConfirm} ownConfirmed={ownConfirmed} otherConfirmed={otherConfirmed} userId={user.uid} reason={reason} setReason={setReason} act={act} />}

    {protectedMode && transaction.status === "in_progress" && !protectedDetail.dispute && <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Something wrong?</h2><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">The buyer can open a dispute for this protected deal. This pauses any future completion and payout eligibility; it does not move money automatically.</p>{buyer && <><label className="form-field mt-4"><span>Describe the issue</span><textarea maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy || !reason.trim()} onClick={() => void act(() => disputeTransaction(id, reason), "Dispute opened. Settlement remains paused for review.")} className="button-secondary mt-3 min-h-11 w-full px-4">Open protected dispute</button></>}</section>}

    {protectedMode && protectedDetail.dispute && <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Protected dispute · {stateLabel(protectedDetail.dispute.status)}</p><h2 className="mt-2 text-lg font-bold">{protectedDetail.dispute.description}</h2><p className="mt-2 text-xs text-amber-900">Opened {date(protectedDetail.dispute.openedAt)}. Resolution and refund decisions require an authorised server-side review.</p>
      {protectedDetail.dispute.sellerResponse && <div className="mt-4 rounded-xl bg-white p-4 text-sm"><strong>Seller response</strong><p className="mt-1 leading-6 text-stone-700">{protectedDetail.dispute.sellerResponse}</p></div>}
      {!buyer && protectedDetail.dispute.status === "awaiting_seller" && <><label className="form-field mt-4"><span>Seller response</span><textarea maxLength={2000} rows={4} value={sellerResponse} onChange={(event) => setSellerResponse(event.target.value)} /></label><button disabled={busy || !sellerResponse.trim()} onClick={() => void act(() => respondToProtectedDispute(id, sellerResponse), "Your response was recorded for review.")} className="button-secondary mt-3 min-h-11 w-full px-4">Submit response</button></>}
      {!["resolved_buyer", "resolved_seller", "partially_resolved", "cancelled"].includes(protectedDetail.dispute.status) && <><label className="form-field mt-4"><span>Add evidence note</span><textarea maxLength={1000} rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Describe relevant delivery, item, or communication evidence" /></label><button disabled={busy || !evidence.trim()} onClick={() => void act(() => addProtectedDisputeEvidence(id, evidence, crypto.randomUUID()), "Evidence note added to the immutable dispute record.")} className="button-secondary mt-3 min-h-11 w-full px-4">Add evidence note</button></>}
      {protectedDetail.dispute.evidence.length > 0 && <div className="mt-4 space-y-2"><h3 className="text-sm font-bold">Evidence notes</h3>{protectedDetail.dispute.evidence.map((item) => <article key={item.id} className="rounded-xl bg-white p-3 text-sm"><p className="font-semibold capitalize">{item.actorRole} · {date(item.createdAt)}</p><p className="mt-1 leading-6 text-stone-700">{item.note}</p></article>)}</div>}
    </section>}

    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Transaction timeline</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Only recorded events appear here. Missing steps are not predicted.</p><ol className="mt-4 space-y-3">{(protectedMode ? protectedDetail.timeline.map((item) => ({ id: item.id, label: eventLabel(item), at: item.createdAt, actor: item.actorType })) : standardTimeline.map((item) => ({ id: `${item.label}-${item.at}`, label: item.label, at: item.at, actor: "recorded" }))).map((item) => <li key={item.id} className="flex gap-3"><span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--takeme-green)]" /><span className="min-w-0 text-sm"><strong className="block capitalize">{item.label}</strong><span className="text-xs capitalize text-[var(--takeme-gray)]">{item.actor} · {date(item.at)}</span></span></li>)}</ol>{protectedMode && protectedDetail.timeline.length === 0 && <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-[var(--takeme-gray)]">No protected settlement events have been recorded.</p>}</section>

    {transaction.status === "completed" && <ReviewSection buyer={buyer} policy={policy} reviewed={reviewed} reviewOpen={reviewOpen} rating={rating} setRating={setRating} tags={tags} setTags={setTags} allowedTags={allowedTags} comment={comment} setComment={setComment} busy={busy} transaction={transaction} act={act} />}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--takeme-light-green)] p-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}

function ProtectedStatus({ detail }: { detail: ProtectedTransactionDetail }) {
  return <section className="mt-5 rounded-3xl border border-green-200 bg-white p-5 sm:p-7"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-[var(--takeme-dark-green)]" /><h2 className="text-lg font-bold">Protected settlement</h2></div><p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold tracking-wide text-amber-900">REAL PAYMENT MOVEMENT IS NOT ENABLED</p><p className="mt-3 text-sm leading-6 text-[var(--takeme-gray)]">The states below are separate records. A payment state never proves payout, fulfilment, refund, or transaction completion.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><StatusCard label="Payment" value={detail.payment ? stateLabel(detail.payment.status) : "Not recorded"} amount={detail.payment?.protectedAmountSen} /><StatusCard label="Seller payout" value={detail.payout ? stateLabel(detail.payout.status) : "Not recorded"} amount={detail.payout?.amountSen ?? undefined} /></div>
    {detail.refunds.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold">Refund records</h3><div className="mt-2 space-y-2">{detail.refunds.map((refund) => <p key={refund.id} className="rounded-xl bg-stone-50 p-3 text-sm"><strong className="capitalize">{stateLabel(refund.status)}</strong> · {money.format(refund.amountSen / 100)}<span className="mt-1 block text-xs text-[var(--takeme-gray)]">{refund.reason}</span></p>)}</div></div>}
  </section>;
}
function StatusCard({ label, value, amount }: { label: string; value: string; amount?: number }) {
  return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold text-[var(--takeme-gray)]">{label}</p><p className="mt-1 font-bold capitalize">{value}</p>{amount !== undefined && <p className="mt-1 text-sm">{money.format(amount / 100)}</p>}</div>;
}
function StandardCompletion({ transaction, busy, canConfirm, ownConfirmed, otherConfirmed, userId, reason, setReason, act }: { transaction: MarketplaceTransaction; busy: boolean; canConfirm: boolean; ownConfirmed: string | null; otherConfirmed: string | null; userId: string; reason: string; setReason: (value: string) => void; act: (task: () => Promise<unknown>, message: string) => Promise<void> }) {
  return <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Completion</h2>
    {transaction.status === "in_progress" ? <><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">Confirm only after the item and agreed payment have genuinely been exchanged. Both buyer and seller must confirm before completion counts toward reputation.</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p className="rounded-xl bg-stone-50 p-3">Buyer: <strong>{transaction.buyerConfirmedAt ? "confirmed" : "waiting"}</strong></p><p className="rounded-xl bg-stone-50 p-3">Seller: <strong>{transaction.sellerConfirmedAt ? "confirmed" : "waiting"}</strong></p></div>{ownConfirmed && !otherConfirmed && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">Your confirmation is saved. Waiting for the other party.</p>}{canConfirm && <button disabled={busy} onClick={() => void act(() => confirmTransactionCompletion(transaction.id), "Your confirmation was saved.")} className="button-primary mt-4 min-h-12 w-full px-4">I confirm the exchange is complete</button>}
      {transaction.cancellationRequestedBy && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Cancellation requested</p><p className="mt-1">{transaction.cancellationReason}</p>{transaction.cancellationRequestedBy !== userId ? <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void act(() => requestTransactionCancellation(transaction.id, "Agreed to cancellation"), "Both parties cancelled this deal.")} className="button-secondary min-h-11 flex-1 px-3">Agree to cancel</button><button disabled={busy} onClick={() => void act(() => declineTransactionCancellation(transaction.id), "Cancellation declined; discuss or open a dispute if needed.")} className="button-secondary min-h-11 flex-1 px-3">Decline</button></div> : <p className="mt-2 text-xs">Waiting for the other party. They may decline or open a dispute.</p>}</div>}
      {!transaction.cancellationRequestedBy && <details className="mt-5 border-t border-gray-100 pt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Cancel or dispute this deal</summary><label className="form-field mt-3"><span>What happened?</span><textarea maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || !reason.trim()} onClick={() => void act(() => requestTransactionCancellation(transaction.id, reason), "Cancellation requested; waiting for the other party.")} className="button-secondary min-h-11 px-4">Request cancellation</button><button disabled={busy || !reason.trim()} onClick={() => void act(() => disputeTransaction(transaction.id, reason), "Dispute opened. Completion and reviews are paused.")} className="button-secondary min-h-11 px-4">Open dispute</button></div></details>}
    </> : transaction.status === "completed" ? <p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">Both parties confirmed. This transaction now counts once toward buyer and seller activity. TAKEME did not process the payment.</p> : <p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">No completed-transaction credit, review eligibility, or GMV is recorded for this {transaction.status} deal.</p>}
  </section>;
}

function ReviewSection({ buyer, policy, reviewed, reviewOpen, rating, setRating, tags, setTags, allowedTags, comment, setComment, busy, transaction, act }: { buyer: boolean; policy: ReputationPolicy | null; reviewed: boolean; reviewOpen: boolean; rating: number; setRating: (value: number) => void; tags: string[]; setTags: React.Dispatch<React.SetStateAction<string[]>>; allowedTags: string[]; comment: string; setComment: (value: string) => void; busy: boolean; transaction: MarketplaceTransaction; act: (task: () => Promise<unknown>, message: string) => Promise<void> }) {
  return <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Review the {buyer ? "seller" : "buyer"}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">Reviews are private until both parties submit or the {policy?.reviewWindowDays ?? 14}-day window ends.</p>
    {reviewed ? <p className="mt-4 rounded-xl bg-[var(--takeme-light-green)] p-4 text-sm font-semibold text-[var(--takeme-dark-green)]">Review submitted. It cannot be edited; it will appear publicly after the double-blind release.</p> : !reviewOpen ? <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm">The review window has expired.</p> : <><p className="mt-4 text-sm font-semibold">Overall rating</p><div role="group" aria-label="Overall rating" className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} star${star === 1 ? "" : "s"}`} aria-pressed={rating === star} onClick={() => setRating(star)} className={`grid size-11 place-items-center rounded-xl text-xl ${rating >= star ? "bg-amber-100 text-amber-700" : "border border-gray-200 text-gray-400"}`}>★</button>)}</div><p className="mt-5 text-sm font-semibold">What went well? <span className="font-normal text-[var(--takeme-gray)]">Optional, up to four</span></p><div className="mt-2 flex flex-wrap gap-2">{allowedTags.map((tag) => <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 4 ? [...current, tag] : current)} className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${tags.includes(tag) ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]" : "border-gray-200"}`}>{tag}</button>)}</div><label className="form-field mt-5"><span>Written review (optional)</span><textarea maxLength={1000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share a fair, transaction-related experience" /></label><button disabled={busy || rating < 1} onClick={() => void act(() => submitTransactionReview(transaction.id, rating, tags, comment), "Review submitted. It stays hidden until both parties review or the window closes.")} className="button-primary mt-4 min-h-12 w-full px-4">Submit immutable review</button></>}
    {transaction.reviewWindowEndAt && <p className="mt-3 text-xs text-[var(--takeme-gray)]">Review window ends {date(transaction.reviewWindowEndAt)}.</p>}
  </section>;
}
