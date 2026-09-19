"use client";

import { Clock3, Gavel, LoaderCircle, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMinimumNextBid, ringgitToSen, senToRinggit } from "@/lib/listing-validation";
import { cancelAuctionListing, placeAuctionBid, subscribeToBidHistory } from "@/lib/services/auctions";
import { useCurrentTime } from "@/lib/use-current-time";
import type { AuctionStatus, Bid, Listing } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatSen(value: number) {
  return money.format(value / 100);
}

function effectiveStatus(listing: Listing, now: number): AuctionStatus {
  if (listing.auctionStatus === "cancelled" || listing.auctionStatus === "ended") return listing.auctionStatus;
  if (now === 0) return listing.auctionStatus ?? "scheduled";
  if (listing.auctionEndAt && now >= new Date(listing.auctionEndAt).getTime()) return "ended";
  if (listing.auctionStartAt && now < new Date(listing.auctionStartAt).getTime()) return "scheduled";
  return "active";
}

function countdown(target: string | undefined, now: number) {
  if (!target || now === 0) return "—";
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  if (hours > 0) return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  if (minutes > 0) return `${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs).padStart(2, "0")}s`;
}

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AuctionPanel({ listing, userId, owner }: { listing: Listing; userId?: string; owner: boolean }) {
  const now = useCurrentTime();
  const [bids, setBids] = useState<Bid[]>([]);
  const [historyError, setHistoryError] = useState("");
  const minimum = getMinimumNextBid(listing);
  const [amount, setAmount] = useState(() => minimum ? senToRinggit(minimum) : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const status = effectiveStatus(listing, now);

  useEffect(() => subscribeToBidHistory(listing.id, setBids, (nextError) => setHistoryError(nextError.message)), [listing.id]);

  const amountSen = ringgitToSen(amount);
  const inputError = useMemo(() => {
    if (!amount) return "";
    if (!amountSen) return "Use a positive amount with no more than 2 decimal places.";
    if (amountSen < minimum) return `Minimum next bid is ${formatSen(minimum)}.`;
    return "";
  }, [amount, amountSen, minimum]);

  async function submitBid(event: React.FormEvent) {
    event.preventDefault();
    if (!amountSen || inputError) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await placeAuctionBid(listing.id, amountSen);
      setMessage(`Bid accepted at ${formatSen(result.currentBid)}.`);
      setAmount(senToRinggit(result.currentBid + (listing.minimumBidIncrement ?? 0)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Your bid could not be placed.");
    } finally { setBusy(false); }
  }

  async function cancel() {
    setBusy(true); setError("");
    try { await cancelAuctionListing(listing.id); setMessage("Auction cancelled."); setConfirmCancel(false); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "The auction could not be cancelled."); }
    finally { setBusy(false); }
  }

  const highest = listing.currentBidderId === userId && Boolean(userId);
  const outbid = Boolean(userId && !highest && bids.some((bid) => bid.bidderId === userId));
  const hasWinner = Boolean(listing.winnerId || ((listing.bidCount ?? 0) > 0 && status === "ended"));
  const target = status === "scheduled" ? listing.auctionStartAt : listing.auctionEndAt;

  return <div className="mt-6 grid gap-5">
    <div className="rounded-2xl bg-[var(--takeme-charcoal)] p-5 text-white">
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">{status === "scheduled" ? "Starts in" : status === "active" ? "Time remaining" : "Auction status"}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold capitalize">{status === "active" && listing.auctionEndAt && now > 0 && new Date(listing.auctionEndAt).getTime() - now < 3_600_000 ? "Ending soon" : status}</span></div>
      <p className="mt-3 font-mono text-2xl font-bold tracking-tight">{status === "cancelled" ? "Cancelled" : status === "ended" ? "Ended" : countdown(target, now)}</p>
      <p className="mt-2 text-xs text-white/65">Times are displayed in your local timezone. Server time controls bid acceptance.</p>
    </div>

    <div className="grid grid-cols-2 gap-3"><Metric label={(listing.bidCount ?? 0) > 0 ? "Current bid" : "Starting bid"} value={formatSen((listing.bidCount ?? 0) > 0 ? listing.currentBid ?? 0 : listing.startingBid ?? 0)} /><Metric label="Bids" value={String(listing.bidCount ?? 0)} /></div>

    {status === "active" && !owner && userId && <form onSubmit={submitBid} className="rounded-2xl border border-[var(--takeme-green)]/25 bg-[var(--takeme-light-green)] p-4"><label className="form-field"><span>Your bid (RM)</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" type="number" min="0.01" step="0.01" aria-invalid={Boolean(inputError)} /></label><p className="mt-2 text-xs text-[var(--takeme-gray)]">Minimum next bid: <strong className="text-[var(--takeme-dark-green)]">{formatSen(minimum)}</strong></p>{inputError && <p className="field-error mt-2">{inputError}</p>}<button disabled={busy || Boolean(inputError) || !amount} className="button-primary mt-4 h-11 w-full" type="submit">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Gavel size={17} />} Place Bid</button></form>}

    {status === "active" && !userId && !owner && <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm"><p className="font-semibold">Ready to bid?</p><p className="mt-1 text-[var(--takeme-gray)]">Sign in first so the server can securely verify your bid.</p><Link href={`/login?next=/listings/${listing.id}`} className="button-primary mt-4 h-10 px-4">Log in to bid</Link></div>}
    {owner && status === "active" && <Notice icon={<ShieldCheck size={18} />} text={(listing.bidCount ?? 0) > 0 ? "You cannot bid on your own auction, and it can no longer be cancelled because bidding has started." : "You cannot bid on your own auction. You may cancel it while it has no bids."} />}
    {status === "scheduled" && <Notice icon={<Clock3 size={18} />} text={`Bidding opens ${new Date(listing.auctionStartAt!).toLocaleString("en-MY")}.`} />}
    {highest && status === "active" && <Notice icon={<Trophy size={18} />} text="You are currently the highest bidder." />}
    {outbid && status === "active" && <Notice icon={<Gavel size={18} />} text="You have been outbid. Place at least the minimum next bid to compete again." />}
    {status === "ended" && <Notice icon={<Trophy size={18} />} text={!hasWinner ? "This auction ended without any bids." : listing.winnerId === userId ? `You won at ${formatSen(listing.finalBid ?? listing.currentBid ?? 0)}.` : owner ? `The auction ended with a final bid of ${formatSen(listing.finalBid ?? listing.currentBid ?? 0)}.` : "This auction has ended with a winning bidder."} />}
    {status === "cancelled" && <Notice icon={<ShieldCheck size={18} />} text="The seller cancelled this auction before a valid winning result was recorded." />}

    {owner && (status === "scheduled" || status === "active") && (listing.bidCount ?? 0) === 0 && <div>{confirmCancel ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">Cancel this auction?</p><p className="mt-1 text-xs text-red-700">It will remain visible as cancelled history and cannot be restarted.</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void cancel()} className="button-secondary h-10 border-red-200 px-4 text-red-700">Confirm cancellation</button><button disabled={busy} onClick={() => setConfirmCancel(false)} className="button-secondary h-10 px-4">Keep auction</button></div></div> : <button onClick={() => setConfirmCancel(true)} className="text-sm font-semibold text-red-700">Cancel auction</button>}</div>}
    {message && <p className="rounded-xl bg-[var(--takeme-light-green)] p-3 text-sm font-semibold text-[var(--takeme-dark-green)]" role="status">{message}</p>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}

    <section className="border-t border-gray-100 pt-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Bid history</h2><span className="text-xs text-[var(--takeme-gray)]">Latest 25</span></div>{historyError ? <p className="text-sm text-red-700">Bid history is temporarily unavailable.</p> : bids.length ? <div className="grid gap-2">{bids.map((bid) => <div key={bid.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm"><span className="font-medium">{bid.bidderId === userId ? "You" : "Bidder"}</span><span className="ml-auto font-bold">{formatSen(bid.amount)}</span><span className="w-16 text-right text-xs text-[var(--takeme-gray)]">{relativeTime(bid.createdAt, now)}</span></div>)}</div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-[var(--takeme-gray)]">No bids yet. The first valid bid can meet the starting bid.</p>}</section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-gray-200 p-3"><p className="text-xs font-medium text-[var(--takeme-gray)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Notice({ icon, text }: { icon: React.ReactNode; text: string }) { return <p className="flex gap-2 rounded-xl bg-gray-50 p-3 text-sm leading-6 text-[var(--takeme-gray)]"><span className="mt-0.5 shrink-0 text-[var(--takeme-dark-green)]">{icon}</span>{text}</p>; }
