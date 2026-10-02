"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ActionSheet } from "@/components/ui/action-sheet";
import { ringgitToSen } from "@/lib/listing-validation";
import { offerIsOpen, offerLabels } from "@/lib/messaging-presentation";
import { submitOffer, respondToOffer } from "@/lib/services/transactions";
import type { PublicListing } from "@/lib/services/listings";
import type { ConversationSummary } from "@/lib/services/conversations";
import type { MarketplaceOffer, MarketplaceTransaction, PaymentMethod } from "@/types/marketplace";
import { MarketplaceEventCard } from "./marketplace-event-card";
import { ProductContextCard, money } from "./product-context-card";
import styles from "./messaging.module.css";
import { OfferRequestForm, offerPaymentMethods } from "@/components/transactions/offer-request-form";

const methods = offerPaymentMethods;
export function ConversationDeals({ conversation, listing, offers, transaction, reviewed, userId, now, refresh, placement, makeOffer = false }: { conversation: ConversationSummary; listing: PublicListing | null; offers: MarketplaceOffer[]; transaction: MarketplaceTransaction | null; reviewed: boolean | null; userId: string; now: number; refresh: () => Promise<void>; placement: "events" | "actions"; makeOffer?: boolean }) {
  const [sheet, setSheet] = useState<"make" | "view" | "counter" | null>(() => makeOffer && placement === "actions" && userId !== conversation.sellerId && listing?.listingType === "buy_now" && listing.status === "active" && !transaction && !offers.some(offer => offerIsOpen(offer, now)) ? "make" : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const seller = userId === conversation.sellerId;
  const available = listing?.listingType === "buy_now" && listing.status === "active" && !transaction;
  const openOffer = offers.some((offer) => offerIsOpen(offer, now));
  function viewOffer(offer: MarketplaceOffer) { setSelectedId(offer.id); setError(""); setSheet("view"); }
  async function act(action: "send" | "accept" | "reject" | "counter" | "withdraw") {
    if (inFlight.current || (action !== "send" && !selected)) return;
    const sen = ["send", "counter"].includes(action) ? ringgitToSen(amount) : null;
    if (["send", "counter"].includes(action) && (!listing || !sen || sen > Math.round(listing.price * 100))) { setError("Enter an amount between RM0.01 and the listed price."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (action === "send") await submitOffer(conversation.listingId, "offer", method, sen!);
      else await respondToOffer(selected!.id, action, sen ?? undefined);
      await refresh(); setSheet(null); setAmount("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This request could not be completed."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const title = sheet === "make" ? "Make an Offer" : sheet === "counter" ? "Counter Offer" : selected?.status === "countered" ? "Seller Counter Offer" : seller ? "Offer Received" : "Your Offer";
  return <>
    {placement === "actions" && available && !seller && !openOffer && <button type="button" className="button-secondary min-h-11 w-full" onClick={() => { setSheet("make"); setError(""); }}>Make Offer</button>}
    {placement === "events" && <>
      {offers.filter((offer) => !(transaction && offer.status === "accepted" && offer.transactionId === transaction.id)).map((offer) => {
        const open = offerIsOpen(offer, now);
        const expired = ["submitted", "countered"].includes(offer.status) && !open;
        const label = expired ? "Offer expired" : seller && offer.status === "submitted" ? "Offer received" : offerLabels[offer.status];
        return <MarketplaceEventCard key={offer.id} title={label} amount={money(offer.quotedAmountSen / 100)} description={offer.status === "accepted" ? "Price agreed. This does not confirm payment or completion." : open ? offer.status === "countered" ? "Waiting for the buyer to respond." : seller ? "Waiting for your response." : "Waiting for the seller to respond." : "This request is no longer open."}><button type="button" className="button-secondary min-h-11 w-full mt-3" onClick={() => viewOffer(offer)}>View Offer</button></MarketplaceEventCard>;
      })}
      {transaction && <MarketplaceEventCard title={transaction.status === "completed" ? "Deal completed" : transaction.status === "in_progress" ? transaction.type === "auction" ? seller ? "Auction deal agreed" : "Auction won · Deal agreed" : "Deal agreed" : `Deal ${transaction.status}`} amount={money(transaction.amountSen / 100)} description={transaction.status === "completed" ? transaction.settlementMode === "standard" ? "Both parties confirmed the exchange. TAKEME did not process the standard payment." : "Both parties confirmed the exchange. View the deal for settlement details." : transaction.status === "in_progress" ? transaction.settlementMode === "standard" ? "Arrange the exchange together. Both parties must confirm to complete this deal. No payment was taken by TAKEME." : "Both parties must confirm the exchange. View the deal for settlement details." : "View the transaction for its current status."} href={`/transactions/${transaction.id}`} label={transaction.status === "completed" && reviewed === false && now > 0 && Date.parse(transaction.reviewWindowEndAt ?? "") > now ? "Leave Review" : "View Deal"}>{offers.find((offer) => offer.status === "accepted" && offer.transactionId === transaction.id) && <button type="button" className="button-secondary min-h-11 w-full mt-3" onClick={() => viewOffer(offers.find((offer) => offer.transactionId === transaction.id)!)}>View accepted offer</button>}</MarketplaceEventCard>}
    </>}
    {sheet && <ActionSheet key={sheet} title={title} description="A price agreement, not a payment or completed sale." busy={busy} onClose={() => setSheet(null)} fallbackFocus={() => document.getElementById("message-body")}>
      <ProductContextCard listing={listing} listingId={conversation.listingId} title={conversation.listingTitle} image={conversation.listingImage} link={false} />
      {(sheet === "make" || sheet === "counter") ? <>{sheet === "counter" && selected && <p className="mt-4 text-xs text-[var(--takeme-gray)]">Buyer offered {money(selected.proposedAmountSen / 100)}</p>}<OfferRequestForm amount={amount} setAmount={setAmount} maximum={listing?.price} paymentMethod={method} setPaymentMethod={setMethod} busy={busy} error={error} counter={sheet === "counter"} disabled={!available} onSubmit={() => void act(sheet === "make" ? "send" : "counter")} /></> : selected && <>
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-semibold">{seller ? "Buyer's offer" : selected.status === "countered" ? "Seller's counter" : "Your offer"}</p><p className="text-3xl font-semibold text-[var(--takeme-dark-green)] mt-2">{money(selected.quotedAmountSen / 100)}</p><p className="text-xs text-[var(--takeme-gray)] mt-2">{offerIsOpen(selected, now) ? seller && selected.status === "submitted" ? "Offer received" : offerLabels[selected.status] : ["submitted", "countered"].includes(selected.status) ? "Offer expired" : offerLabels[selected.status]}</p></div>
        <p className="mt-4 text-xs text-[var(--takeme-gray)]">{methods.find((item) => item.value === selected.paymentMethod)?.label ?? "Agreed outside TAKEME"}</p>
        <div className={styles.sheetActions}>{available && offerIsOpen(selected, now) && <>
          {seller && selected.status === "submitted" && <><button disabled={busy} className="button-primary min-h-12" onClick={() => void act("accept")}>{busy ? "Updating…" : "Accept Offer"}</button>{selected.type === "offer" && <button disabled={busy} className="button-secondary min-h-12" onClick={() => { setAmount(String(selected.quotedAmountSen / 100)); setSheet("counter"); }}>Counter Offer</button>}<button disabled={busy} className={styles.decline} onClick={() => void act("reject")}>Decline</button></>}
          {!seller && <>{selected.status === "countered" && <button disabled={busy} className="button-primary min-h-12" onClick={() => void act("accept")}>{busy ? "Updating…" : "Accept Counter Offer"}</button>}<button disabled={busy} className={styles.decline} onClick={() => void act("withdraw")}>Withdraw Offer</button></>}
        </>}{selected.transactionId && <Link className="button-primary min-h-12" href={`/transactions/${selected.transactionId}`}>View Deal</Link>}</div>
        {error && <p role="alert" className={`${styles.error} mt-3`}>{error}</p>}
      </>}
    </ActionSheet>}
  </>;
}
