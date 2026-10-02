"use client";
import type { PaymentMethod } from "@/types/marketplace";
import styles from "@/components/messages/messaging.module.css";

export const offerPaymentMethods = [{ value: "cod", label: "Cash on delivery / meetup" }, { value: "bank_transfer", label: "Bank transfer" }, { value: "external", label: "External payment" }, { value: "other", label: "Other agreed method" }];
/** Shared presentation for the existing listing and conversation offer contracts. */
export function OfferRequestForm({ amount, setAmount, maximum, paymentMethod, setPaymentMethod, busy, error, counter = false, disabled = false, onSubmit }: { amount: string; setAmount: (value: string) => void; maximum?: number; paymentMethod: PaymentMethod; setPaymentMethod: (value: PaymentMethod) => void; busy: boolean; error: string; counter?: boolean; disabled?: boolean; onSubmit: () => void }) {
  return <form className="grid gap-4 mt-5" onSubmit={(event) => { event.preventDefault(); if (!busy && !disabled) onSubmit(); }}>
    <label><span className="block text-sm font-semibold mb-2">{counter ? "Your counter" : "Your Offer"}</span><span className={styles.sheetAmount}><span>RM</span><input aria-label={counter ? "Counter amount in ringgit" : "Offer amount in ringgit"} required type="number" inputMode="decimal" min="0.01" max={maximum} step="0.01" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></span></label>
    {!counter && <label className="form-field"><span>Proposed payment method</span><select disabled={busy} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{offerPaymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
    <p className="text-xs leading-6 text-[var(--takeme-gray)]">{counter ? "This sends a counter offer to the buyer." : "This sends a request to the seller."} TAKEME does not process this payment. An accepted offer is not a completed transaction.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="submit" disabled={busy || !amount || disabled} className="button-primary min-h-12 w-full">{busy ? "Sending…" : counter ? "Send Counter Offer" : "Send Offer"}</button>
  </form>;
}
