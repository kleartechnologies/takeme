import { marketplaceCall as onCall, resolutionCall, runGuardedTransaction, accountIsActive, visibleParticipantId } from "./account-lifecycle";
import { monthsAfter } from "./account-deletion-retention";
import { createHash } from "node:crypto";
import { getFirestore, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { BUYER_TO_SELLER_TAGS, OFFER_WINDOW_DAYS, REVIEW_WINDOW_DAYS, SELLER_TO_BUYER_TAGS, TIER_THRESHOLDS, nextRatingSummary, ringgitToSen, tierFor, validSen, validTags, type PaymentMethod } from "./transaction-domain";
import { standardPaymentFields } from "./protected-transaction-domain";
import { openProtectedDispute, protectedTransactionDetail } from "./protected-transactions";

const db = getFirestore();
const id = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", `${label} is invalid.`);
  return value;
};
const uid = (value: string | undefined) => {
  if (!value) throw new HttpsError("unauthenticated", "Sign in to manage a transaction.");
  return value;
};
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
const method = (value: unknown): PaymentMethod => {
  if (!["cod", "bank_transfer", "external", "other"].includes(String(value))) throw new HttpsError("invalid-argument", "Choose an agreed payment method.");
  return value as PaymentMethod;
};
const participant = (data: DocumentData, userId: string) => data.buyerId === userId || data.sellerId === userId;
const offerRef = (offerId: string) => db.collection("offers").doc(offerId);
const dealRef = (transactionId: string) => db.collection("transactions").doc(transactionId);
const lockRef = (listingId: string) => db.collection("listingDeals").doc(listingId);
const offerLockRef = (listingId: string, buyerId: string) => db.collection("offerLocks").doc(`${listingId}_${buyerId}`);
const summaryRef = (userId: string) => db.collection("trustSummaries").doc(userId);
const publicReviewId = (transactionId: string, reviewerId: string) => createHash("sha256").update(`${transactionId}|${reviewerId}`).digest("hex");

export const getReputationPolicy = resolutionCall(async () => ({ thresholds: TIER_THRESHOLDS, reviewWindowDays: REVIEW_WINDOW_DAYS,
  buyerToSellerTags: BUYER_TO_SELLER_TAGS, sellerToBuyerTags: SELLER_TO_BUYER_TAGS }));

function publicDeal(documentId: string, data: DocumentData) {
  return { id: documentId, listingId: data.listingId, listingTitle: data.listingTitle, buyerId: visibleParticipantId(data.buyerId), sellerId: visibleParticipantId(data.sellerId),
    type: data.type, sourceId: data.sourceId, status: data.status, amountSen: data.amountSen, currency: data.currency, paymentMethod: data.paymentMethod,
    settlementMode: data.settlementMode === "protected" ? "protected" : "standard", paymentProvider: data.paymentProvider ?? "none",
    buyerConfirmedAt: iso(data.buyerConfirmedAt), sellerConfirmedAt: iso(data.sellerConfirmedAt), createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt),
    completedAt: iso(data.completedAt), cancelledAt: iso(data.cancelledAt), reviewWindowEndAt: iso(data.reviewWindowEndAt), reviewsVisibleAt: iso(data.reviewsVisibleAt),
    cancellationRequestedBy: data.cancellationRequestedBy ? visibleParticipantId(data.cancellationRequestedBy) : null, cancellationReason: data.cancellationReason ?? null, disputeReason: data.disputeReason ?? null };
}
function publicOffer(documentId: string, data: DocumentData) {
  return { id: documentId, listingId: data.listingId, buyerId: data.buyerId, sellerId: data.sellerId, type: data.type,
    status: data.status, proposedAmountSen: data.proposedAmountSen, quotedAmountSen: data.quotedAmountSen,
    paymentMethod: data.paymentMethod, createdAt: iso(data.createdAt), expiresAt: iso(data.expiresAt), updatedAt: iso(data.updatedAt), transactionId: data.transactionId ?? null };
}
function requireLiveBuyNow(data: DocumentData | undefined, sellerId?: string) {
  if (!data || data.status !== "active" || data.listingType !== "buy_now" || (sellerId && data.sellerId !== sellerId)) throw new HttpsError("failed-precondition", "This fixed-price listing is no longer available.");
}

/** A request is an offer, never a transaction or payment. */
export const submitOffer = onCall(async (request) => {
  const buyerId = uid(request.auth?.uid);
  const listingId = id(request.data?.listingId, "Listing");
  const type = request.data?.type;
  if (type !== "buy_now" && type !== "offer") throw new HttpsError("invalid-argument", "Choose Buy Now request or offer.");
  const paymentMethod = method(request.data?.paymentMethod);
  const listingRef = db.collection("listings").doc(listingId);
  const previousRef = offerLockRef(listingId, buyerId);
  const newRef = db.collection("offers").doc();
  const timestamp = Timestamp.now();
  await runGuardedTransaction(db, async (tx) => {
    const [listing, previousLock, dealLock] = await Promise.all([tx.get(listingRef), tx.get(previousRef), tx.get(lockRef(listingId))]);
    const data = listing.data();
    requireLiveBuyNow(data);
    if (!(await accountIsActive(data!.sellerId, tx))) throw new HttpsError("failed-precondition", "This seller is unavailable.");
    if (data!.sellerId === buyerId) throw new HttpsError("permission-denied", "You cannot make an offer on your own listing.");
    if (dealLock.exists && dealLock.data()?.status === "in_progress") throw new HttpsError("failed-precondition", "This listing already has an agreed transaction.");
    if (previousLock.exists && ["submitted", "countered"].includes(String(previousLock.data()?.status)) && previousLock.data()?.expiresAt instanceof Timestamp && previousLock.data()!.expiresAt.toMillis() > timestamp.toMillis()) throw new HttpsError("already-exists", "You already have an open request for this listing.");
    const fixedAmount = ringgitToSen(data!.price);
    if (fixedAmount === null) throw new HttpsError("failed-precondition", "The listing price is invalid.");
    const amountSen = type === "buy_now" ? fixedAmount : request.data?.amountSen;
    if (!validSen(amountSen) || (type === "offer" && amountSen > fixedAmount)) throw new HttpsError("invalid-argument", "Offer amount must be positive integer sen and no higher than the listed price.");
    const expiresAt = Timestamp.fromMillis(timestamp.toMillis() + OFFER_WINDOW_DAYS * 86_400_000);
    tx.create(newRef, { listingId, buyerId, sellerId: data!.sellerId, type, status: "submitted", proposedAmountSen: amountSen, quotedAmountSen: amountSen, currency: "MYR", paymentMethod,
      createdAt: timestamp, updatedAt: timestamp, expiresAt, transactionId: null });
    tx.set(previousRef, { offerId: newRef.id, status: "submitted", expiresAt, updatedAt: timestamp });
  });
  return { offerId: newRef.id, status: "submitted" };
});

/** Seller accepts/rejects/counters; buyer accepts a counter or withdraws. */
export const respondToOffer = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const offerId = id(request.data?.offerId, "Offer");
  const action = request.data?.action;
  if (!["accept", "reject", "counter", "withdraw"].includes(action)) throw new HttpsError("invalid-argument", "Invalid offer action.");
  const ref = offerRef(offerId);
  return runGuardedTransaction(db, async (tx) => {
    const offer = await tx.get(ref);
    if (!offer.exists) throw new HttpsError("not-found", "Offer not found.");
    const data = offer.data()!;
    const now = Timestamp.now();
    if (data.status === "accepted" && action === "accept" && data.transactionId && participant(data, userId)) return { status: "accepted", transactionId: data.transactionId };
    if (!["submitted", "countered"].includes(data.status) || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= now.toMillis()) throw new HttpsError("failed-precondition", "This offer is no longer open.");
    const sellerAction = (action === "accept" && data.status === "submitted") || action === "reject" || action === "counter";
    if (sellerAction ? data.sellerId !== userId : data.buyerId !== userId) throw new HttpsError("permission-denied", "Only the correct party can respond to this offer.");
    if (action === "counter" && (data.type !== "offer" || data.status !== "submitted" || !validSen(request.data?.amountSen))) throw new HttpsError("invalid-argument", "Counter with a valid amount for an open offer.");
    if (!(await accountIsActive(data.buyerId, tx)) || !(await accountIsActive(data.sellerId, tx))) throw new HttpsError("failed-precondition", "A participant is unavailable.");
    const listingRef = db.collection("listings").doc(data.listingId);
    const dealLockRef = lockRef(data.listingId);
    const txRef = dealRef(`offer-${offerId}`);
    const [listing, dealLock, existingDeal] = action === "accept" ? await Promise.all([tx.get(listingRef), tx.get(dealLockRef), tx.get(txRef)]) :
      action === "counter" ? [await tx.get(listingRef), null, null] : [null, null, null];
    if (action === "accept") {
      requireLiveBuyNow(listing?.data(), data.sellerId);
      if (dealLock?.exists && dealLock.data()?.status === "in_progress") throw new HttpsError("failed-precondition", "This listing already has an agreed transaction.");
      if (existingDeal?.exists) throw new HttpsError("already-exists", "This offer already has a transaction.");
      if (!validSen(data.quotedAmountSen)) throw new HttpsError("failed-precondition", "The agreed amount is invalid.");
      tx.create(txRef, { listingId: data.listingId, listingTitle: listing!.data()!.title, categoryId: listing!.data()!.categoryId,
        buyerId: data.buyerId, sellerId: data.sellerId, type: data.type, sourceId: offerId, status: "in_progress", amountSen: data.quotedAmountSen, currency: "MYR", paymentMethod: data.paymentMethod,
        ...standardPaymentFields(),
        buyerConfirmedAt: null, sellerConfirmedAt: null, cancellationRequestedBy: null, cancellationReason: null, disputeReason: null,
        reviewCount: 0, reviewsVisibleAt: null, reviewWindowEndAt: null, createdAt: now, updatedAt: now, completedAt: null, cancelledAt: null });
      tx.set(dealLockRef, { transactionId: txRef.id, status: "in_progress", updatedAt: now });
      tx.update(listingRef, { status: "ended", updatedAt: now });
      tx.update(ref, { status: "accepted", transactionId: txRef.id, updatedAt: now });
      tx.set(offerLockRef(data.listingId, data.buyerId), { offerId, status: "accepted", expiresAt: data.expiresAt, updatedAt: now });
      return { status: "accepted", transactionId: txRef.id };
    }
    if (action === "counter") {
      requireLiveBuyNow(listing?.data(), data.sellerId);
      const ceiling = ringgitToSen(listing!.data()!.price);
      if (ceiling === null || request.data.amountSen > ceiling) throw new HttpsError("invalid-argument", "Counter amount cannot exceed the listed price.");
      tx.update(ref, { status: "countered", quotedAmountSen: request.data.amountSen, updatedAt: now });
      tx.set(offerLockRef(data.listingId, data.buyerId), { offerId, status: "countered", expiresAt: data.expiresAt, updatedAt: now });
      return { status: "countered" };
    }
    const status = action === "reject" ? "rejected" : "withdrawn";
    tx.update(ref, { status, updatedAt: now });
    tx.set(offerLockRef(data.listingId, data.buyerId), { offerId, status, expiresAt: data.expiresAt, updatedAt: now });
    return { status };
  });
});

export const expireOffers = onSchedule({ schedule: "every 60 minutes", timeZone: "UTC" }, async () => {
  const now = Timestamp.now();
  const page = await db.collection("offers").where("status", "in", ["submitted", "countered"])
    .where("expiresAt", "<=", now).orderBy("expiresAt", "asc").limit(100).get();
  for (const item of page.docs) {
    await runGuardedTransaction(db, async (tx) => {
      const offer = await tx.get(item.ref);
      const data = offer.data();
      if (!data || !["submitted", "countered"].includes(data.status) || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() > now.toMillis()) return;
      const lock = offerLockRef(data.listingId, data.buyerId);
      const lockDoc = await tx.get(lock);
      tx.update(item.ref, { status: "expired", updatedAt: now });
      if (lockDoc.data()?.offerId === item.id) tx.set(lock, { offerId: item.id, status: "expired", expiresAt: data.expiresAt, updatedAt: now });
    });
  }
});

/** Auction finalization is already authoritative; this listener only materializes the won deal. */
export const onAuctionWonCreateTransaction = onDocumentUpdated("listings/{listingId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.auctionStatus === "ended" || after.auctionStatus !== "ended" || after.status !== "ended"
    || !["auction", "buy_now_and_auction"].includes(after.listingType) || typeof after.winnerId !== "string" || !validSen(after.finalBid) || after.winnerId === after.sellerId) return;
  const listingId = event.params.listingId;
  const ref = dealRef(`auction-${listingId}`);
  const lock = lockRef(listingId);
  await runGuardedTransaction(db, async (tx) => {
    const [existing, currentLock, listing] = await Promise.all([tx.get(ref), tx.get(lock), tx.get(db.collection("listings").doc(listingId))]);
    if (existing.exists) return;
    const data = listing.data();
    if (!data || data.auctionStatus !== "ended" || data.status !== "ended" || data.winnerId !== after.winnerId || data.finalBid !== after.finalBid) return;
    if (currentLock.exists && currentLock.data()?.status === "in_progress") return;
    const now = Timestamp.now();
    tx.create(ref, { listingId, listingTitle: data.title, categoryId: data.categoryId, buyerId: data.winnerId, sellerId: data.sellerId,
      type: "auction", sourceId: listingId, status: "in_progress", amountSen: data.finalBid, currency: "MYR", paymentMethod: "other",
      ...standardPaymentFields(),
      buyerConfirmedAt: null, sellerConfirmedAt: null, cancellationRequestedBy: null, cancellationReason: null, disputeReason: null,
      reviewCount: 0, reviewsVisibleAt: null, reviewWindowEndAt: null, createdAt: now, updatedAt: now, completedAt: null, cancelledAt: null });
    tx.set(lock, { transactionId: ref.id, status: "in_progress", updatedAt: now });
  });
});

/** Two independent confirmations atomically grant completion credit exactly once. */
export const confirmTransactionCompletion = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const ref = dealRef(transactionId);
  return runGuardedTransaction(db, async (tx) => {
    const deal = await tx.get(ref);
    if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    const data = deal.data()!;
    if (data.status === "completed") return { status: "completed", alreadyConfirmed: true };
    if (data.status !== "in_progress") throw new HttpsError("failed-precondition", "A cancelled or disputed transaction cannot be completed here.");
    if (data.settlementMode === "protected") throw new HttpsError("failed-precondition", "Protected transactions require provider-confirmed payment and payout settlement before completion.");
    if (data.cancellationRequestedBy) throw new HttpsError("failed-precondition", "Resolve the pending cancellation request before completing this transaction.");
    const buyer = data.buyerId === userId;
    const ownField = buyer ? "buyerConfirmedAt" : "sellerConfirmedAt";
    const otherField = buyer ? "sellerConfirmedAt" : "buyerConfirmedAt";
    if (data[ownField] instanceof Timestamp) return { status: "in_progress", alreadyConfirmed: true };
    const now = Timestamp.now();
    if (!(data[otherField] instanceof Timestamp)) {
      tx.update(ref, { [ownField]: now, updatedAt: now });
      return { status: "in_progress", alreadyConfirmed: false };
    }
    const buyerRef = summaryRef(data.buyerId);
    const sellerRef = summaryRef(data.sellerId);
    const listingRef = db.collection("listings").doc(data.listingId);
    const eventRef = db.collection("marketplaceEvents").doc(`transaction-completed-${transactionId}`);
    const [buyerSummary, sellerSummary, listing, event] = await Promise.all([tx.get(buyerRef), tx.get(sellerRef), tx.get(listingRef), tx.get(eventRef)]);
    if (!validSen(data.amountSen) || data.buyerId === data.sellerId || event.exists) throw new HttpsError("failed-precondition", "Transaction completion data is invalid.");
    const buyerActive = await accountIsActive(data.buyerId, tx);
    const sellerActive = await accountIsActive(data.sellerId, tx);
    const buyerPrevious = Number(buyerSummary.data()?.buyer?.completedCount ?? 0);
    const sellerPrevious = Number(sellerSummary.data()?.seller?.completedCount ?? 0);
    tx.update(ref, { [ownField]: now, status: "completed", completedAt: now, reviewWindowEndAt: Timestamp.fromMillis(now.toMillis() + REVIEW_WINDOW_DAYS * 86_400_000), updatedAt: now });
    if (buyerActive) tx.set(buyerRef, { userId: data.buyerId, buyer: { ...(buyerSummary.data()?.buyer ?? {}), completedCount: buyerPrevious + 1, tier: tierFor(buyerPrevious + 1) }, updatedAt: now }, { merge: true });
    if (sellerActive) tx.set(sellerRef, { userId: data.sellerId, seller: { ...(sellerSummary.data()?.seller ?? {}), completedCount: sellerPrevious + 1, tier: tierFor(sellerPrevious + 1) }, updatedAt: now }, { merge: true });
    if (data.type !== "auction" && listing.exists && listing.data()?.status === "ended") tx.update(listingRef, { status: "sold", updatedAt: now });
    if (buyerActive) tx.create(eventRef, { userId: data.buyerId, eventType: "TRANSACTION_COMPLETED", source: "transaction", transactionId,
      listingId: data.listingId, categoryId: data.categoryId, sellerId: data.sellerId, amountSen: data.amountSen, currency: "MYR", transactionType: data.type,
      createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 90 * 86_400_000) });
    return { status: "completed", alreadyConfirmed: false };
  });
});

export const requestTransactionCancellation = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim().slice(0, 500) : "";
  if (!reason) throw new HttpsError("invalid-argument", "Give a brief cancellation reason.");
  const ref = dealRef(transactionId);
  return runGuardedTransaction(db, async (tx) => {
    const deal = await tx.get(ref);
    if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    const data = deal.data()!;
    if (data.status !== "in_progress") throw new HttpsError("failed-precondition", "Only an in-progress transaction can be cancelled.");
    if (data.settlementMode === "protected") throw new HttpsError("failed-precondition", "Protected transactions must use the dispute and provider refund workflow.");
    if (data.cancellationRequestedBy && data.cancellationRequestedBy !== userId) {
      const lock = lockRef(data.listingId);
      const listing = db.collection("listings").doc(data.listingId);
      const [lockDoc, listingDoc] = await Promise.all([tx.get(lock), tx.get(listing)]);
      const now = Timestamp.now();
      tx.update(ref, { status: "cancelled", cancelledAt: now, updatedAt: now });
      if (lockDoc.data()?.transactionId === transactionId) tx.set(lock, { transactionId, status: "cancelled", updatedAt: now });
      if (data.type !== "auction" && listingDoc.exists && listingDoc.data()?.status === "ended") tx.update(listing, { status: "active", updatedAt: now });
      return { status: "cancelled" };
    }
    if (!data.cancellationRequestedBy) tx.update(ref, { cancellationRequestedBy: userId, cancellationReason: reason, updatedAt: Timestamp.now() });
    return { status: "in_progress", cancellationRequested: true };
  });
});

export const declineTransactionCancellation = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const ref = dealRef(transactionId);
  return runGuardedTransaction(db, async (tx) => {
    const deal = await tx.get(ref);
    if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    const data = deal.data()!;
    if (data.status !== "in_progress" || !data.cancellationRequestedBy || data.cancellationRequestedBy === userId) throw new HttpsError("failed-precondition", "There is no other-party cancellation to decline.");
    tx.update(ref, { cancellationRequestedBy: null, cancellationReason: null, updatedAt: Timestamp.now() });
    return { status: "in_progress" };
  });
});

export const disputeTransaction = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim().slice(0, 1000) : "";
  if (!reason) throw new HttpsError("invalid-argument", "Give a brief dispute reason.");
  const ref = dealRef(transactionId);
  return runGuardedTransaction(db, async (tx) => {
    const deal = await tx.get(ref);
    if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    const data = deal.data()!;
    if (data.settlementMode === "protected" && data.status === "disputed") {
      const existing = await tx.get(db.collection("transactionDisputes").doc(transactionId));
      if (existing.exists && existing.data()?.openedBy === userId && existing.data()?.description === reason) return { status: "disputed", alreadyOpened: true };
    }
    if (data.status !== "in_progress") throw new HttpsError("failed-precondition", "Only an in-progress transaction can be disputed.");
    const now = Timestamp.now();
    if (data.settlementMode === "protected") {
      if (data.buyerId !== userId) throw new HttpsError("permission-denied", "Only the buyer can open a protected transaction dispute.");
      const payment = await tx.get(db.collection("protectedPayments").doc(transactionId));
      if (!payment.exists || !["authorized", "protected"].includes(String(payment.data()?.status))) throw new HttpsError("failed-precondition", "This protected payment is not eligible for a dispute.");
      openProtectedDispute(tx, transactionId, data, userId, reason, now);
    }
    tx.update(ref, { status: "disputed", disputeOpenedBy: userId, disputeReason: reason, disputedAt: now, updatedAt: now });
    tx.set(lockRef(data.listingId), { transactionId, status: "disputed", updatedAt: now });
    return { status: "disputed", alreadyOpened: false };
  });
});

export const getListingDealState = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const listingId = id(request.data?.listingId, "Listing");
  const listing = await db.collection("listings").doc(listingId).get();
  if (!listing.exists) throw new HttpsError("not-found", "Listing not found.");
  const seller = listing.data()?.sellerId === userId;
  const ownOfferLock = await offerLockRef(listingId, userId).get();
  const offerIds = seller ? (await db.collection("offers").where("listingId", "==", listingId).orderBy("createdAt", "desc").limit(20).get()).docs : [];
  const ownOffer = !seller && typeof ownOfferLock.data()?.offerId === "string" ? await offerRef(ownOfferLock.data()!.offerId).get() : null;
  const dealLock = await lockRef(listingId).get();
  const activeDeal = typeof dealLock.data()?.transactionId === "string" ? await dealRef(dealLock.data()!.transactionId).get() : null;
  return {
    offers: seller ? offerIds.filter((item) => item.data().sellerId === userId).map((item) => publicOffer(item.id, item.data())) : ownOffer?.exists && ownOffer.data()?.buyerId === userId ? [publicOffer(ownOffer.id, ownOffer.data()!)] : [],
    transaction: activeDeal?.exists && participant(activeDeal.data()!, userId) ? publicDeal(activeDeal.id, activeDeal.data()!) : null,
  };
});

export const getMyTransactions = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const [buying, selling] = await Promise.all([
    db.collection("transactions").where("buyerId", "==", userId).orderBy("createdAt", "desc").limit(20).get(),
    db.collection("transactions").where("sellerId", "==", userId).orderBy("createdAt", "desc").limit(20).get(),
  ]);
  const unique = new Map([...buying.docs, ...selling.docs].map((item) => [item.id, publicDeal(item.id, item.data())]));
  return { transactions: [...unique.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 20) };
});

export const getTransactionDetail = resolutionCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const deal = await dealRef(transactionId).get();
  if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
  const ownReview = await deal.ref.collection("reviews").doc(userId).get();
  const protectedDetail = deal.data()!.settlementMode === "protected" ? await protectedTransactionDetail(transactionId) : { payment: null, payout: null, refunds: [], dispute: null, timeline: [] };
  return { transaction: publicDeal(deal.id, deal.data()!), reviewed: ownReview.exists, ...protectedDetail };
});

function applyVisibleReview(tx: Transaction, reviewId: string, data: DocumentData, summary: DocumentData | undefined, now: Timestamp) {
  const role = data.reviewerRole === "buyer" ? "seller" : "buyer";
  const ref = summaryRef(data.reviewedUserId);
  tx.set(ref, { userId: data.reviewedUserId, [role]: { ...(summary?.[role] ?? {}), ...nextRatingSummary(summary?.[role], data.rating) }, updatedAt: now }, { merge: true });
  tx.create(db.collection("publicReviews").doc(reviewId), { reviewedUserId: data.reviewedUserId, reviewerRole: data.reviewerRole,
    rating: data.rating, tags: data.tags, comment: data.deletedReviewer ? "" : data.comment, createdAt: data.createdAt, publishedAt: now, ...(data.deletedReviewer ? { deletedReviewer: true, retentionExpiresAt: data.retentionExpiresAt ?? monthsAfter(now, 12), retentionPurpose: "Authentic review of surviving member" } : {}) });
}

/** Immutable private submissions; only the double-blind release writes public reviews/ratings. */
export const submitTransactionReview = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId, "Transaction");
  const rating = request.data?.rating;
  const comment = typeof request.data?.comment === "string" ? request.data.comment.trim() : null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment === null || comment.length > 1000) throw new HttpsError("invalid-argument", "Choose 1–5 stars and at most 1,000 comment characters.");
  const ref = dealRef(transactionId);
  const reviewRef = ref.collection("reviews").doc(userId);
  return runGuardedTransaction(db, async (tx) => {
    const [deal, existing] = await Promise.all([tx.get(ref), tx.get(reviewRef)]);
    if (!deal.exists || !participant(deal.data()!, userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    const data = deal.data()!;
    const now = Timestamp.now();
    if (data.status !== "completed" || !(data.reviewWindowEndAt instanceof Timestamp) || data.reviewWindowEndAt.toMillis() <= now.toMillis()) throw new HttpsError("failed-precondition", "The review window is closed or transaction is not completed.");
    if (existing.exists) throw new HttpsError("already-exists", "You already reviewed this transaction.");
    const reviewerRole = data.buyerId === userId ? "buyer" : "seller";
    if (!validTags(request.data?.tags ?? [], reviewerRole)) throw new HttpsError("invalid-argument", "Choose up to four appropriate review tags.");
    const oppositeUid = reviewerRole === "buyer" ? data.sellerId : data.buyerId;
    if (oppositeUid === userId) throw new HttpsError("failed-precondition", "Self-reviews are not allowed.");
    const otherReview = await tx.get(ref.collection("reviews").doc(oppositeUid));
    const first = Number(data.reviewCount ?? 0) === 0;
    const release = otherReview.exists;
    const ownData = { transactionId, buyerId: data.buyerId, sellerId: data.sellerId, reviewerId: userId, reviewedUserId: oppositeUid,
      reviewerRole, rating, tags: request.data?.tags ?? [], comment, createdAt: now };
    const ownSummary = release ? await tx.get(summaryRef(oppositeUid)) : null;
    const otherSummary = release ? await tx.get(summaryRef(userId)) : null;
    const ownSubjectActive = release && await accountIsActive(oppositeUid, tx);
    const otherSubjectActive = release && await accountIsActive(userId, tx);
    tx.create(reviewRef, ownData);
    tx.create(db.collection("marketplaceEvents").doc(`review-submitted-${transactionId}-${userId}`), {
      userId, eventType: "REVIEW_SUBMITTED", source: "transaction", transactionId, listingId: data.listingId,
      sellerId: data.sellerId, reviewerRole, createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 90 * 86_400_000),
    });
    tx.update(ref, { reviewCount: first ? 1 : 2, ...(release ? { reviewsVisibleAt: now } : {}), updatedAt: now });
    if (release) {
      if (ownSubjectActive) applyVisibleReview(tx, publicReviewId(transactionId, userId), ownData, ownSummary?.data(), now);
      if (otherSubjectActive) applyVisibleReview(tx, otherReview.data()!.publishedReviewId ?? publicReviewId(transactionId, oppositeUid), otherReview.data()!, otherSummary?.data(), now);
    }
    return { submitted: true, visible: release };
  });
});

export const releaseExpiredReviews = onSchedule({ schedule: "every 60 minutes", timeZone: "UTC" }, async () => {
  const now = Timestamp.now();
  const page = await db.collection("transactions").where("status", "==", "completed").where("reviewsVisibleAt", "==", null)
    .where("reviewWindowEndAt", "<=", now).orderBy("reviewWindowEndAt", "asc").limit(100).get();
  for (const item of page.docs) {
    await runGuardedTransaction(db, async (tx) => {
      const deal = await tx.get(item.ref);
      const data = deal.data();
      if (!data || data.status !== "completed" || data.reviewsVisibleAt || !(data.reviewWindowEndAt instanceof Timestamp) || data.reviewWindowEndAt.toMillis() > now.toMillis()) return;
      const buyerReview = await tx.get(item.ref.collection("reviews").doc(data.buyerId));
      const sellerReview = await tx.get(item.ref.collection("reviews").doc(data.sellerId));
      const buyerSummary = buyerReview.exists ? await tx.get(summaryRef(data.sellerId)) : null;
      const sellerSummary = sellerReview.exists ? await tx.get(summaryRef(data.buyerId)) : null;
      const buyerSubjectActive = await accountIsActive(data.sellerId, tx);
      const sellerSubjectActive = await accountIsActive(data.buyerId, tx);
      tx.update(item.ref, { reviewsVisibleAt: now, updatedAt: now });
      if (buyerReview.exists && buyerSubjectActive) applyVisibleReview(tx, buyerReview.data()!.publishedReviewId ?? publicReviewId(item.id, data.buyerId), buyerReview.data()!, buyerSummary?.data(), now);
      if (sellerReview.exists && sellerSubjectActive) applyVisibleReview(tx, sellerReview.data()!.publishedReviewId ?? publicReviewId(item.id, data.sellerId), sellerReview.data()!, sellerSummary?.data(), now);
    });
  }
});

export const getPublicReviews = onCall(async (request) => {
  const userId = id(request.data?.userId, "User");
  const base = db.collection("publicReviews").where("reviewedUserId", "==", userId);
  const own = request.auth?.uid === userId && request.data?.sellerOnly !== true;
  const page = await base.orderBy("createdAt", "desc").limit(own ? 10 : 30).get();
  const visible = (own ? page.docs : page.docs.filter((item) => item.data().reviewerRole === "buyer")).slice(0, 10);
  return { reviews: visible.map((item) => ({ id: item.id, reviewerRole: item.data().reviewerRole, rating: item.data().rating,
    tags: item.data().tags, comment: item.data().comment, createdAt: iso(item.data().createdAt) })) };
});

export const reportPublicReview = onCall(async (request) => {
  const reporterId = uid(request.auth?.uid);
  const reviewId = id(request.data?.reviewId, "Review");
  const reason = request.data?.reason;
  if (!["false_information", "harassment", "offensive_content", "spam", "personal_information", "unrelated", "other"].includes(reason)) throw new HttpsError("invalid-argument", "Choose a review report reason.");
  const detail = typeof request.data?.details === "string" ? request.data.details.trim().slice(0, 1000) : "";
  const review = await db.collection("publicReviews").doc(reviewId).get();
  if (!review.exists) throw new HttpsError("not-found", "Review not found.");
  if (review.data()?.reviewerRole !== "buyer" && review.data()?.reviewedUserId !== reporterId) throw new HttpsError("permission-denied", "This review is private.");
  const ref = db.collection("reports").doc(`review-${reviewId}-${reporterId}`);
  await runGuardedTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return;
    const now = Timestamp.now();
    tx.create(ref, { id: ref.id, reporterId, targetType: "review", targetId: reviewId, reason, details: detail, status: "submitted", createdAt: now, updatedAt: now });
  });
  return { submitted: true };
});
