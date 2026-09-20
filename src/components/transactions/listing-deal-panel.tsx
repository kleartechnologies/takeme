"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getListingDealState, respondToOffer, submitOffer } from "@/lib/services/transactions";
import { ringgitToSen } from "@/lib/listing-validation";
import { useCurrentTime } from "@/lib/use-current-time";
import type { Listing, MarketplaceOffer, MarketplaceTransaction, PaymentMethod } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const methods: { value: PaymentMethod; label: string }[] = [
  { value: "cod", label: "Cash on delivery / meetup" }, { value: "bank_transfer", label: "Bank transfer" },
  { value: "external", label: "External payment" }, { value: "other", label: "Other agreed method" },
];

export function ListingDealPanel({ listing, userId }: { listing: Listing; userId?: string }) {
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
      await submitOffer(listing.id, type, paymentMethod, sen ?? undefined);
      await refresh();
      setNotice("Request sent. No payment was taken and no transaction is complete.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send your request."); }
    finally { setBusy(false); }
  }
  async function respond(offerId: string, action: "accept" | "reject" | "counter" | "withdraw") {
    const sen = action === "counter" ? ringgitToSen(counter) : undefined;
    if (action === "counter" && !sen) { setError("Enter a valid counter amount."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await respondToOffer(offerId, action, sen ?? undefined);
      await refresh();
      setNotice(action === "accept" ? "Deal agreed. Both parties must later confirm the exchange to complete it." : `Offer ${action === "counter" ? "countered" : action === "reject" ? "rejected" : "withdrawn"}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update this offer."); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl border border-gray-200 bg-stone-50 p-4" aria-label="Deal requests">
    <h2 className="text-base font-bold">{seller ? "Buyer requests" : "Agree a deal"}</h2>
    <p className="mt-1 text-xs leading-5 text-[var(--takeme-gray)]">TAKEME does not process this payment. An accepted request is an agreed deal, not a completed transaction.</p>
    {!userId && <Link href={`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`} className="button-primary mt-4 min-h-11 px-4">Log in to request</Link>}
    {loading && <p className="mt-3 text-sm text-[var(--takeme-gray)]">Loading requests…</p>}
    {transaction && <Link href={`/transactions/${transaction.id}`} className="button-primary mt-4 min-h-11 w-full px-4">View {transaction.status === "completed" ? "completed transaction" : "transaction status"}</Link>}
    {userId && !loading && !seller && !transaction && listing.status === "active" && !offers.some((offer) => ["submitted", "countered"].includes(offer.status) && (!now || new Date(offer.expiresAt).getTime() > now)) && <div className="mt-4 space-y-3">
      <label className="form-field"><span>Agreed payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void send("buy_now")} className="button-primary min-h-12 w-full px-4">Request at {money.format(listing.price)}</button>
      <div className="flex gap-2"><label className="form-field min-w-0 flex-1"><span>Or make an offer (RM)</span><input type="number" inputMode="decimal" min="0.01" max={listing.price} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" /></label><button type="button" disabled={busy || !amount} onClick={() => void send("offer")} className="button-secondary min-h-12 self-end px-4">Send offer</button></div>
    </div>}
    {userId && !loading && seller && !offers.length && !transaction && <p className="mt-3 text-sm text-[var(--takeme-gray)]">No requests yet.</p>}
    <div className="mt-3 space-y-3">{offers.map((offer) => {
      const expired = now > 0 && new Date(offer.expiresAt).getTime() <= now;
      const open = !expired && ["submitted", "countered"].includes(offer.status);
      return <div key={offer.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm"><p className="font-semibold">{offer.type === "buy_now" ? "Fixed-price request" : "Offer"} · {money.format(offer.quotedAmountSen / 100)}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">{expired && open ? "Expired" : offer.status.replaceAll("_", " ")} · {methods.find((item) => item.value === offer.paymentMethod)?.label ?? "Agreed outside TAKEME"}</p>
        {open && seller && offer.status === "submitted" && <div className="mt-3 grid gap-2"><div className="flex gap-2"><button disabled={busy} onClick={() => void respond(offer.id, "accept")} className="button-primary min-h-11 flex-1 px-3">Accept deal</button><button disabled={busy} onClick={() => void respond(offer.id, "reject")} className="button-secondary min-h-11 flex-1 px-3">Reject</button></div>{offer.type === "offer" && <div className="flex gap-2"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={counter} onChange={(event) => setCounter(event.target.value)} aria-label="Counter amount in ringgit" className="input-shell min-h-11 min-w-0 flex-1 px-3" placeholder="Counter RM" /><button disabled={busy || !counter} onClick={() => void respond(offer.id, "counter")} className="button-secondary min-h-11 px-3">Counter</button></div>}</div>}
        {open && !seller && <div className="mt-3 flex gap-2">{offer.status === "countered" && <button disabled={busy} onClick={() => void respond(offer.id, "accept")} className="button-primary min-h-11 flex-1 px-3">Accept counter</button>}<button disabled={busy} onClick={() => void respond(offer.id, "withdraw")} className="button-secondary min-h-11 flex-1 px-3">Withdraw</button></div>}
      </div>;
    })}</div>
    {notice && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
