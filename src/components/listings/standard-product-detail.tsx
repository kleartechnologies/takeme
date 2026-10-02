"use client";

import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Copy, Ellipsis, ImageIcon, MapPin, MessageCircle, Share2, ShieldCheck, Sparkles, Star, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCategoryName } from "@/data/categories";
import { SaveButton } from "@/components/saved/save-button";
import { FollowSellerButton } from "@/components/profile/follow-seller-button";
import { ProfileAvatar, VerifiedLabel } from "@/components/profile/profile-ui";
import { ReportAction } from "@/components/trust/report-action";
import { ActionSheet } from "@/components/ui/action-sheet";
import { ListingDealPanel } from "@/components/transactions/listing-deal-panel";
import { AuctionPanel, AuctionStatusBadge, BidHistory } from "./auction-panel";
import type { PublicAuctionBid } from "@/lib/services/listings";
import { effectiveStatus } from "@/lib/auction-presentation";
import { useCurrentTime } from "@/lib/use-current-time";
import { ListingCard } from "./listing-card";
import { SimilarListings } from "./similar-listings";
import { openListingConversation } from "@/lib/services/conversations";
import { clearPublicSellerSummaryCache, getPublicSellerSummary } from "@/lib/services/public-sellers";
import { getPublicReviews } from "@/lib/services/transactions";
import { formatPublicLocation, parsePublicLocation } from "@/lib/general-location";
import { listingCanonicalUrl } from "@/lib/listing-metadata";
import type { Listing, PublicReview, PublicSellerSummary } from "@/types/marketplace";
import styles from "./standard-product.module.css";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
const conditions = { New: "Brand new, unused.", "Like new": "Used, with minimal signs of wear.", Good: "Used, with normal signs of use.", Fair: "Used, with visible wear. Read the description for details." };
const statusLabels = { active: "Available", sold: "Sold", ended: "Unavailable", removed: "Removed", draft: "Private draft" };

export function StandardProductDetail({ listing, related, userId, created, share, shareMessage, bids = [], onAuctionChange = () => {}, previewMode = false }: { listing: Listing; related: Listing[]; userId?: string; created: boolean; share: () => Promise<void>; shareMessage: string; bids?: PublicAuctionBid[]; onAuctionChange?: () => void; previewMode?: boolean }) {
  const auction = listing.listingType === "auction" || listing.listingType === "buy_now_and_auction";
  const now = useCurrentTime();
  const auctionStatus = effectiveStatus(listing, now);
  const owner = userId === listing.sellerId;
  const DetailRoot = previewMode ? "section" : "main";
  const [menu, setMenu] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const area = parsePublicLocation(listing.publicLocation);
  const location = area ? formatPublicLocation(area) : "General area unavailable";
  async function copyLink() {
    try { await navigator.clipboard.writeText(listingCanonicalUrl(listing.id, process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin)); setCopyMessage("Link copied"); }
    catch { setCopyMessage("Could not copy the link. Use Share instead."); }
  }
  return <DetailRoot className={styles.page} data-standard-product={!auction || undefined} data-auction-product={auction || undefined} data-auction-result={auction && listing.auctionStatus === "ended" && listing.status === "ended" || undefined} data-owner={owner || undefined}>
    {!previewMode && <nav className={styles.toolbar} aria-label="Product navigation"><Link href="/explore" className="icon-button" aria-label="Back to Explore"><ArrowLeft size={21} /></Link><span><Image src="/brand/takeme-wordmark.png" alt="TAKEME" width={104} height={35} className={styles.toolbarBrand} /><span className={styles.toolbarTitle}>{auction ? "Auction details" : "Product details"}</span></span><div><SaveButton listingId={listing.id} compact /><button type="button" className="icon-button" aria-label="Share listing" onClick={() => void share()}><Share2 size={20} /></button><button type="button" className="icon-button" aria-label="Listing options" onClick={() => setMenu(true)}><Ellipsis size={21} /></button></div></nav>}
    {shareMessage && <p role="status" className={styles.notice}>{shareMessage}</p>}
    {created && listing.status === "active" && <p role="status" className={styles.notice}>{auction ? auctionStatus === "scheduled" ? "Your auction is published. Bidding opens at the scheduled start time." : "Your auction is published in the TAKEME marketplace." : "Your listing is live in the TAKEME marketplace."}</p>}
    {listing.status !== "active" && (!auction || ["draft", "removed"].includes(listing.status)) && <p className={styles.statusNotice}>{statusLabels[listing.status]}{["draft", "removed"].includes(listing.status) ? " · Only visible to its owner" : auction ? " · Bidding is closed" : " · New offers are unavailable"}</p>}
    <div className={styles.top}>
      <ProductGallery listing={listing} badge={auction ? <AuctionStatusBadge listing={listing} /> : undefined} />
      <section className={styles.identity} aria-label="Product information">
        <p className={styles.category}>{getCategoryName(listing.categoryId)}</p>
        <h1>{listing.title}</h1>
        {!auction && <p className={styles.price}>{money.format(listing.price)}{listing.status !== "active" && <small>Listed price</small>}</p>}
        <div className={styles.badges}><span>{listing.condition}</span>{!auction && listing.status !== "active" && <span className={styles.statusBadge}>{statusLabels[listing.status]}</span>}</div>
        <p className={styles.area}><MapPin size={14} aria-hidden="true" />{location}</p>
        {auction && <AuctionPanel listing={listing} userId={userId} owner={owner} onChange={onAuctionChange} previewMode={previewMode} />}
        {!auction && <p className={styles.preview}>{listing.description.replace(/\s+/g, " ").trim()}</p>}<a href="#product-description" className={styles.textLink}>Read description <ArrowRight size={14} /></a>
        <ProductSeller uid={listing.sellerId} previewMode={previewMode} />
        {!previewMode && !auction && <ProductActionBar listing={listing} userId={userId} />}
      </section>
    </div>
    <div className={styles.content}>
      <section className={styles.section} aria-labelledby="item-details"><h2 id="item-details">Item details</h2><dl className={styles.facts}><div><dt>Condition</dt><dd>{listing.condition}</dd></div><div><dt>Category</dt><dd>{getCategoryName(listing.categoryId)}</dd></div><div><dt>Status</dt><dd>{auction ? listing.status === "draft" ? "Private draft" : listing.status === "removed" ? "Removed" : auctionStatus === "active" ? "Live auction" : auctionStatus === "scheduled" ? "Scheduled auction" : auctionStatus === "cancelled" ? "Cancelled" : "Bidding closed" : statusLabels[listing.status]}</dd></div><div><dt>Posted</dt><dd>{new Date(listing.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</dd></div></dl><p className={styles.conditionGuide}><ShieldCheck size={16} aria-hidden="true" /><span><strong>{listing.condition}</strong> — {conditions[listing.condition]}</span></p></section>
      <section className={styles.section} id="product-description"><h2>Description</h2><p className={styles.description}>{listing.description}</p></section>
      <section className={styles.section} aria-labelledby="delivery-heading"><h2 id="delivery-heading">Delivery & meet-up</h2><div className={styles.delivery}><MapPin size={20} aria-hidden="true" /><div><strong>{listing.meetupLocation ? "Public meet-up location" : "General listing area"}</strong><p>{listing.meetupLocation ? `${listing.meetupLocation.name} · ${listing.meetupLocation.area}, ${listing.meetupLocation.state}` : location}</p></div></div><p className={styles.muted}>Ask the seller about collection or delivery in Chat. Availability, arrangements and any costs must be agreed together.</p></section>
      <section className={`${styles.section} ${styles.safety}`} aria-labelledby="safety-heading"><h2 id="safety-heading"><ShieldCheck size={20} aria-hidden="true" />A little care goes a long way</h2><p>Check the item and seller reviews. Agree the exchange clearly, and never share passwords or verification codes.</p><p>TAKEME does not process buyer-to-seller payments. {auction ? "An auction win agrees a result; it does not confirm payment or a completed sale." : "Accepting an offer agrees a price; it does not confirm payment or a completed sale."}</p>{!previewMode && !owner && <ReportAction targetType="listing" targetId={listing.id} label="Report listing" />}</section>
      {!previewMode && <ProductReviews uid={listing.sellerId} />}
      {!previewMode && auction && <BidHistory listing={listing} bids={bids} />}
      {!previewMode && !auction && <details className={`${styles.section} ${styles.requests}`}><summary>{owner ? "Buyer requests & deal status" : "Requests & deal status"}</summary><ListingDealPanel key={`${listing.id}:${userId}`} listing={listing} userId={userId} hideMakeOffer /></details>}
      {!previewMode && related.length > 0 && <section className={styles.section} aria-label="More from this seller"><div className={styles.sectionHeading}><h2>More from this seller</h2><Link href={`/sellers/${listing.sellerId}`} className={styles.textLink}>View seller <ArrowRight size={14} /></Link></div><div className={styles.related}>{related.slice(0, 4).map(item => <ListingCard key={item.id} listing={item} variant="discovery" />)}</div></section>}
      {!previewMode && ["active", "sold", "ended"].includes(listing.status) && <div id="similar-items" className={styles.similar}><SimilarListings listing={listing} discovery /></div>}
    </div>
    {menu && <ActionSheet title="Listing options" onClose={() => setMenu(false)}><div className={styles.menu}><button type="button" className="button-secondary min-h-11" onClick={() => void copyLink()}><Copy size={17} />Copy link</button>{copyMessage && <p role="status">{copyMessage}</p>}{!owner && <><ReportAction targetType="listing" targetId={listing.id} label="Report listing" /><ReportAction targetType="user" targetId={listing.sellerId} label="Report seller" /></>}</div></ActionSheet>}
  </DetailRoot>;
}

function ProductGallery({ listing, badge }: { listing: Listing; badge?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const total = listing.imageUrls.length;
  const selected = Math.min(index, Math.max(0, total - 1));
  return <section className={styles.gallery} aria-label="Product images"><div className={styles.mainImage}>{badge}{total ? <Image src={listing.imageUrls[selected]} alt={`${listing.title} — image ${selected + 1}`} fill priority sizes="(min-width: 1024px) 58vw, 100vw" className="object-contain" /> : <div className={styles.noImage}><ImageIcon size={36} /><p>No product image available</p></div>}{total > 1 && <><button type="button" className={`${styles.galleryArrow} ${styles.previous}`} aria-label="Previous product image" onClick={() => setIndex((selected - 1 + total) % total)}><ChevronLeft size={19} /></button><button type="button" className={`${styles.galleryArrow} ${styles.next}`} aria-label="Next product image" onClick={() => setIndex((selected + 1) % total)}><ChevronRight size={19} /></button><span className={styles.counter} aria-live="polite">{selected + 1} / {total}</span></>}</div>{total > 1 && <div className={styles.thumbnails} aria-label="Choose product image">{listing.imageUrls.map((url, i) => <button key={`${url}:${i}`} type="button" aria-label={`Show product image ${i + 1}`} aria-pressed={selected === i} onClick={() => setIndex(i)}><Image src={url} alt="" fill sizes="64px" className="object-contain" /></button>)}</div>}</section>;
}

function ProductActionBar({ listing, userId }: { listing: Listing; userId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const owner = userId === listing.sellerId;
  async function open(offer: boolean) {
    if (pending.current || owner || listing.status !== "active") return;
    if (!userId) { router.push(`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`); return; }
    pending.current = true; setBusy(true); setError("");
    try { const id = await openListingConversation(listing.id); router.push(`/messages/${id}${offer ? "?offer=1" : ""}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the listing conversation."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className={styles.actionBar} aria-label="Listing actions">{error && <p role="alert" className={styles.actionError}>{error}</p>}<div className={styles.actionButtons}>{owner ? <>{["draft", "active"].includes(listing.status) && <Link href={`/listings/${listing.id}/edit`} className="button-primary">Edit listing</Link>}<Link href="/profile/listings" className="button-secondary">My listings</Link></> : listing.status === "active" ? <><button disabled={busy} type="button" onClick={() => void open(false)} className="button-secondary"><MessageCircle size={18} />{busy ? "Opening…" : "Chat"}</button><button disabled={busy} type="button" onClick={() => void open(true)} className="button-primary"><Tag size={17} aria-hidden="true" />Make Offer</button></> : <><span className={styles.unavailable}>{statusLabels[listing.status]}</span><a href="#similar-items" className="button-secondary">View similar items</a></>}</div>{owner && listing.status === "active" && <Link href={`/listings/${listing.id}/promote`} className={styles.promotion}><Sparkles size={14} />Promotion options</Link>}</div>;
}

function ProductSeller({ uid, previewMode = false }: { uid: string; previewMode?: boolean }) {
  const [state, setState] = useState<{ seller: PublicSellerSummary | null; loaded: boolean }>({ seller: null, loaded: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; getPublicSellerSummary(uid).then(seller => { if (active) setState({ seller, loaded: true }); }); return () => { active = false; }; }, [uid, retry]);
  if (!state.loaded) return <div className={styles.sellerSkeleton} role="status" aria-label="Loading seller" />;
  if (!state.seller) return <div className={styles.sellerCard}><p>Seller details are temporarily unavailable.</p><Link href={`/sellers/${uid}`} tabIndex={previewMode ? -1 : undefined} onClick={previewMode ? event => event.preventDefault() : undefined} className={styles.textLink}>View seller profile</Link><button type="button" className="button-secondary min-h-11 px-4" onClick={() => { clearPublicSellerSummaryCache(); setState({ seller: null, loaded: false }); setRetry(value => value + 1); }}>Retry seller</button></div>;
  const seller = state.seller;
  return <section className={styles.sellerCard} aria-label="Seller"><div className={styles.sellerIdentity}><Link href={`/sellers/${uid}`} tabIndex={previewMode ? -1 : undefined} onClick={previewMode ? event => event.preventDefault() : undefined} aria-label={`View ${seller.displayName}'s public seller profile`}><ProfileAvatar photo={seller.photoURL} size={44} /></Link><div><Link href={`/sellers/${uid}`} tabIndex={previewMode ? -1 : undefined} onClick={previewMode ? event => event.preventDefault() : undefined} className={styles.sellerName}><strong>{seller.displayName}</strong><VerifiedLabel seller verified={seller.verificationStatus === "verified"} /><span className={styles.sellerRating}><Star size={12} aria-hidden="true" />{seller.sellerRating == null ? "No seller reviews yet" : `${seller.sellerRating.toFixed(1)} · ${seller.sellerReviewCount} seller review${seller.sellerReviewCount === 1 ? "" : "s"}`}</span></Link></div><Link href={`/sellers/${uid}`} tabIndex={previewMode ? -1 : undefined} onClick={previewMode ? event => event.preventDefault() : undefined} className="icon-button" aria-label="View seller profile"><ChevronRight size={19} /></Link></div><div className={styles.sellerBottom}><span>{seller.memberSince ? <><CalendarDays size={12} />Joined {new Date(seller.memberSince).toLocaleDateString("en-MY", { month: "short", year: "numeric" })}</> : "Public seller profile"}</span>{!previewMode && <FollowSellerButton sellerId={uid} />}</div></section>;
}

function ProductReviews({ uid }: { uid: string }) {
  const [state, setState] = useState<{ loading: boolean; reviews: PublicReview[]; seller: PublicSellerSummary | null; error: boolean }>({ loading: true, reviews: [], seller: null, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; Promise.all([getPublicReviews(uid, true), getPublicSellerSummary(uid)]).then(([reviews, seller]) => { if (active) setState({ loading: false, reviews: reviews.filter(review => review.reviewerRole === "buyer").slice(0, 2), seller, error: false }); }).catch(() => { if (active) setState({ loading: false, reviews: [], seller: null, error: true }); }); return () => { active = false; }; }, [uid, retry]);
  return <section className={styles.section} aria-label="Seller reviews"><div className={styles.sectionHeading}><h2>Seller reviews</h2><Link href={`/sellers/${uid}`} className={styles.textLink}>View seller <ArrowRight size={14} /></Link></div>{state.loading ? <p className={styles.muted} role="status">Loading published reviews…</p> : state.error ? <><p className={styles.muted}>Seller reviews could not be loaded.</p><button type="button" className="button-secondary min-h-11 px-4 mt-3" onClick={() => setRetry(value => value + 1)}>Retry reviews</button></> : <>{state.seller?.sellerRating != null && <p className={styles.reviewSummary}><Star size={17} aria-hidden="true" /><strong>{state.seller.sellerRating.toFixed(1)}</strong> · {state.seller.sellerReviewCount} published seller review{state.seller.sellerReviewCount === 1 ? "" : "s"}</p>}{state.reviews.length ? state.reviews.map(review => <article key={review.id} className={styles.review}><div><strong>Buyer review</strong><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("en-MY")}</time></div><p className={styles.reviewStars} aria-label={`${review.rating} out of 5`}>{"★".repeat(review.rating)}</p>{review.comment && <p>{review.comment}</p>}{review.tags.length > 0 && <p className={styles.muted}>{review.tags.join(" · ")}</p>}</article>) : <p className={styles.muted}>No published seller reviews yet. Reviews come from completed sales, not ratings of this product.</p>}</>}</section>;
}
