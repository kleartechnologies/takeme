"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminRecord, updateAdminReport, type AdminList, type AdminRecord } from "@/lib/services/admin";

const money = (sen: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);
function detailLabel(key: string) { return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("Sen", " (MYR sen)"); }
function detailValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (key.endsWith("Sen") && typeof value === "number") return money(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(" · ") : "None";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
export function AdminRecordView({ section, id }: { section: AdminList; id: string }) {
  const [record, setRecord] = useState<AdminRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("submitted");
  const [resolution, setResolution] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { let active = true; getAdminRecord(section, id).then((value) => { if (active) { setRecord(value); setStatus(String(value.row.status ?? "submitted")); setResolution(String(value.detail.resolution ?? "")); setInternalNotes(String(value.detail.internalNotes ?? "")); setLoading(false); } }).catch((caught) => { if (active) { setError(caught instanceof Error ? caught.message : "Record unavailable."); setLoading(false); } }); return () => { active = false; }; }, [section, id]);
  async function saveReport() { setBusy(true); setNotice(""); try { await updateAdminReport(id, status, resolution, internalNotes); setRecord(await getAdminRecord(section, id)); setNotice("Report triage saved."); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Could not save triage."); } finally { setBusy(false); } }
  if (loading) return <div className="h-80 animate-pulse rounded-2xl bg-white" />;
  if (error || !record) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error || "Record not found."}</div>;
  const { row, detail } = record;
  return <div className="mx-auto max-w-4xl min-w-0"><Link href={`/admin/${section}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">← Back to {section}</Link><p className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--takeme-dark-green)]">Admin record / {section}</p><h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{String(row.displayName ?? row.title ?? row.listingTitle ?? row.id)}</h1><p className="mt-2 break-all text-xs text-[var(--takeme-gray)]">ID: {row.id}</p>
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-bold">Record overview</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{Object.entries(row).filter(([key]) => key !== "id").map(([key, value]) => <div key={key} className="min-w-0 border-b border-stone-100 pb-3"><dt className="text-xs font-semibold capitalize text-[var(--takeme-gray)]">{detailLabel(key)}</dt><dd className="mt-1 break-words text-sm font-semibold">{detailValue(key, value)}</dd></div>)}</dl></section>
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-bold">Operational detail</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{Object.entries(detail).map(([key, value]) => <div key={key} className="min-w-0 border-b border-stone-100 pb-3"><dt className="text-xs font-semibold capitalize text-[var(--takeme-gray)]">{detailLabel(key)}</dt><dd className="mt-1 break-words text-sm font-semibold">{detailValue(key, value)}</dd></div>)}</dl></section>
    {section === "users" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Completed Transaction Value</strong> is the sum of legitimate completed agreements in each role. It is not an account balance, payout, wallet, or money earned.</p>}
    {section === "transactions" && <p className="mt-4 rounded-xl bg-green-50 p-4 text-xs leading-5 text-green-900"><strong>Read-only settlement visibility.</strong> Only a legitimate completed transaction contributes to gross GMV. Pending, failed, cancelled and disputed protected value is excluded. No payment, refund or payout action is available here, and real payment movement is not enabled.</p>}
    {section === "reports" && <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-bold">Moderation triage</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Internal notes and resolution are visible only to administrators. No content is removed automatically.</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{typeof detail.listingId === "string" && <Link href={`/admin/listings/${detail.listingId}`} className="min-h-11 content-center underline">Inspect listing</Link>}{typeof detail.userId === "string" && <Link href={`/admin/users/${detail.userId}`} className="min-h-11 content-center underline">Inspect user</Link>}</div><label className="mt-3 block text-sm font-semibold">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="input-shell mt-1 min-h-11 w-full px-3"><option value="submitted">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><label className="mt-3 block text-sm font-semibold">Resolution<textarea value={resolution} maxLength={2000} onChange={(event) => setResolution(event.target.value)} className="input-shell mt-1 w-full px-3 py-2" rows={3} /></label><label className="mt-3 block text-sm font-semibold">Internal notes<textarea value={internalNotes} maxLength={4000} onChange={(event) => setInternalNotes(event.target.value)} className="input-shell mt-1 w-full px-3 py-2" rows={4} /></label><button type="button" disabled={busy} onClick={() => void saveReport()} className="button-primary mt-4 min-h-11 px-5">{busy ? "Saving…" : "Save triage"}</button>{notice && <p role="status" className="mt-2 text-sm">{notice}</p>}</section>}
    {section === "listings" && <p className="mt-4 text-xs text-[var(--takeme-gray)]">Views and saves reflect retained accepted events, not guaranteed all-time human traffic.</p>}
  </div>;
}
