"use client";

import { AlertCircle, Clock3, Flame, Gavel, LoaderCircle, MessageCircle, Minus, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getMinimumNextBid, MAX_MONEY_SEN, ringgitToSen, senToRinggit } from "@/lib/listing-validation";
import { auctionBidLabel, auctionClock, effectiveStatus, ENDING_SOON_MS, quickBidAmounts } from "@/lib/auction-presentation";
import { cancelAuctionListing, getAuctionViewerState, placeAuctionBid, type AuctionViewerState } from "@/lib/services/auctions";
import { openListingConversation } from "@/lib/services/conversations";
import type { PublicAuctionBid } from "@/lib/services/listings";
import { useCurrentTime } from "@/lib/use-current-time";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import type { Listing } from "@/types/marketplace";
import productStyles from "./standard-product.module.css";
import styles from "./auction.module.css";

export { effectiveStatus } from "@/lib/auction-presentation";
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatSen = (value: number) => money.format(value / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "Time unavailable";

export function AuctionStatusBadge({ listing }: { listing: Listing }) {
  const status = effectiveStatus(listing, useCurrentTime());
  const text = listing.status === "draft" ? "Draft auction" : listing.status === "removed" ? "Auction unavailable" : status === "active" ? "Live auction" : status === "scheduled" ? "Auction starts soon" : status === "cancelled" ? "Auction cancelled" : "Auction ended";
  return <span className={styles.badge} data-live={status === "active" && listing.status === "active" || undefined}><Flame size={14} aria-hidden="true" />{text}</span>;
}

function AuctionCountdown({ listing, now }: { listing: Listing; now: number }) {
  const status = effectiveStatus(listing, now);
  const clock = auctionClock(status === "scheduled" ? listing.auctionStartAt : listing.auctionEndAt, now);
  if (status === "ended" || status === "cancelled") return null;
  return <div className={styles.countdown} aria-label={`${status === "scheduled" ? "Starts" : "Ends"} in ${clock ? `${clock.days} days, ${clock.hours} hours, ${clock.minutes} minutes, ${clock.seconds} seconds` : "loading"}`}>
    <span>{status === "scheduled" ? "Starts in" : "Ends in"}</span><strong aria-hidden="true">{clock ? `${clock.days ? `${clock.days}d ` : ""}${[clock.hours, clock.minutes, clock.seconds].map(n => String(n).padStart(2, "0")).join(":")}` : "—"}</strong><small aria-hidden="true">HR　 MIN　 SEC</small>
  </div>;
}

export function AuctionPanel({ listing, userId, owner, onChange, previewMode = false }: { listing: Listing; userId?: string; owner: boolean; onChange: () => void; previewMode?: boolean }) {
  const now = useCurrentTime();
  const router = useRouter();
  const requireAction = useProtectedMarketplaceAction();
  const version = `${listing.id}:${listing.bidCount}:${listing.currentBid}:${listing.auctionStatus}:${listing.status}:${listing.auctionEndAt}`;
  const [response, setResponse] = useState<{ uid: string; version: string; state: AuctionViewerState } | null>(null);
  const viewer = response && response.uid === userId && response.version === version ? response.state : null;
  const [viewerError, setViewerError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const actionFallback = useRef<HTMLAnchorElement>(null);
  const cancelledFocus = useRef(false);
  const [sheet, setSheet] = useState<"bid" | "cancel" | null>(null);
  const status = effectiveStatus(listing, now);
  const minimum = getMinimumNextBid(listing);
  const increment = listing.minimumBidIncrement ?? 0;
  const clock = auctionClock(listing.auctionEndAt, now);
  const endingSoon = status === "active" && Boolean(clock && clock.remaining > 0 && clock.remaining <= ENDING_SOON_MS);
  const amountSen = ringgitToSen(amount);
  const inputError = !amountSen ? "Enter a positive MYR amount with up to 2 decimal places." : amountSen < minimum ? `Minimum next bid is ${formatSen(minimum)}.` : "";
  const quick = quickBidAmounts(minimum, increment, MAX_MONEY_SEN);
  const canBid = listing.status === "active" && status === "active" && now > 0 && Boolean(clock && clock.remaining > 0) && !owner && minimum > 0 && minimum <= MAX_MONEY_SEN;
  const finalized = listing.auctionStatus === "ended" && listing.status === "ended";
  const highest = canBid && viewer?.isHighestBidder;
  const outbid = canBid && viewer?.isOutbid;
  const bidValue = (listing.bidCount ?? 0) > 0 ? listing.currentBid ?? 0 : listing.startingBid ?? 0;
  const bidLabel = auctionBidLabel(listing, now);
  const editable = owner && (listing.bidCount ?? 0) === 0 && (listing.status === "draft" || status === "scheduled" && listing.auctionStatus === "scheduled");
  const cancellable = owner && (listing.bidCount ?? 0) === 0 && (listing.status === "draft" && !["ended", "cancelled"].includes(listing.auctionStatus ?? "") || listing.status === "active" && ["scheduled", "active"].includes(status));

  useEffect(() => {
    if (cancelledFocus.current && !cancellable) { cancelledFocus.current = false; actionFallback.current?.focus(); }
  }, [cancellable]);

  // The listing's existing ten-second refresh drives private viewer comparisons too.
  // Scope responses to their public snapshot so a newly outbid viewer cannot show stale winning UI.
  useEffect(() => {
    if (previewMode || !userId || !["active", "ended", "sold"].includes(listing.status)) return;
    let active = true;
    getAuctionViewerState(listing.id).then(state => { if (active) { setResponse({ uid: userId, version, state }); setViewerError(false); } }).catch(() => { if (active) { setResponse(null); setViewerError(true); } });
    return () => { active = false; };
  }, [listing, userId, version, retry, previewMode]);

  async function openBid() {
    if (!canBid || pending.current) return;
    setBusy(true); setError("");
    try { if (!await requireAction(`/listings/${listing.id}?bid=1#bid-history`)) return; setAmount(senToRinggit(minimum)); setSheet("bid"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Your account status could not be checked."); }
    finally { setBusy(false); }
  }
  async function submitBid(event: React.FormEvent) {
    event.preventDefault();
    if (!canBid || !userId || !amountSen || inputError || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      // Eligibility can change while the confirmation sheet is open. Return to
      // the auction context, never store or replay this potentially stale bid.
      if (!await requireAction(`/listings/${listing.id}?bid=1#bid-history`)) return;
      const result = await placeAuctionBid(listing.id, amountSen);
      setMessage(`Bid accepted at ${formatSen(result.currentBid)}. Your current position is checked against the latest auction data.`);
      setSheet(null); onChange();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your bid could not be placed."); onChange(); }
    finally { pending.current = false; setBusy(false); }
  }
  async function cancel() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await cancelAuctionListing(listing.id); setSheet(null);
      // Cancelled drafts become private removed history, outside the public detail contract.
      if (listing.status === "draft") { router.push("/profile/listings?tab=past"); return; }
      cancelledFocus.current = true; setMessage("Auction cancelled."); onChange();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The auction could not be cancelled."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function chat() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { if (!await requireAction(`/listings/${listing.id}?chat=1`)) return; router.push(`/messages/${await openListingConversation(listing.id)}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open Chat."); }
    finally { pending.current = false; setBusy(false); }
  }
  if (previewMode) return <div className={styles.panel} aria-label="Auction preview"><div className={styles.summary}><div><span>Starting bid</span><strong className={styles.price}>{formatSen(listing.startingBid ?? 0)}</strong><p className={styles.helper}>Minimum increment {formatSen(increment)}</p></div><AuctionCountdown listing={listing} now={now} /></div><p className={styles.timing}>Starts {date(listing.auctionStartAt)}<br />Ends {date(listing.auctionEndAt)}</p><p className={styles.helper}>Bids open only after this auction is published and its start time is reached.</p></div>;
  const primary = highest ? "Raise your bid" : outbid ? `Bid ${formatSen(minimum)}` : userId ? "Place Bid" : "Log in to bid";
  const action = <button type="button" disabled={busy} className="button-primary" onClick={() => void openBid()}><Gavel size={17} aria-hidden="true" />{primary}</button>;
  return <div className={styles.panel} data-ending-soon={endingSoon || undefined}>
    {highest && <div className={`${styles.statusCard} ${styles.winning}`} role="status"><Trophy size={25} aria-hidden="true" /><div><strong>You’re the highest bidder!</strong><p className={endingSoon ? styles.urgentText : undefined}>{endingSoon ? "Final moments! Auction ends soon." : "Keep an eye on the auction."}</p></div></div>}
    {outbid && <div className={`${styles.statusCard} ${styles.outbid}`} role="status"><AlertCircle size={23} aria-hidden="true" /><div><strong>You’ve been outbid!</strong><p>Someone placed a higher bid.</p></div></div>}
    {endingSoon && !highest && <p className={styles.urgency}><Flame size={16} aria-hidden="true" /><strong>Final moments!</strong> Auction ends soon.</p>}
    {listing.status === "draft" ? <div className={styles.ended}><h2>Private auction draft</h2><p>Review the timing and images before publishing. This draft is not open for bidding.</p><div className={styles.finalBid}><span>Starting bid</span><strong>{formatSen(listing.startingBid ?? 0)}</strong></div></div> : listing.status === "removed" ? <div className={styles.ended}><h2>Auction unavailable</h2><p>This listing is removed and is visible only to its owner.</p></div> : finalized ? <div className={styles.ended}>
      <div className={styles.resultIcon}>{viewer?.isWinner ? <Trophy size={34} aria-hidden="true" /> : <Clock3 size={30} aria-hidden="true" />}</div>
      <h2>{viewer?.isWinner ? <>You <em>won!</em></> : "Auction ended"}</h2>
      <p>{viewer?.isWinner ? "You’re the winning bidder. Arrange the exchange with the seller through your deal." : (listing.bidCount ?? 0) === 0 ? "No bids were placed." : viewer?.isOutbid ? "You weren’t the highest bidder this time." : "Bidding has closed."}</p>
      {(listing.bidCount ?? 0) > 0 && listing.finalBid != null && <div className={styles.finalBid}><span>Final bid</span><strong>{formatSen(listing.finalBid)}</strong><small>An auction result does not confirm payment or a completed sale.</small></div>}
      <p className={styles.timestamp}><Clock3 size={14} aria-hidden="true" />Ended {date(listing.endedAt)}</p>
      {viewer?.transactionId && <Link className="button-primary min-h-12 w-full" href={`/transactions/${viewer.transactionId}`}>View Deal</Link>}
      {viewer?.isWinner && !viewer.transactionId && <p role="status">Your deal is being prepared. It will appear after the server confirms it.</p>}
    </div> : status === "cancelled" ? <div className={styles.ended}><h2>Auction cancelled</h2><p>The seller cancelled this auction. Bidding is closed.</p></div> : status === "ended" ? <div className={styles.ended}><h2>Bidding closed</h2><p role="status">Waiting for the server to confirm the auction result.</p></div> : <>
      <div className={styles.summary}>
        <div><span>{bidLabel}</span><strong className={styles.price}>{formatSen(bidValue)}</strong><a href="#bid-history">{listing.bidCount ?? 0} {(listing.bidCount ?? 0) === 1 ? "bid" : "bids"} · View history</a></div>
        <AuctionCountdown listing={listing} now={now} />
      </div>
      {highest && <p className={styles.winningPill}>You’re winning · {formatSen(bidValue)}</p>}
      {canBid && <div className={styles.primaryAction}>{action}<p>Minimum next bid <strong>{formatSen(minimum)}</strong></p></div>}
      {status === "scheduled" && <p className={styles.timing}><Clock3 size={16} aria-hidden="true" />Bidding opens {date(listing.auctionStartAt)}.</p>}
      {owner && <p className={styles.timing}>You cannot bid on your own auction.{(listing.bidCount ?? 0) > 0 ? " Bidding has started, so editing and cancellation are locked." : " You can cancel while there are no bids."}</p>}
    </>}
    {userId && viewerError && <p className={styles.feedback} role="alert">Your personal auction status could not be loaded. <button type="button" onClick={() => setRetry(n => n + 1)}>Retry status</button></p>}
    {message && <p className={styles.feedback} role="status">{message}</p>}
    {error && sheet !== "bid" && <p className={styles.error} role="alert">{error}</p>}
    <div className={`${productStyles.actionBar} ${styles.actions}`} aria-label="Auction actions"><div className={productStyles.actionButtons}>
      {owner ? <>{editable && <Link href={`/listings/${listing.id}/edit`} className="button-secondary">{listing.status === "draft" ? "Resume draft" : "Edit auction"}</Link>}<Link ref={actionFallback} href="/profile/listings" className="button-primary">My listings</Link></> : canBid ? <><button type="button" disabled={busy} onClick={() => void chat()} className="button-secondary"><MessageCircle size={18} aria-hidden="true" />Chat</button><div className={styles.mobileBid}>{action}</div></> : status === "scheduled" && listing.status === "active" ? <><button type="button" disabled={busy} onClick={() => void chat()} className="button-secondary"><MessageCircle size={18} aria-hidden="true" />Chat</button><a href="#item-details" className="button-primary">Auction details</a></> : viewer?.transactionId ? <Link href={`/transactions/${viewer.transactionId}`} className="button-primary">View Deal</Link> : <a ref={actionFallback} href="#similar-items" className="button-secondary">View similar items</a>}
    </div></div>
    {cancellable && <button type="button" className={styles.cancel} disabled={busy} onClick={() => { setError(""); setSheet("cancel"); }}>Cancel auction</button>}
    {owner && listing.status === "active" && ["scheduled", "active"].includes(status) && <Link className={productStyles.textLink} href={`/listings/${listing.id}/promote`}>Promotion options</Link>}
    {sheet === "bid" && <ActionSheet title="Place your bid" description={listing.title} busy={busy} onClose={() => setSheet(null)} fallbackFocus={() => actionFallback.current}>
      <form onSubmit={submitBid} className={styles.bidForm}>
        <div className={styles.sheetMetrics}><div><span>{bidLabel}</span><strong className={styles.currentPrice}>{formatSen(bidValue)}</strong></div><div><span>Minimum next bid</span><strong>{formatSen(minimum)}</strong></div></div>
        <label className={styles.inputLabel} htmlFor="auction-bid-amount">Your bid (RM)</label>
        <div className={styles.stepper}><button type="button" aria-label="Decrease bid by one increment" disabled={busy || !amountSen || amountSen - increment < minimum} onClick={() => setAmount(senToRinggit(Math.max(minimum, (amountSen ?? minimum) - increment)))}><Minus size={19} /></button><input id="auction-bid-amount" disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" type="text" autoComplete="off" aria-invalid={Boolean(inputError)} aria-describedby="bid-amount-feedback" /><button type="button" aria-label="Increase bid by one increment" disabled={busy || !amountSen || amountSen + increment > MAX_MONEY_SEN} onClick={() => setAmount(senToRinggit((amountSen ?? minimum) + increment))}><Plus size={19} /></button></div>
        <p id="bid-amount-feedback" className={inputError ? styles.error : styles.helper}>{inputError || `Minimum increment ${formatSen(increment)}. Amounts may be higher than the minimum.`}</p>
        {quick.length > 0 && <fieldset className={styles.quick}><legend>Quick bid amounts</legend><div>{quick.map(value => <button type="button" key={value} disabled={busy} aria-pressed={amountSen === value} onClick={() => setAmount(senToRinggit(value))}>{formatSen(value)}</button>)}</div></fieldset>}
        {!canBid && <p className={styles.error} role="alert">Bidding is now closed. Your bid has not been submitted.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={busy || Boolean(inputError) || !canBid} className="button-primary min-h-12 w-full">{busy && <LoaderCircle size={17} className="animate-spin" />}Confirm Bid{amountSen ? ` — ${formatSen(amountSen)}` : ""}</button>
        <p className={styles.helper}>Confirming submits your bid for server validation. Bids do not take payment. A winning bid creates a deal to arrange with the seller.</p>
      </form>
    </ActionSheet>}
    {sheet === "cancel" && <ActionSheet title="Cancel this auction?" busy={busy} onClose={() => setSheet(null)}><p className="text-sm leading-6">It will remain visible as cancelled history and cannot be restarted.</p>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.cancelActions}><button type="button" disabled={busy} className="button-secondary min-h-12" onClick={() => setSheet(null)}>Keep auction</button><button type="button" disabled={busy} className="button-primary min-h-12" onClick={() => void cancel()}>Confirm cancellation</button></div></ActionSheet>}
  </div>;
}

export function BidHistory({ listing, bids }: { listing: Listing; bids: PublicAuctionBid[] }) {
  const now = useCurrentTime(60_000);
  const [open, setOpen] = useState(false);
  function rows(all: boolean) {
    return <ol className={styles.historyList}>{(all ? bids : bids.slice(0, 5)).map((bid, index) => <li key={`${bid.createdAt}:${index}`}><span className={styles.avatar} aria-hidden="true">{bid.isOwnBid ? "Y" : <Gavel size={17} />}</span><div><strong>{bid.isOwnBid ? "You" : "Anonymous bidder"}</strong>{index === 0 && bid.amount === listing.currentBid && (listing.bidCount ?? 0) > 0 && listing.auctionStatus === "active" && <span className={styles.leader}>Highest bid</span>}</div><div className={styles.historyAmount}><strong>{formatSen(bid.amount)}</strong><time dateTime={bid.createdAt} title={date(bid.createdAt)}>{relativeTime(bid.createdAt, now)}</time></div></li>)}</ol>;
  }
  return <section id="bid-history" className={`${productStyles.section} ${styles.history}`} aria-label="Bid history"><div className={productStyles.sectionHeading}><h2>Bid history</h2><span>{listing.bidCount ?? 0} {(listing.bidCount ?? 0) === 1 ? "bid" : "bids"}</span></div><p className={styles.helper}>Bidder identities are private. Showing the latest {Math.min(25, listing.bidCount ?? 0)} bids.</p>{bids.length ? rows(false) : <p className={styles.empty}>{["ended", "cancelled"].includes(listing.auctionStatus ?? "") ? "No bids were placed." : "No bids yet. The first bid can meet the starting bid."}</p>}{bids.length > 5 && <button type="button" className={styles.historyButton} onClick={() => setOpen(true)}>View {listing.bidCount === bids.length ? `all ${bids.length}` : `latest ${bids.length}`} bids</button>}{open && <ActionSheet title="Bid history" description={`Latest ${bids.length} bids. Bidder identities remain private.`} onClose={() => setOpen(false)}>{rows(true)}</ActionSheet>}</section>;
}

function relativeTime(value: string, now: number) {
  if (!now || !Number.isFinite(Date.parse(value))) return date(value);
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  if (minutes === 0) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}
