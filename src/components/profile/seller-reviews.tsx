"use client";

import { Star, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProfileEmpty } from "@/components/profile/profile-ui";
import { getPublicReviews, reportPublicReview } from "@/lib/services/transactions";
import { reviewDistribution } from "@/lib/profile-presentation";
import type { PublicReview, PublicSellerSummary } from "@/types/marketplace";

const reasons = [["false_information", "False information"], ["harassment", "Harassment"], ["offensive_content", "Offensive content"], ["spam", "Spam"], ["personal_information", "Personal information"], ["unrelated", "Unrelated to transaction"], ["other", "Other"]];
/** Only the existing seller-only review projection reaches this public surface. */
export function SellerReviews({ uid, seller }: { uid: string; seller?: PublicSellerSummary | null }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ uid: string; reviews: PublicReview[]; error: string }>({ uid: "", reviews: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [reporting, setReporting] = useState("");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    getPublicReviews(uid, true).then((reviews) => { if (active) setState({ uid, reviews: reviews.filter((review) => review.reviewerRole === "buyer"), error: "" }); }).catch(() => { if (active) setState({ uid, reviews: [], error: "Seller reviews are unavailable right now." }); });
    return () => { active = false; };
  }, [uid, retry]);
  async function report(reviewId: string) {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await reportPublicReview(reviewId, reason, details); setNotice("Review report submitted for moderation."); setReporting(""); setDetails(""); }
    catch { setNotice("Could not submit the report. Please try again."); }
    finally { setBusy(false); }
  }
  if (state.uid !== uid) return <div role="status" aria-label="Loading seller reviews" className="mt-4 min-h-32 animate-pulse rounded-2xl bg-gray-100" />;
  if (state.error) return <div className="profile-settings-card"><p role="alert" className="text-sm text-[var(--takeme-gray)]">{state.error}</p><button type="button" className="button-secondary mt-3 min-h-11 px-4" onClick={() => setRetry((value) => value + 1)}>Retry reviews</button></div>;
  const distribution = reviewDistribution(state.reviews);
  const filtered = state.reviews.filter((review) => !ratingFilter || review.rating === ratingFilter);
  return <section className="seller-reviews" aria-label="Public seller reviews"><h2 className="sr-only">Seller Reviews</h2><div className="seller-review-overview"><div><strong>{seller?.sellerRating?.toFixed(1) ?? "—"}</strong><p>out of 5</p><div className="profile-review-stars" aria-label={seller?.sellerRating ? `${seller.sellerRating} out of 5` : "No ratings yet"}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={17} fill={seller?.sellerRating && value <= Math.round(seller.sellerRating) ? "currentColor" : "none"} aria-hidden="true" />)}</div><p>{seller?.sellerReviewCount ?? state.reviews.length} reviews</p></div><div className="review-distribution"><p>Recent review ratings</p>{distribution.map(({ rating, count }) => <div key={rating}><span>{rating} ★</span><span className="review-distribution-track"><span style={{ width: `${state.reviews.length ? count / state.reviews.length * 100 : 0}%` }} /></span><span>{count}</span></div>)}</div></div>
    {state.reviews.length > 0 && <><p className="profile-review-note">Showing {state.reviews.length} recent published seller reviews. Reviewer identity and transaction details are not shared.</p><div className="profile-tabs banner-track" role="group" aria-label="Filter seller review ratings"><button type="button" aria-pressed={ratingFilter === 0} onClick={() => setRatingFilter(0)}>All</button>{[5, 4, 3, 2, 1].map((value) => <button key={value} type="button" aria-pressed={ratingFilter === value} onClick={() => setRatingFilter(value)}>{value} stars</button>)}</div></>}
    {filtered.length ? <div className="seller-review-list">{filtered.map((review) => <article key={review.id}><div className="flex items-start gap-3"><span className="review-anonymous-avatar"><UserRound size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs">Buyer review</strong><time className="text-[10px] text-[var(--takeme-gray)]">{new Date(review.createdAt).toLocaleDateString("en-MY")}</time></div><p className="profile-review-stars text-sm" aria-label={`${review.rating} out of 5`}>{"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></p>{review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.comment}</p>}{review.tags.length > 0 && <p className="mt-2 text-xs text-[var(--takeme-gray)]">{review.tags.join(" · ")}</p>}{user && <><button type="button" className="min-h-11 text-xs text-[var(--takeme-gray)] underline" onClick={() => setReporting(reporting === review.id ? "" : review.id)}>Report review</button>{reporting === review.id && <div className="grid gap-3"><label className="form-field"><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-field"><span>Details (optional)</span><textarea maxLength={1000} rows={2} value={details} onChange={(event) => setDetails(event.target.value)} /></label><button type="button" disabled={busy} className="button-secondary min-h-11 px-4" onClick={() => void report(review.id)}>{busy ? "Submitting…" : "Submit report"}</button></div>}</>}</div></div></article>)}</div> : <ProfileEmpty title={state.reviews.length ? "No reviews with this rating" : "No reviews yet"} description="Published buyer reviews from completed sales will appear here." />}
    {notice && <p role="status" className="mt-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}
  </section>;
}
