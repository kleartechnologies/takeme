"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import { submitReport } from "@/lib/services/trust";
import type { ReportReason, ReportTargetType } from "@/types/marketplace";

const reasons: Record<ReportTargetType, [ReportReason, string][]> = {
  listing: [["prohibited_item", "Prohibited item"], ["counterfeit", "Counterfeit or suspicious"], ["misleading", "Misleading listing"], ["wrong_category", "Wrong category"], ["spam", "Spam"], ["other", "Other"]],
  user: [["suspicious_behavior", "Suspicious behavior"], ["harassment", "Harassment"], ["fraud_concern", "Fraud concern"], ["other", "Other"]],
  conversation: [["harassment", "Harassment"], ["fraud_concern", "Fraud concern"], ["spam", "Spam"], ["other", "Other"]],
  message: [["harassment", "Harassment"], ["fraud_concern", "Fraud concern"], ["spam", "Spam"], ["other", "Other"]],
};
export function ReportAction({ targetType, targetId, conversationId, label = "Report" }: { targetType: ReportTargetType; targetId: string; conversationId?: string; label?: string }) {
  const { user } = useAuth();
  const requireAction = useProtectedMarketplaceAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(reasons[targetType][0][0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    try { if (!await requireAction()) return; await submitReport({ targetType, targetId, reason, details, conversationId }); setMessage("Report submitted for review."); setOpen(false); setDetails(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Report could not be submitted."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2"><button type="button" className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--takeme-gray)] action-link" onClick={() => setOpen((value) => !value)}>{label}</button>
    {open && <div className="mt-2 rounded-xl border border-gray-200 bg-stone-50 p-3">{!user ? <p className="text-sm">Please <Link className="underline" href="/login" onClick={event => { event.preventDefault(); void requireAction().catch(() => undefined); }}>log in</Link> to report this.</p> : <><label className="block text-xs font-semibold">Reason<select className="input-shell mt-1 min-h-11 w-full px-3" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>{reasons[targetType].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="mt-3 block text-xs font-semibold">Details (optional)<textarea className="input-shell mt-1 w-full px-3 py-2" rows={2} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} /></label><button type="button" disabled={busy} onClick={() => void submit()} className="button-secondary mt-3 min-h-11 px-4">{busy ? "Submitting…" : "Submit report"}</button></>}</div>}
    {message && <p role="status" className="mt-1 text-xs text-[var(--takeme-gray)]">{message}</p>}</div>;
}
