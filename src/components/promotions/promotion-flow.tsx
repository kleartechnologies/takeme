"use client";

import { ArrowLeft, Clock3, LoaderCircle, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ErrorState } from "@/components/ui/states";
import { getListing } from "@/lib/services/listings";
import { useCurrentTime } from "@/lib/use-current-time";
import { cancelPromotionRequest, createPromotionRequest, getMyPromotionRequests, getPromotionPackages, type PromotionPackage, type PromotionType, type SellerPromotion } from "@/lib/services/promotions";
import type { Listing } from "@/types/marketplace";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const label = (status: SellerPromotion["status"]) => status === "pending_payment" ? "Awaiting payment setup" : status === "active" ? "Active" : status === "scheduled" ? "Scheduled" : status === "expired" ? "Expired" : "Cancelled";

export function PromotionFlow({ listingId, initialType }: { listingId: string; initialType: PromotionType }) {
  const { user, loading: authLoading } = useAuth();
  const now = useCurrentTime(30_000);
  const [listing, setListing] = useState<Listing | null>(null);
  const [packages, setPackages] = useState<PromotionPackage[]>([]);
  const [history, setHistory] = useState<SellerPromotion[]>([]);
  const [type, setType] = useState<PromotionType>(initialType);
  const [packageId, setPackageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getListing(listingId), getPromotionPackages(), getMyPromotionRequests(listingId)]).then(([item, catalog, promotions]) => {
      if (!active) return;
      setListing(item); setPackages(catalog.packages); setHistory(promotions); setLoading(false);
    }).catch(() => { if (active) { setError("Promotion setup is unavailable right now. Your listing is still free and active as usual."); setLoading(false); } });
    return () => { active = false; };
  }, [listingId, user]);

  const eligible = listing?.status === "active" && (listing.listingType === "buy_now" || (now > 0 && ["active", "scheduled"].includes(listing.auctionStatus ?? "") && Boolean(listing.auctionEndAt && new Date(listing.auctionEndAt).getTime() > now)));
  const pending = history.find((item) => item.status === "pending_payment" || item.status === "active" || item.status === "scheduled");
  const options = packages.filter((item) => item.type === type && item.available);
  const selected = options.find((item) => item.id === packageId) ?? options[0];

  async function create() {
    if (!selected || !listing || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await createPromotionRequest(listing.id, selected.id);
      setHistory(await getMyPromotionRequests(listing.id));
      setNotice("Request saved. No payment was taken, and your listing is not promoted yet.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save your promotion request."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError(""); setNotice("");
    try { await cancelPromotionRequest(id); setHistory(await getMyPromotionRequests(listingId)); setNotice("Promotion request cancelled. No payment was taken."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not cancel this request."); }
    finally { setBusy(false); }
  }

  if (authLoading || (user && loading)) return <div className="min-h-80 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-7 text-center"><h1 className="text-2xl font-bold">Promote your listing</h1><p className="mt-3 text-sm text-[var(--takeme-gray)]">Log in as the seller to manage a promotion.</p><Link href={`/login?next=${encodeURIComponent(`/listings/${listingId}/promote`)}`} className="button-primary mt-5 min-h-12 px-6">Log in</Link></div>;
  if (error && !listing) return <div><ErrorState message={error} /><Link href={`/listings/${listingId}`} className="button-secondary mt-4 min-h-11 px-5">Back to listing</Link></div>;
  if (!listing || listing.sellerId !== user.uid) return <ErrorState message="Only the listing seller can manage this promotion." />;

  return <div className="mx-auto max-w-3xl">
    <Link href={`/listings/${listing.id}`} className="mb-5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--takeme-dark-green)]"><ArrowLeft size={17} /> Back to listing</Link>
    <p className="eyebrow">Optional visibility</p><h1 className="page-title mt-2">Promote your listing</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--takeme-gray)]">Listing on TAKEME remains free. Boost and Featured are optional paid visibility, never reputation or verification.</p>
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--takeme-gray)]">Your listing</p><p className="mt-1 font-bold">{listing.title}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">{listing.listingType === "buy_now" ? "Fixed price" : "Auction"} · {listing.status}</p></div>
    {!eligible && <div role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Only active, available listings and auctions that have not ended can be promoted. No request can be made for this listing right now.</div>}
    {pending ? <section className="mt-7 rounded-3xl border border-[var(--takeme-green)]/35 bg-[var(--takeme-light-green)] p-5 sm:p-7"><h2 className="text-xl font-bold">{pending.type === "featured" ? "Featured" : "Boost"} request</h2><p className="mt-2 text-sm font-semibold">{label(pending.status)}</p><p className="mt-2 text-sm leading-6 text-[var(--takeme-gray)]">{pending.status === "pending_payment" ? "Payment integration is not configured. No charge has been made; this promotion is not live and has no extra placement." : `Package: ${pending.packageId}. Verified paid promotion status is controlled by TAKEME.`}</p>{pending.status === "active" && <p className="mt-3 text-sm">{pending.impressions} observed impressions · {pending.clicks} clicks<br />Ends {pending.endAt ? new Date(pending.endAt).toLocaleString("en-MY") : "—"}{pending.endAt && now > 0 ? ` · About ${Math.max(0, Math.ceil((new Date(pending.endAt).getTime() - now) / 3_600_000))}h remaining` : ""}</p>}{pending.status === "pending_payment" && <button type="button" disabled={busy} onClick={() => void cancel(pending.id)} className="button-secondary mt-5 min-h-11 px-5">{busy && <LoaderCircle size={16} className="animate-spin" />}Cancel request</button>}</section>
      : <><div className="mt-7 grid gap-3 sm:grid-cols-2" role="group" aria-label="Promotion type"><button type="button" aria-pressed={type === "boost"} onClick={() => { setType("boost"); setPackageId(""); }} className={`min-h-28 rounded-2xl border p-4 text-left ${type === "boost" ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]" : "border-gray-200 bg-white"}`}><Sparkles size={22} className="text-[var(--takeme-dark-green)]" /><span className="mt-2 block font-bold">Boost</span><span className="mt-1 block text-sm text-[var(--takeme-gray)]">Get more visibility in relevant discovery results.</span></button><button type="button" aria-pressed={type === "featured"} onClick={() => { setType("featured"); setPackageId(""); }} className={`min-h-28 rounded-2xl border p-4 text-left ${type === "featured" ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]" : "border-gray-200 bg-white"}`}><Star size={22} className="text-[var(--takeme-dark-green)]" /><span className="mt-2 block font-bold">Featured</span><span className="mt-1 block text-sm text-[var(--takeme-gray)]">Get premium placement in a dedicated section.</span></button></div>
        <section className="mt-7"><h2 className="text-xl font-bold">Choose a duration</h2><p className="mt-1 text-xs text-[var(--takeme-gray)]">Example pricing only. Final prices and checkout are not live.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{options.map((item) => <button key={item.id} type="button" aria-pressed={selected?.id === item.id} onClick={() => setPackageId(item.id)} className={`flex min-h-20 items-center justify-between gap-3 rounded-2xl border p-4 text-left ${selected?.id === item.id ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]" : "border-gray-200 bg-white"}`}><span className="flex items-center gap-2 font-semibold"><Clock3 size={17} />{item.label}</span><span className="font-bold">{money.format(item.priceSen / 100)}</span></button>)}</div></section>
        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-amber-950">Payment integration not yet configured</p><p className="mt-2 text-sm leading-6 text-amber-900">You can save a request to see the planned package, but you cannot pay or activate a promotion yet. No listing receives a paid badge or extra placement from a request.</p></div><button type="button" disabled={!selected || !eligible || busy} onClick={() => void create()} className="button-primary mt-5 min-h-12 w-full px-6">{busy && <LoaderCircle size={17} className="animate-spin" />}Save promotion request — no payment</button></>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--takeme-light-green)] p-3 text-sm text-[var(--takeme-dark-green)]">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {history.filter((item) => item.id !== pending?.id).length > 0 && <section className="mt-8"><h2 className="text-lg font-bold">Previous requests</h2><div className="mt-3 space-y-2">{history.filter((item) => item.id !== pending?.id).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm"><span>{item.type === "featured" ? "Featured" : "Boost"} · {item.packageId}</span><span className="font-semibold">{label(item.status)}</span></div>)}</div></section>}
  </div>;
}
