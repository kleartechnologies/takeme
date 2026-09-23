"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAdminMetrics, getAdminPage, type AdminList, type AdminMetrics, type AdminPage, type AdminPreset, type AdminRow, type AdminSection } from "@/lib/services/admin";
import { getCategoryName } from "@/data/categories";

const titles: Record<AdminSection, { title: string; description: string }> = {
  overview: { title: "Marketplace overview", description: "The operational pulse of TAKEME, with current snapshots clearly separated from activity in your selected period." },
  users: { title: "Users & participation", description: "Registration, accepted activity, completed buyer/seller roles and earned tiers." },
  listings: { title: "Listing inventory", description: "Live, sold and removed inventory with official category coverage." },
  transactions: { title: "Transactions", description: "Agreed deals and the completion state machine. Pending value is never GMV." },
  revenue: { title: "Completed marketplace value", description: "GMV is the sum of legitimate completed transaction amounts, not money collected by TAKEME." },
  intelligence: { title: "Marketplace intelligence", description: "Counts of accepted, deduplicated private events. Ranking remains separate." },
  promotions: { title: "Promotions", description: "Unpaid requests and observed engagement; verified purchases and revenue are not yet available." },
  reviews: { title: "Reviews & reputation", description: "Published double-blind reviews and current role-specific tier distributions." },
  reports: { title: "Reports & disputes", description: "Read-only moderation intake and unresolved deal disputes." },
  settings: { title: "Admin settings", description: "Access and analytics policy information. Operational mutations are not enabled." },
};
const presets: { value: AdminPreset; label: string }[] = [
  { value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }, { value: "custom", label: "Custom" },
];
const listSections: AdminList[] = ["users", "listings", "transactions", "promotions", "reviews", "reports"];
const money = (sen: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);
const number = (value: number) => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 1 }).format(value);
function displayValue(value: number | null, unit?: string) { return value === null ? "Not available yet" : unit === "money" ? money(value) : unit === "percent" ? `${number(value)}%` : number(value); }
function label(value: string) { return value.includes("_") ? value.replaceAll("_", " ") : value.includes("-") ? getCategoryName(value) : value; }

export function AdminSectionView({ section }: { section: AdminSection }) {
  const [preset, setPreset] = useState<AdminPreset>("30d");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ preset: "30d" as AdminPreset, from: "", to: "" });
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [page, setPage] = useState<AdminPage | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(""); const [refreshKey, setRefreshKey] = useState(0);
  const hasList = listSections.includes(section as AdminList);
  const refresh = useCallback(() => { setMetrics(null); setPage(null); setCursor(undefined); setError(""); setLoading(true); setRefreshKey((current) => current + 1); }, []);
  useEffect(() => {
    let active = true;
    const metricsRequest = getAdminMetrics(section, applied.preset, applied.from || undefined, applied.to || undefined);
    const pageRequest = hasList ? getAdminPage(section as AdminList, undefined, status || undefined) : Promise.resolve(null);
    Promise.all([metricsRequest, pageRequest]).then(([nextMetrics, nextPage]) => { if (!active) return; setMetrics(nextMetrics); setPage(nextPage); setCursor(nextPage?.nextCursor ?? undefined); setLoading(false); })
      .catch((caught) => { if (!active) return; setError(caught instanceof Error ? caught.message : "Analytics could not be loaded."); setLoading(false); });
    return () => { active = false; };
  }, [section, applied, hasList, status, refreshKey]);
  async function loadMore() {
    if (!cursor || !hasList) return;
    setMoreLoading(true); setError("");
    try { const next = await getAdminPage(section as AdminList, cursor, status || undefined); setPage((current) => ({ rows: [...(current?.rows ?? []), ...next.rows], nextCursor: next.nextCursor })); setCursor(next.nextCursor ?? undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load more records."); }
    finally { setMoreLoading(false); }
  }
  const heading = titles[section];
  return <div className="mx-auto max-w-[1500px] min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--takeme-dark-green)]">TAKEME / ADMIN</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{heading.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--takeme-gray)]">{heading.description}</p></div><button type="button" onClick={refresh} disabled={loading} className="button-secondary min-h-11 px-4"><RefreshCw size={16} /> Refresh</button></div>
    {section !== "settings" && <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4"><label className="grid gap-1 text-xs font-semibold text-stone-600">Time range<select value={preset} onChange={(event) => setPreset(event.target.value as AdminPreset)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm">{presets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{preset === "custom" && <><label className="grid gap-1 text-xs font-semibold text-stone-600">From<input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" /></label><label className="grid gap-1 text-xs font-semibold text-stone-600">To<input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" /></label></>}<button type="button" onClick={() => { setApplied({ preset, from, to }); setLoading(true); }} className="button-primary min-h-11 px-5">Apply</button><p className="text-xs text-[var(--takeme-gray)]">Dates use Malaysia time. Cards label period vs current snapshot.</p></div>}
    {loading && <div role="status" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-29 animate-pulse rounded-2xl bg-white" />)}</div>}
    {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" onClick={refresh} className="ml-2 font-bold underline">Retry</button></div>}
    {metrics && <><p className="mt-5 text-xs font-semibold text-[var(--takeme-gray)]">{metrics.range.label} · refreshed on request · no live polling</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.cards.map((item) => <article key={item.label} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-[var(--takeme-gray)]">{item.label}</p><span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600">{item.scope}</span></div><p className={`mt-3 break-words font-bold ${item.value === null ? "text-sm text-stone-500" : "text-2xl tracking-tight"}`}>{displayValue(item.value, item.unit)}</p>{item.note && <p className="mt-2 text-xs leading-5 text-[var(--takeme-gray)]">{item.note}</p>}</article>)}</div>
      {metrics.series.some((item) => item.points.length) && <div className="mt-5 grid gap-4 xl:grid-cols-2">{metrics.series.filter((item) => item.points.length).map((item) => <SeriesChart key={item.label} series={item} />)}</div>}
      {metrics.breakdowns.length > 0 && <div className="mt-5 grid gap-4 xl:grid-cols-2">{metrics.breakdowns.map((group) => <BreakdownCard key={group.label} group={group} />)}</div>}
      {section === "intelligence" && <div className="mt-5 rounded-2xl border border-green-100 bg-[var(--takeme-light-green)] p-4 text-sm"><strong>Recommendation analytics:</strong> impressions are event batches; clicks are individual listing events. A true CTR is intentionally withheld until per-listing exposure can be counted.</div>}
      {section === "settings" && <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-7"><p><strong>Access:</strong> Firebase Authentication custom claim <code>admin: true</code>, verified again by each privileged Cloud Function.</p><p><strong>Metric authority:</strong> trusted Firestore records and aggregation queries. No client-written financial totals.</p><p><strong>Operations:</strong> read-only. Claim assignment, moderation and payment configuration happen outside this dashboard.</p></div>}
      {metrics.unavailable.length > 0 && <section className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-5"><h2 className="text-sm font-bold">Not available yet / interpretation notes</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[var(--takeme-gray)]">{metrics.unavailable.map((note) => <li key={note}>{note}</li>)}</ul></section>}</>}
    {hasList && page && <section className="mt-7 min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Recent {section}</h2><p className="text-xs text-[var(--takeme-gray)]">20 records per page · newest first</p></div>{section === "reports" && <label className="text-xs font-semibold">Status <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(null); setCursor(undefined); setLoading(true); }} className="ml-2 min-h-11 rounded-xl border border-gray-200 px-3"><option value="">All</option>{["submitted", "reviewing", "resolved", "dismissed"].map((value) => <option key={value}>{value}</option>)}</select></label>}</div>{page.rows.length ? <div className="min-w-0 overflow-x-auto"><table className="w-full min-w-[580px] border-collapse text-left text-xs sm:text-sm"><thead><tr className="border-b border-gray-200 text-[var(--takeme-gray)]"><th className="py-3 pr-3">Record</th><th className="py-3 pr-3">Type / context</th><th className="py-3 pr-3">Status / value</th><th className="py-3 pr-3">Created</th></tr></thead><tbody>{page.rows.map((row) => <AdminRowView key={row.id} section={section as AdminList} row={row} />)}</tbody></table></div> : <p className="rounded-xl bg-stone-50 p-5 text-sm text-[var(--takeme-gray)]">No {section} records yet.</p>}{cursor && <button type="button" disabled={moreLoading} onClick={() => void loadMore()} className="button-secondary mt-4 min-h-11 px-5">{moreLoading ? "Loading…" : "Load more"}</button>}</section>}
  </div>;
}

function SeriesChart({ series }: { series: AdminMetrics["series"][number] }) {
  const maximum = Math.max(1, ...series.points.map((item) => item.amountSen ?? item.count));
  return <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-sm font-bold">{series.label}</h2><div className="mt-6 flex h-38 items-end gap-2" role="img" aria-label={series.points.map((item) => `${item.label}: ${item.amountSen === undefined ? item.count : money(item.amountSen)}`).join(", ")}>{series.points.map((item) => <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-stone-600">{item.amountSen === undefined ? number(item.count) : money(item.amountSen)}</span><div className="w-full max-w-15 rounded-t-lg bg-[var(--takeme-green)]" style={{ height: `${Math.max(4, (item.amountSen ?? item.count) / maximum * 110)}px` }} /><span className="max-w-full truncate text-[9px] text-stone-500">{item.label.slice(5)}</span></div>)}</div></section>;
}
function BreakdownCard({ group }: { group: AdminMetrics["breakdowns"][number] }) {
  const maximum = Math.max(1, ...group.items.map((item) => item.amountSen ?? item.count));
  return <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="text-sm font-bold">{group.label}</h2><div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{group.items.map((item) => <div key={item.label}><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate capitalize">{label(item.label)}</span><strong className="shrink-0">{item.amountSen === undefined ? number(item.count) : `${money(item.amountSen)} · ${item.count}`}</strong></div><div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-[var(--takeme-dark-green)]" style={{ width: `${(item.amountSen ?? item.count) / maximum * 100}%` }} /></div></div>)}</div></section>;
}
function AdminRowView({ section, row }: { section: AdminList; row: AdminRow }) {
  const title = section === "users" ? row.displayName : section === "listings" ? row.title : section === "transactions" ? row.listingTitle : section === "promotions" ? row.listingId : section === "reviews" ? `${row.rating} ★ review` : `${row.targetType} report`;
  const context = section === "listings" ? getCategoryName(String(row.categoryId)) : section === "transactions" ? row.type : section === "reviews" ? row.reviewerRole : section === "reports" ? row.reason : section === "promotions" ? row.type : row.location;
  const state = section === "transactions" ? `${row.status} · ${money(Number(row.amountSen ?? 0))}` : section === "listings" ? `${row.status} · RM ${row.price}` : section === "promotions" ? `${row.status} · ${row.paymentStatus}` : section === "reviews" ? `Published ${row.publishedAt ? new Date(String(row.publishedAt)).toLocaleDateString("en-MY") : "—"}` : section === "reports" ? row.status : "Public profile";
  return <tr className="border-b border-stone-100"><td className="py-3 pr-3"><Link href={`/admin/${section}/${encodeURIComponent(row.id)}`} className="font-semibold text-[var(--takeme-dark-green)] underline-offset-2 hover:underline">{String(title ?? row.id)}</Link><span className="block max-w-48 truncate text-[10px] text-stone-400">{row.id}</span></td><td className="py-3 pr-3 capitalize">{String(context ?? "—")}</td><td className="py-3 pr-3 capitalize">{String(state ?? "—")}</td><td className="py-3 pr-3 text-stone-500">{row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString("en-MY") : "—"}</td></tr>;
}
