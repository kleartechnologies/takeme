"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getListingDealState, respondToOffer, submitOffer } from "@/lib/services/transactions";
import { ringgitToSen } from "@/lib/listing-validation";
import { useCurrentTime } from "@/lib/use-current-time";
import { ListingContextCard } from "@/components/listings/listing-context-card";
import { OfferRequestForm } from "./offer-request-form";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import type { Listing, MarketplaceOffer, MarketplaceTransaction, PaymentMethod } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const methods: { value: PaymentMethod; label: string }[] = [
  { value: "cod", label: "Cash on delivery / meetup" }, { value: "bank_transfer", label: "Bank transfer" },
  { value: "external", label: "External payment" }, { value: "other", label: "Other agreed method" },
];

export function ListingDealPanel({ listing, userId, hideMakeOffer = false }: { listing: Listing; userId?: string; hideMakeOffer?: boolean }) {
  const requireAction = useProtectedMarketplaceAction();
  const now = useCurrentTime(30_000);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [transaction, setTransaction] = useState<MarketplaceTransaction | null>(null);
  const [amount, setAmount] = useState("");
  const [counter, setCounter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const seller = userId === listing.sellerId;

  async function refresh() {
    const result = await getListingDealState(listing.id);
    setOffers(result.offers); setTransaction(result.transaction);
  }
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getListingDealState(listing.id).then((result) => { if (active) { setOffers(result.offers); setTransaction(result.transaction); setLoading(false); } })
      .catch(() => { if (active) { setError("Deal requests could not be loaded right now."); setLoading(false); } });
    return () => { active = false; };
  }, [listing.id, userId]);

  async function send(type: "buy_now" | "offer") {
    const sen = type === "offer" ? ringgitToSen(amount) : undefined;
    if (type === "offer" && (!sen || sen > Math.round(listing.price * 100))) { setError("Enter an offer between RM0.01 and the listed price."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (!await requireAction(`/listings/${listing.id}?offer=1`)) return;
      await submitOffer(listing.id, type, paymentMethod, sen ?? undefined);
      await refresh();
      setNotice("Request sent. No payment was taken and no transaction is complete.");
      setOfferOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send your request."); }
    finally { setBusy(false); }
  }
  async function respond(offerId: string, action: "accept" | "reject" | "counter" | "withdraw") {
    const sen = action === "counter" ? ringgitToSen(counter) : undefined;
    if (action === "counter" && !sen) { setError("Enter a valid counter amount."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (!await requireAction(`/listings/${listing.id}?offer=1`)) return;
      await respondToOffer(offerId, action, sen ?? undefined);
      await refresh();
      setNotice(action === "accept" ? "Deal agreed. Both parties must later confirm the exchange to complete it." : `Offer ${action === "counter" ? "countered" : action === "reject" ? "rejected" : "withdrawn"}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update this offer."); }
    finally { setBusy(false); }
  }

  async function openOffer() {
    setError("");
    try { if (await requireAction(`/listings/${listing.id}?offer=1`)) setOfferOpen(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Your account status could not be checked."); }
  }

  return <section className="mt-6 rounded-2xl border border-gray-200 bg-stone-50 p-4" aria-label="Deal requests">
    <h2 className="text-base font-bold">{seller ? "Buyer requests" : "Agree a deal"}</h2>
    <p className="mt-1 text-xs leading-5 text-[var(--takeme-gray)]">TAKEME does not process this payment. An accepted request is an agreed deal, not a completed transaction.</p>
    {!userId && <Link href={`/login?next=${encodeURIComponent(`/listings/${listing.id}?offer=1`)}&intent=offer`} className="button-primary mt-4 min-h-11 px-4">Log in to request</Link>}
    {loading && <p className="mt-3 text-sm text-[var(--takeme-gray)]">Loading requests…</p>}
    {transaction && <Link href={`/transactions/${transaction.id}`} className="button-primary mt-4 min-h-11 w-full px-4">View {transaction.status === "completed" ? "completed transaction" : "transaction status"}</Link>}
    {userId && !loading && !seller && !transaction && listing.status === "active" && !offers.some((offer) => ["submitted", "countered"].includes(offer.status) && (!now || new Date(offer.expiresAt).getTime() > now)) && <div className="mt-4 space-y-3">
      <fieldset><legend className="text-xs font-semibold text-stone-700">Transaction option</legend><div className="mt-2 grid gap-2">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--takeme-green)] bg-white p-3 text-sm"><input type="radio" checked readOnly name={`settlement-${listing.id}`} className="accent-[var(--takeme-dark-green)]" /><span><strong className="block">Standard transaction</strong><span className="text-xs text-[var(--takeme-gray)]">Confirm the exchange with the seller. TAKEME does not process payment.</span></span></label>
      </div></fieldset>
      <label className="form-field"><span>Agreed payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void send("buy_now")} className="button-primary min-h-12 w-full px-4">Request at {money.format(listing.price)}</button>
      {!hideMakeOffer && <button type="button" disabled={busy} onClick={() => void openOffer()} className="button-secondary min-h-12 w-full px-4">Make an offer</button>}
    </div>}
    {userId && !loading && seller && !offers.length && !transaction && <p className="mt-3 text-sm text-[var(--takeme-gray)]">No requests yet.</p>}
    <div className="mt-3 space-y-3">{offers.map((offer) => {
      const expired = now > 0 && new Date(offer.expiresAt).getTime() <= now;
      const open = !expired && ["submitted", "countered"].includes(offer.status);
      return <div key={offer.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm"><p className="font-semibold text-[var(--takeme-dark-green)]">{offer.type === "buy_now" ? "Fixed-price request" : "Offer"} · {money.format(offer.quotedAmountSen / 100)}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">{expired && ["submitted", "countered"].includes(offer.status) ? "Expired" : offer.status.replaceAll("_", " ")} · {methods.find((item) => item.value === offer.paymentMethod)?.label ?? "Agreed outside TAKEME"}</p>
        {open && seller && offer.status === "submitted" && <div className="mt-3 grid gap-2"><div className="flex gap-2"><button disabled={busy} onClick={() => void respond(offer.id, "accept")} className="button-primary min-h-11 flex-1 px-3">Accept deal</button><button disabled={busy} onClick={() => void respond(offer.id, "reject")} className="button-secondary min-h-11 flex-1 px-3">Reject</button></div>{offer.type === "offer" && <div className="flex gap-2"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={counter} onChange={(event) => setCounter(event.target.value)} aria-label="Counter amount in ringgit" className="input-shell min-h-11 min-w-0 flex-1 px-3" placeholder="Counter RM" /><button disabled={busy || !counter} onClick={() => void respond(offer.id, "counter")} className="button-secondary min-h-11 px-3">Counter</button></div>}</div>}
        {open && !seller && <div className="mt-3 flex gap-2">{offer.status === "countered" && <button disabled={busy} onClick={() => void respond(offer.id, "accept")} className="button-primary min-h-11 flex-1 px-3">Accept counter</button>}<button disabled={busy} onClick={() => void respond(offer.id, "withdraw")} className="button-secondary min-h-11 flex-1 px-3">Withdraw</button></div>}
      </div>;
    })}</div>
    {notice && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {offerOpen && userId && !seller && listing.status === "active" && <ActionSheet title="Make an offer" description={listing.title} busy={busy} onClose={() => setOfferOpen(false)}><ListingContextCard title={listing.title} image={listing.imageUrls[0]} detail={listing.condition} price={money.format(listing.price)} /><OfferRequestForm amount={amount} setAmount={setAmount} maximum={listing.price} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} busy={busy} error={error} onSubmit={() => void send("offer")} /></ActionSheet>}
  </section>;
}
