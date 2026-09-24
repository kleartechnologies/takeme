"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getPublicReviews, getReputationPolicy, reportPublicReview, type ReputationPolicy } from "@/lib/services/transactions";
import { getTrustSummary } from "@/lib/services/trust";
import { clearPublicSellerSummaryCache, getPublicSellerSummary } from "@/lib/services/public-sellers";
import type { PublicReview, ReputationTier, RoleReputation, TrustSummary } from "@/types/marketplace";

const tiers: ReputationTier[] = ["bronze", "silver", "gold", "platinum"];
const reportReasons = [
  ["false_information", "False information"], ["harassment", "Harassment"], ["offensive_content", "Offensive content"],
  ["spam", "Spam"], ["personal_information", "Personal information"], ["unrelated", "Unrelated to transaction"], ["other", "Other"],
] as const;

export function ReputationView({ uid, compact = false, initialSummary, publicSellerOnly = false }: { uid: string; compact?: boolean; initialSummary?: TrustSummary | null; publicSellerOnly?: boolean }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TrustSummary | null>(initialSummary ?? null);
  const [policy, setPolicy] = useState<ReputationPolicy | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState("");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    const trust = publicSellerOnly ? getPublicSellerSummary(uid).then((seller): TrustSummary | null => seller ? {
      userId: uid, verificationStatus: seller.verificationStatus, updatedAt: "",
      buyer: { completedCount: 0, tier: null, reviewCount: 0, ratingSum: 0, averageRating: null, ratingDistribution: {} },
      seller: { completedCount: seller.sellerCompletedTransactionCount, tier: seller.sellerTier, reviewCount: seller.sellerReviewCount, ratingSum: 0, averageRating: seller.sellerRating, ratingDistribution: {} },
    } : null) : initialSummary !== undefined ? Promise.resolve(initialSummary) : getTrustSummary(uid);
    Promise.all([trust, getReputationPolicy(), compact ? Promise.resolve([]) : getPublicReviews(uid, publicSellerOnly)])
      .then(([nextSummary, nextPolicy, nextReviews]) => { if (active) { setSummary(nextSummary); setPolicy(nextPolicy); setReviews(nextReviews); setLoading(false); } })
      .catch(() => { if (active) { setError("Reputation is unavailable right now."); setLoading(false); } });
    return () => { active = false; };
  }, [uid, compact, initialSummary, publicSellerOnly, retry]);
  async function submitReport(reviewId: string) {
    setReportNotice("");
    try { await reportPublicReview(reviewId, reason, details); setReportNotice("Review report submitted for moderation."); setReporting(""); setDetails(""); }
    catch { setReportNotice("Could not submit the report. Please try again."); }
  }
  if (loading) return <div className="mt-6 min-h-28 animate-pulse rounded-2xl bg-stone-100" />;
  if (error || !policy || (publicSellerOnly && !summary)) return <div className="mt-6"><p className="text-sm text-[var(--takeme-gray)]">{error || "Reputation is unavailable."}</p><button type="button" className="button-secondary mt-3 min-h-11 px-4" onClick={() => { if (publicSellerOnly) clearPublicSellerSummaryCache(); setRetry((value) => value + 1); }}>Retry</button></div>;
  return <section className="mt-7" aria-label="Marketplace reputation">
    {!compact && <div className="mb-4"><h2 className="text-xl font-bold">{publicSellerOnly ? "Seller reputation" : "Marketplace reputation"}</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">{publicSellerOnly ? "Based on confirmed sales and published buyer reviews." : "Buyer and seller activity are separate. Only mutually confirmed completed transactions count."}</p></div>}
    <div className={`grid gap-3 ${compact || publicSellerOnly ? "" : "md:grid-cols-2"}`}>{!publicSellerOnly && <RoleCard role="buyer" data={summary?.buyer} policy={policy} compact={compact} />}<RoleCard role="seller" data={summary?.seller} policy={policy} compact={compact} /></div>
    {!compact && <><Link href="/help/tiers" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)] underline underline-offset-4">How TAKEME tiers work</Link>
      <div className="mt-5"><h3 className="text-lg font-bold">Published reviews</h3><p className="mt-1 text-xs text-[var(--takeme-gray)]">Reviews appear after both parties submit or the review window closes.</p>
        {reviews.length ? <div className="mt-3 space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{review.reviewerRole === "buyer" ? "Buyer → seller" : "Seller → buyer"} · {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></p><time className="text-xs text-[var(--takeme-gray)]">{new Date(review.createdAt).toLocaleDateString("en-MY")}</time></div>{review.tags.length > 0 && <p className="mt-2 text-xs text-[var(--takeme-gray)]">{review.tags.join(" · ")}</p>}{review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.comment}</p>}
          {user && <div className="mt-2"><button type="button" onClick={() => setReporting(reporting === review.id ? "" : review.id)} className="min-h-11 text-xs font-semibold text-[var(--takeme-gray)] underline underline-offset-4">Report review</button>{reporting === review.id && <div className="grid gap-2 rounded-xl bg-stone-50 p-3"><label className="text-xs font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="input-shell mt-1 min-h-11 w-full px-3">{reportReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold">Details (optional)<textarea maxLength={1000} rows={2} value={details} onChange={(event) => setDetails(event.target.value)} className="input-shell mt-1 w-full px-3 py-2" /></label><button type="button" onClick={() => void submitReport(review.id)} className="button-secondary min-h-11 px-4">Submit report</button></div>}</div>}
        </article>)}</div> : <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-sm text-[var(--takeme-gray)]">No published reviews yet.</p>}
        {reportNotice && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">{reportNotice}</p>}
      </div></>}
  </section>;
}

function RoleCard({ role, data, policy, compact }: { role: "buyer" | "seller"; data?: RoleReputation; policy: ReputationPolicy; compact: boolean }) {
  const count = data?.completedCount ?? 0;
  const tier = data?.tier ?? null;
  const currentThreshold = tier ? policy.thresholds[tier] : 0;
  const nextTier = tiers.find((item) => count < policy.thresholds[item]);
  const nextThreshold = nextTier ? policy.thresholds[nextTier] : policy.thresholds.platinum;
  const percent = nextTier ? Math.max(0, Math.min(100, (count - currentThreshold) / (nextThreshold - currentThreshold) * 100)) : 100;
  return <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--takeme-gray)]">{role} reputation</p><p className="mt-1 font-bold capitalize">{tier ? `${tier} ${role}` : `No ${role} tier yet`}</p></div>{tier && <Image src={`/brand/tiers/${tier}.png`} alt={`${tier} tier badge`} width={110} height={44} className="h-11 w-auto max-w-[110px] object-contain" />}</div>
    <p className="mt-2 text-sm">{count} completed {role === "buyer" ? "purchases" : "sales"}{data?.reviewCount ? ` · ${data.averageRating?.toFixed(1) ?? "—"} ★ from ${data.reviewCount} reviews` : " · No ratings yet"}</p>
    {!compact && <><div className="mt-4 flex justify-between gap-2 text-xs font-semibold capitalize"><span>{tier ?? "Start"}</span><span>{nextTier ?? "Platinum"}</span></div><div role="progressbar" aria-label={`${role} tier progress`} aria-valuemin={currentThreshold} aria-valuemax={nextThreshold} aria-valuenow={Math.min(count, nextThreshold)} className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-[var(--takeme-green)]" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-[var(--takeme-gray)]">{nextTier ? `${count} / ${nextThreshold} · ${nextThreshold - count} more completed ${role === "buyer" ? "purchases" : "sales"} to ${nextTier}` : `${count} completed ${role === "buyer" ? "purchases" : "sales"} · Highest current tier`}</p></>}
  </div>;
}
