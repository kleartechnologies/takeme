"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ShoppingBag, Star, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getPublicReviews, getReputationPolicy, reportPublicReview, type ReputationPolicy } from "@/lib/services/transactions";
import { getTrustSummary } from "@/lib/services/trust";
import type { PublicReview, ReputationTier, RoleReputation, TrustSummary } from "@/types/marketplace";
import { SellerReviews } from "@/components/profile/seller-reviews";

const tiers: ReputationTier[] = ["bronze", "silver", "gold", "platinum"];
const reportReasons = [
  ["false_information", "False information"], ["harassment", "Harassment"], ["offensive_content", "Offensive content"],
  ["spam", "Spam"], ["personal_information", "Personal information"], ["unrelated", "Unrelated to transaction"], ["other", "Other"],
] as const;

export function ReputationView(props: { uid: string; compact?: boolean; initialSummary?: TrustSummary | null; publicSellerOnly?: boolean }) {
  // The public contract never mounts private progress calculations or reads trustSummaries.
  return props.publicSellerOnly ? <SellerReviews uid={props.uid} /> : <OwnerReputationView {...props} />;
}

function OwnerReputationView({ uid, compact = false, initialSummary }: { uid: string; compact?: boolean; initialSummary?: TrustSummary | null }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TrustSummary | null>(initialSummary ?? null);
  const [policy, setPolicy] = useState<ReputationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (user?.uid !== uid) return;
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    const trust = initialSummary !== undefined ? Promise.resolve(initialSummary) : getTrustSummary(uid);
    Promise.all([trust, getReputationPolicy()])
      .then(([nextSummary, nextPolicy]) => { if (active) { setSummary(nextSummary); setPolicy(nextPolicy); setLoading(false); } })
      .catch(() => { if (active) { setError("Reputation is unavailable right now."); setLoading(false); } });
    return () => { active = false; };
  }, [uid, compact, initialSummary, retry, user]);
  if (user?.uid !== uid) return null;
  if (loading) return <div role="status" aria-label="Loading reputation" className="min-h-28 animate-pulse rounded-2xl bg-[var(--takeme-light-green)]"><span className="sr-only">Loading reputation…</span></div>;
  if (error || !policy) return <div className="surface-card p-4"><p role="alert" className="text-sm text-[var(--takeme-gray)]">{error || "Reputation is unavailable."}</p><button type="button" className="button-secondary mt-3 min-h-11 px-4" onClick={() => setRetry((value) => value + 1)}>Retry reputation</button></div>;
  return <section className="owner-reputation" aria-label="Private marketplace reputation">
    {!compact && <div className="owner-status-heading"><h2 className="text-base font-bold">My TAKEME Status</h2><p className="text-xs text-[var(--takeme-gray)]">Private to you.</p></div>}
    <div className="owner-tier-grid"><RoleCard role="buyer" data={summary?.buyer} policy={policy} compact={compact} /><RoleCard role="seller" data={summary?.seller} policy={policy} compact={compact} /></div>
    {!compact && <Link href="/help/tiers" className="owner-tier-help inline-flex min-h-11 items-center text-xs font-semibold text-[var(--takeme-dark-green)] underline underline-offset-4">How TAKEME tiers work</Link>}
  </section>;
}

export function OwnerPublishedReviews({ uid }: { uid: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState("");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (user?.uid !== uid) return;
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    getPublicReviews(uid).then((value) => { if (active) { setReviews(value); setLoading(false); } })
      .catch(() => { if (active) { setError("Reviews are unavailable right now."); setLoading(false); } });
    return () => { active = false; };
  }, [uid, user, retry]);
  async function submitReport(reviewId: string) {
    setReportNotice("");
    try { await reportPublicReview(reviewId, reason, details); setReportNotice("Review report submitted for moderation."); setReporting(""); setDetails(""); }
    catch { setReportNotice("Could not submit the report. Please try again."); }
  }
  if (user?.uid !== uid) return null;
  return <details className="profile-owner-reviews"><summary className="profile-menu-link"><Star size={19} aria-hidden="true" /><span className="min-w-0 flex-1">Reviews</span><ChevronRight size={17} aria-hidden="true" /></summary><div className="profile-owner-reviews-content"><p className="mt-1 text-xs text-[var(--takeme-gray)]">Reviews appear after both parties submit or the review window closes. Buyer and seller reviews below are private to your account view.</p>
        {loading ? <p role="status" className="py-3 text-sm text-[var(--takeme-gray)]">Loading reviews…</p> : error ? <div className="py-3"><p role="alert" className="text-sm text-[var(--takeme-gray)]">{error}</p><button type="button" className="button-secondary mt-2 min-h-11 px-4" onClick={() => setRetry((value) => value + 1)}>Retry reviews</button></div> :
        reviews.length ? <div className="mt-3 space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{review.reviewerRole === "buyer" ? "Buyer → seller" : "Seller → buyer"} · {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></p><time className="text-xs text-[var(--takeme-gray)]">{new Date(review.createdAt).toLocaleDateString("en-MY")}</time></div>{review.tags.length > 0 && <p className="mt-2 text-xs text-[var(--takeme-gray)]">{review.tags.join(" · ")}</p>}{review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.comment}</p>}
          {user && <div className="mt-2"><button type="button" onClick={() => setReporting(reporting === review.id ? "" : review.id)} className="min-h-11 text-xs font-semibold text-[var(--takeme-gray)] underline underline-offset-4">Report review</button>{reporting === review.id && <div className="grid gap-2 rounded-xl bg-stone-50 p-3"><label className="text-xs font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="input-shell mt-1 min-h-11 w-full px-3">{reportReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold">Details (optional)<textarea maxLength={1000} rows={2} value={details} onChange={(event) => setDetails(event.target.value)} className="input-shell mt-1 w-full px-3 py-2" /></label><button type="button" onClick={() => void submitReport(review.id)} className="button-secondary min-h-11 px-4">Submit report</button></div>}</div>}
        </article>)}</div> : <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-sm text-[var(--takeme-gray)]">No published reviews yet.</p>}
        {reportNotice && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">{reportNotice}</p>}
      </div></details>;
}

function RoleCard({ role, data, policy, compact }: { role: "buyer" | "seller"; data?: RoleReputation; policy: ReputationPolicy; compact: boolean }) {
  const count = data?.completedCount ?? 0;
  const tier = data?.tier ?? null;
  const currentThreshold = tier ? policy.thresholds[tier] : 0;
  const nextTier = tiers.find((item) => count < policy.thresholds[item]);
  const nextThreshold = nextTier ? policy.thresholds[nextTier] : policy.thresholds.platinum;
  const percent = nextTier ? Math.max(0, Math.min(100, (count - currentThreshold) / (nextThreshold - currentThreshold) * 100)) : 100;
  return <div className="owner-tier-card surface-card min-w-0 overflow-hidden"><div className="owner-tier-heading"><div><p className="flex items-center gap-1 text-[10px] font-semibold text-[var(--takeme-dark-green)]">{role === "buyer" ? <ShoppingBag size={13} aria-hidden="true" /> : <Store size={13} aria-hidden="true" />}{role === "buyer" ? "Buyer tier" : "Seller tier"}</p><p className="owner-tier-name font-bold capitalize">{tier ?? "No tier yet"}</p></div>{tier && <Image src={`/brand/tiers/${tier}.png`} alt={`${tier} tier badge`} width={80} height={32} className="h-5 w-auto max-w-14 object-contain" />}</div>
    <div className="owner-tier-metrics"><p><strong>{count}</strong> completed {role === "buyer" ? "purchases" : "sales"}</p><p>{data?.reviewCount ? `${data.averageRating?.toFixed(1) ?? "—"} ★ · ${data.reviewCount} reviews` : "No ratings yet"}</p></div>
    {!compact && <><div className="owner-tier-progress-label text-xs font-semibold capitalize"><span>{count} / {nextThreshold}</span><span>{nextTier ?? "Platinum"}</span></div><div role="progressbar" aria-label={`${role} tier progress`} aria-valuemin={currentThreshold} aria-valuemax={nextThreshold} aria-valuenow={Math.min(count, nextThreshold)} className="owner-tier-progress overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-[var(--takeme-green)]" style={{ width: `${percent}%` }} /></div><p className="owner-tier-next text-xs text-[var(--takeme-gray)]">{nextTier ? `${nextThreshold - count} more ${role === "buyer" ? "purchases" : "sales"} to ${nextTier}` : "Highest current tier"}</p></>}
  </div>;
}
