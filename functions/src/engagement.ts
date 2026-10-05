import { marketplaceCall as onCall, marketplaceMutationCall, runGuardedTransaction, accountIsActive } from "./account-lifecycle";
import { publicProfileLocation } from "./general-location";
import { randomUUID } from "node:crypto";
import { getFirestore, FieldPath, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { listingCategoryId, matchesSearch, newListingSearchCategories, parseSearch, priceSen, stableId, type SearchCriteria } from "./engagement-domain";

const db = getFirestore();
const PAGE = 40;
const optionalTypes = ["saved_price_drop", "saved_unavailable", "new_matching_listing", "followed_seller_listing", "auction_ending", "outbid", "auction_lost", "message_received"] as const;
type OptionalType = typeof optionalTypes[number];
type NotificationType = OptionalType | "auction_won" | "offer_received" | "offer_accepted" | "counteroffer" | "transaction_update" | "transaction_completed" | "review_available";
type Frequency = "instant" | "daily" | "off";

function requireUid(uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage engagement.");
  return uid;
}
function validId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", `${label} is invalid.`);
  return value;
}
function iso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : null; }
function optional(type: NotificationType): type is OptionalType { return (optionalTypes as readonly string[]).includes(type); }
function notifRef(uid: string, key: string) { return db.collection("users").doc(uid).collection("notifications").doc(stableId(uid, key)); }
function summaryRef(uid: string) { return db.collection("notificationSummaries").doc(uid); }

type Notice = { type: NotificationType; title: string; body: string; href: string; listingId?: string; sellerId?: string; transactionId?: string };
async function emit(uid: string, key: string, notice: Notice) {
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return;
  if (optional(notice.type)) {
    const pref = await db.collection("notificationPreferences").doc(uid).get();
    const frequency = pref.data()?.[notice.type] ?? "instant";
    // Daily delivery is a future channel. Do not mislabel an immediate in-app alert as a digest.
    if (frequency === "off" || frequency === "daily") return;
  }
  const ref = notifRef(uid, key);
  const summary = summaryRef(uid);
  await runGuardedTransaction(db, async (tx) => {
    if (!(await accountIsActive(uid, tx))) return;
    const [existing, current] = await Promise.all([tx.get(ref), tx.get(summary)]);
    if (existing.exists) return;
    const now = Timestamp.now();
    tx.create(ref, { ...Object.fromEntries(Object.entries(notice).filter(([, value]) => value !== undefined)), recipientUserId: uid, dedupeKey: key, createdAt: now, readAt: null, openedAt: null });
    tx.set(summary, { unreadCount: Math.max(0, Number(current.data()?.unreadCount ?? 0)) + 1, updatedAt: now }, { merge: true });
  });
}

export const onMessageEngagementCreated = onDocumentCreated("conversations/{conversationId}/messages/{messageId}", async (event) => {
  const message = event.data?.data();
  if (!message?.senderId) return;
  const conversation = await db.collection("conversations").doc(event.params.conversationId).get();
  const data = conversation.data();
  if (!data || ![data.buyerId, data.sellerId].includes(message.senderId)) return;
  const recipientId = data.buyerId === message.senderId ? data.sellerId : data.buyerId;
  await emit(recipientId, `message:${event.params.conversationId}:${event.params.messageId}`, {
    type: "message_received", title: "New marketplace message", body: `New message about ${String(data.listingTitle ?? "a listing").slice(0, 60)}.`,
    href: `/messages/${event.params.conversationId}`, listingId: data.listingId,
  });
});

export const getUnreadCount = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const doc = await summaryRef(uid).get();
  return { unreadCount: Math.max(0, Number(doc.data()?.unreadCount ?? 0)) };
});

export const getNotifications = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const cursor = request.data?.cursor ? validId(request.data.cursor, "Cursor") : null;
  const base = db.collection("users").doc(uid).collection("notifications");
  const cursorDoc = cursor ? await base.doc(cursor).get() : null;
  if (cursor && !cursorDoc?.exists) throw new HttpsError("invalid-argument", "Cursor has expired.");
  const snapshot = await (cursorDoc ? base.orderBy("createdAt", "desc").startAfter(cursorDoc) : base.orderBy("createdAt", "desc")).limit(21).get();
  const visible = snapshot.docs.slice(0, 20);
  return { items: visible.map((item) => ({ id: item.id, ...item.data(), createdAt: iso(item.data().createdAt), readAt: iso(item.data().readAt), openedAt: iso(item.data().openedAt) })), cursor: visible.at(-1)?.id ?? null, hasMore: snapshot.size > 20 };
});

export const markNotificationRead = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const notificationId = validId(request.data?.notificationId, "Notification");
  const ref = db.collection("users").doc(uid).collection("notifications").doc(notificationId);
  const summary = summaryRef(uid);
  await runGuardedTransaction(db, async (tx) => {
    const [item, count] = await Promise.all([tx.get(ref), tx.get(summary)]);
    if (!item.exists || item.data()?.readAt instanceof Timestamp) return;
    const now = Timestamp.now();
    tx.update(ref, { readAt: now });
    tx.set(summary, { unreadCount: Math.max(0, Number(count.data()?.unreadCount ?? 0) - 1), updatedAt: now }, { merge: true });
  });
  return { read: true };
});

export const openNotification = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const notificationId = validId(request.data?.notificationId, "Notification");
  const ref = db.collection("users").doc(uid).collection("notifications").doc(notificationId);
  const summary = summaryRef(uid);
  return runGuardedTransaction(db, async (tx) => {
    const [item, count] = await Promise.all([tx.get(ref), tx.get(summary)]);
    if (!item.exists) throw new HttpsError("not-found", "Notification not found.");
    const data = item.data()!;
    const now = Timestamp.now();
    const fields: Record<string, Timestamp> = {};
    if (!(data.openedAt instanceof Timestamp)) fields.openedAt = now;
    if (!(data.readAt instanceof Timestamp)) {
      fields.readAt = now;
      tx.set(summary, { unreadCount: Math.max(0, Number(count.data()?.unreadCount ?? 0) - 1), updatedAt: now }, { merge: true });
    }
    if (Object.keys(fields).length) tx.update(ref, fields);
    return { href: data.href as string };
  });
});

export const markAllNotificationsRead = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const ref = db.collection("users").doc(uid).collection("notifications");
  const page = await ref.where("readAt", "==", null).limit(PAGE).get();
  if (page.empty) return { marked: 0, hasMore: false };
  const summary = summaryRef(uid);
  const marked = await runGuardedTransaction(db, async (tx) => {
    const [items, count] = await Promise.all([tx.getAll(...page.docs.map((item) => item.ref)), tx.get(summary)]);
    const unread = items.filter((item) => item.exists && item.data()?.readAt === null);
    const now = Timestamp.now();
    for (const item of unread) tx.update(item.ref, { readAt: now });
    tx.set(summary, { unreadCount: Math.max(0, Number(count.data()?.unreadCount ?? 0) - unread.length), updatedAt: now }, { merge: true });
    return unread.length;
  });
  return { marked, hasMore: page.size === PAGE };
});

export const getNotificationPreferences = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const item = await db.collection("notificationPreferences").doc(uid).get();
  return { preferences: Object.fromEntries(optionalTypes.map((type) => [type, item.data()?.[type] ?? "instant"])) };
});
export const setNotificationPreference = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const type = request.data?.type as OptionalType;
  const frequency = request.data?.frequency as Frequency;
  if (!optionalTypes.includes(type) || !["instant", "off"].includes(frequency)) throw new HttpsError("invalid-argument", "Preference is invalid.");
  await runGuardedTransaction(db, async (tx) => { tx.set(db.collection("notificationPreferences").doc(uid), { [type]: frequency, updatedAt: Timestamp.now() }, { merge: true }); });
  return { type, frequency };
});

const follows = (sellerId: string) => db.collection("sellerFollowers").doc(sellerId).collection("members");
export const getFollowState = onCall(async (request) => {
  const sellerId = validId(request.data?.sellerId, "Seller");
  const uid = request.auth?.uid;
  const [relation, summary] = await Promise.all([uid ? follows(sellerId).doc(uid).get() : Promise.resolve(null), db.collection("sellerFollowSummaries").doc(sellerId).get()]);
  return { following: Boolean(relation?.exists), followerCount: Math.max(0, Number(summary.data()?.followerCount ?? 0)) };
});
export const setSellerFollow = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const sellerId = validId(request.data?.sellerId, "Seller");
  const following = request.data?.following;
  if (typeof following !== "boolean" || uid === sellerId) throw new HttpsError("invalid-argument", "Follow request is invalid.");
  const seller = await db.collection("users").doc(sellerId).get();
  if (!seller.exists) throw new HttpsError("not-found", "Seller not found.");
  const ref = follows(sellerId).doc(uid);
  const mirror = db.collection("users").doc(uid).collection("following").doc(sellerId);
  const summary = db.collection("sellerFollowSummaries").doc(sellerId);
  return runGuardedTransaction(db, async (tx) => {
    if (!(await accountIsActive(sellerId, tx))) throw new HttpsError("failed-precondition", "This seller is unavailable.");
    const [existing, count] = await Promise.all([tx.get(ref), tx.get(summary)]);
    const current = Math.max(0, Number(count.data()?.followerCount ?? 0));
    if (following && !existing.exists) {
      const now = Timestamp.now();
      tx.create(ref, { userId: uid, sellerId, createdAt: now });
      tx.set(mirror, { sellerId, createdAt: now });
      tx.set(summary, { followerCount: current + 1, updatedAt: now });
      return { following: true, followerCount: current + 1 };
    }
    if (!following && existing.exists) {
      tx.delete(ref); tx.delete(mirror);
      tx.set(summary, { followerCount: Math.max(0, current - 1), updatedAt: Timestamp.now() });
      return { following: false, followerCount: Math.max(0, current - 1) };
    }
    return { following, followerCount: current };
  });
});
export const getFollowing = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const cursor = request.data?.cursor ? validId(request.data.cursor, "Cursor") : null;
  const base = db.collection("users").doc(uid).collection("following");
  const cursorDoc = cursor ? await base.doc(cursor).get() : null;
  if (cursor && !cursorDoc?.exists) throw new HttpsError("invalid-argument", "Cursor has expired.");
  const page = await (cursorDoc ? base.orderBy("createdAt", "desc").startAfter(cursorDoc) : base.orderBy("createdAt", "desc")).limit(21).get();
  const visible = page.docs.slice(0, 20);
  const [profiles, trust] = visible.length ? await Promise.all([
    db.getAll(...visible.map((item) => db.collection("users").doc(item.id))),
    db.getAll(...visible.map((item) => db.collection("trustSummaries").doc(item.id))),
  ]) : [[], []];
  return { items: visible.map((item, index) => ({ sellerId: item.id, createdAt: iso(item.data().createdAt), displayName: profiles[index]?.data()?.displayName ?? "Seller", photoURL: profiles[index]?.data()?.photoURL ?? null, location: publicProfileLocation(profiles[index]?.data()?.location), sellerTier: trust[index]?.data()?.seller?.tier ?? null, sellerReviewCount: Number(trust[index]?.data()?.seller?.reviewCount ?? 0), sellerAverageRating: Number(trust[index]?.data()?.seller?.averageRating ?? 0) })), cursor: visible.at(-1)?.id ?? null, hasMore: page.size > 20 };
});

const searches = db.collection("savedSearches");
const searchFingerprint = (uid: string, criteria: SearchCriteria) => db.collection("savedSearchFingerprints").doc(stableId(uid, JSON.stringify(criteria)));
export const saveSearch = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  let criteria: SearchCriteria;
  try { criteria = parseSearch(request.data?.criteria); } catch (error) { throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Search is invalid."); }
  const existingId = request.data?.searchId ? validId(request.data.searchId, "Search") : null;
  const requestedFrequency = request.data?.frequency;
  if (requestedFrequency !== undefined && !["instant", "off"].includes(requestedFrequency)) throw new HttpsError("invalid-argument", "Frequency is invalid.");
  if (request.data?.active !== undefined && typeof request.data.active !== "boolean") throw new HttpsError("invalid-argument", "Active state is invalid.");
  const requestId = existingId ? null : validId(request.data?.requestId, "Request ID");
  const ref = searches.doc(existingId ?? stableId("saved-search", uid, requestId!));
  const fingerprint = searchFingerprint(uid, criteria);
  const quota = db.collection("savedSearchQuotas").doc(uid);
  const searchId = await runGuardedTransaction(db, async (tx) => {
    const [previous, matched, currentQuota] = await Promise.all([tx.get(ref), tx.get(fingerprint), tx.get(quota)]);
    if (previous.exists && previous.data()?.userId !== uid || existingId && !previous.exists) throw new HttpsError("permission-denied", "Search is not yours.");
    if (matched.exists && matched.data()?.userId !== uid) throw new HttpsError("permission-denied", "Search is not yours.");
    if (matched.exists && matched.data()?.searchId !== ref.id) {
      if (existingId) throw new HttpsError("already-exists", "This search is already saved.");
      return matched.data()!.searchId as string;
    }
    const current = Math.max(0, Number(currentQuota.data()?.count ?? 0));
    if (!previous.exists && current >= 10) throw new HttpsError("resource-exhausted", "You can save up to 10 searches.");
    const previousCriteria = previous.data()?.criteria as SearchCriteria | undefined;
    const oldFingerprint = previousCriteria && JSON.stringify(previousCriteria) !== JSON.stringify(criteria) ? searchFingerprint(uid, previousCriteria) : null;
    const oldMatch = oldFingerprint ? await tx.get(oldFingerprint) : null;
    const now = Timestamp.now();
    tx.set(ref, { userId: uid, criteria, categoryKey: criteria.category || "*", frequency: requestedFrequency ?? previous.data()?.frequency ?? "instant", active: request.data?.active ?? previous.data()?.active ?? true, createdAt: previous.data()?.createdAt ?? now, updatedAt: now, lastTriggeredAt: oldFingerprint ? null : previous.data()?.lastTriggeredAt ?? null });
    tx.set(fingerprint, { userId: uid, searchId: ref.id, updatedAt: now });
    if (oldFingerprint && oldMatch?.data()?.searchId === ref.id) tx.delete(oldFingerprint);
    if (!previous.exists) tx.set(quota, { count: current + 1, updatedAt: now });
    return ref.id;
  });
  return { searchId };
});
export const deleteSavedSearch = marketplaceMutationCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const searchId = validId(request.data?.searchId, "Search");
  const ref = searches.doc(searchId);
  const quota = db.collection("savedSearchQuotas").doc(uid);
  await runGuardedTransaction(db, async (tx) => {
    const [snapshot, currentQuota] = await Promise.all([tx.get(ref), tx.get(quota)]);
    if (!snapshot.exists) return;
    if (snapshot.data()?.userId !== uid) throw new HttpsError("permission-denied", "Search is not yours.");
    const fingerprint = searchFingerprint(uid, snapshot.data()!.criteria as SearchCriteria);
    const matched = await tx.get(fingerprint);
    tx.delete(ref);
    if (matched.data()?.searchId === ref.id) tx.delete(fingerprint);
    tx.set(quota, { count: Math.max(0, Number(currentQuota.data()?.count ?? 0) - 1), updatedAt: Timestamp.now() });
  });
  return { deleted: true };
});
export const getSavedSearches = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const snapshot = await searches.where("userId", "==", uid).limit(11).get();
  return { items: snapshot.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: iso(item.data().createdAt), updatedAt: iso(item.data().updatedAt), lastTriggeredAt: iso(item.data().lastTriggeredAt) })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) };
});

type Job = { kind: "watchers" | "followers" | "searches" | "losers"; listingId: string; eventKey: string; eventType: string; categoryKey?: string; cursor?: string | null; createdAt: Timestamp; eventAt: Timestamp; listingSnapshot?: Record<string, unknown> };
function queueJob(eventKey: string, job: Omit<Job, "eventKey" | "createdAt" | "cursor">) {
  const ref = db.collection("engagementJobs").doc(stableId(eventKey, job.kind, job.categoryKey ?? ""));
  return runGuardedTransaction(db, async (tx) => {
    const listing = await tx.get(db.doc(`listings/${job.listingId}`));
    const existing = await tx.get(ref);
    if (!listing.exists || !(await accountIsActive(listing.data()!.sellerId, tx)) || existing.exists) return;
    tx.create(ref, { ...job, eventKey, createdAt: Timestamp.now(), cursor: null });
  });
}

export const onSavedWatchChanged = onDocumentWritten("users/{uid}/saved/{listingId}", async (event) => {
  const { uid, listingId } = event.params;
  const ref = db.collection("listingWatchers").doc(listingId).collection("users").doc(uid);
  const current = await db.collection("users").doc(uid).collection("saved").doc(listingId).get();
  if (current.exists) await runGuardedTransaction(db, async (tx) => { if (await accountIsActive(uid, tx)) { const saved = await tx.get(db.doc(`users/${uid}/saved/${listingId}`)); if (saved.exists) tx.set(ref, { userId: uid, listingId, savedAt: saved.data()?.savedAt ?? Timestamp.now() }); } });
  else await ref.delete();
});

export const onListingEngagementChanged = onDocumentWritten("listings/{listingId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (after && !(await accountIsActive(after.sellerId))) return;
  if (!after) return;
  const listingId = event.params.listingId;
  const eventKey = event.id;
  const eventAt = event.data!.after.updateTime ?? Timestamp.now();
  if (before?.status !== "active" && after.status === "active") {
    const listingSnapshot = Object.fromEntries(["status", "title", "searchTokens", "categoryId", "condition", "listingType", "auctionStatus", "price", "location"].filter((key) => after[key] !== undefined && (key !== "categoryId" || listingCategoryId(after[key]) !== null)).map((key) => [key, after[key]]));
    await Promise.all([
      queueJob(eventKey, { kind: "followers", listingId, eventType: "followed_seller_listing", eventAt }),
      ...newListingSearchCategories(after).map(categoryKey => queueJob(eventKey, { kind: "searches", listingId, eventType: "new_matching_listing", categoryKey, eventAt, listingSnapshot })),
    ]);
  }
  const oldSen = priceSen(before?.price);
  const newSen = priceSen(after.price);
  if (before?.status === "active" && after.status === "active" && after.listingType === "buy_now" && oldSen !== null && newSen !== null && newSen < oldSen) {
    const ref = db.collection("listingPriceHistory").doc(listingId).collection("changes").doc(stableId(eventKey));
    await runGuardedTransaction(db, async (tx) => { const existing = await tx.get(ref); if (!(await accountIsActive(after.sellerId, tx)) || existing.exists) return; tx.create(ref, { listingId, oldPriceSen: oldSen, newPriceSen: newSen, currency: "MYR", actorId: after.sellerId, changedAt: eventAt, eventKey }); });
    await queueJob(eventKey, { kind: "watchers", listingId, eventType: "saved_price_drop", eventAt });
  }
  if (before?.status === "active" && (["removed", "sold"].includes(after.status) || after.status === "ended" && (after.listingType === "buy_now" || after.auctionStatus === "cancelled"))) await queueJob(eventKey, { kind: "watchers", listingId, eventType: "saved_unavailable", eventAt });
  if (before?.auctionStatus !== "ended" && after.auctionStatus === "ended" && after.status === "ended" && ["auction", "buy_now_and_auction"].includes(after.listingType)) {
    if (after.winnerId && after.winnerId !== after.sellerId) {
      await emit(after.winnerId, `auction-won:${listingId}`, { type: "auction_won", title: "You won the auction", body: String(after.title ?? "Your auction"), href: `/listings/${listingId}`, listingId });
      await queueJob(eventKey, { kind: "losers", listingId, eventType: "auction_lost", eventAt });
    }
  }
});

export const onBidEngagementCreated = onDocumentCreated("listings/{listingId}/bids/{bidId}", async (event) => {
  const bid = event.data?.data();
  if (!bid || !bid.outbidUserId || bid.outbidUserId === bid.bidderId) return;
  const listingId = event.params.listingId;
  await emit(bid.outbidUserId, `outbid:${listingId}:${event.params.bidId}`, { type: "outbid", title: "You were outbid", body: "A new bid is leading this auction.", href: `/listings/${listingId}`, listingId });
});

export const onOfferEngagementCreated = onDocumentCreated("offers/{offerId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.status !== "submitted") return;
  await emit(data.sellerId, `offer-created:${event.params.offerId}`, { type: "offer_received", title: "New offer received", body: "Review a buyer request on your listing.", href: `/listings/${data.listingId}`, listingId: data.listingId });
});
export const onOfferEngagementUpdated = onDocumentUpdated("offers/{offerId}", async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;
  if (after.status === "countered") await emit(after.buyerId, `offer-counter:${event.params.offerId}`, { type: "counteroffer", title: "Seller sent a counteroffer", body: "Review the updated amount.", href: `/listings/${after.listingId}`, listingId: after.listingId });
  if (after.status === "accepted") await emit(after.buyerId, `offer-accepted:${event.params.offerId}`, { type: "offer_accepted", title: "Offer accepted", body: "Your transaction is ready.", href: `/transactions/${after.transactionId}`, transactionId: after.transactionId, listingId: after.listingId });
});

export const onTransactionEngagementCreated = onDocumentCreated("transactions/{transactionId}", async (event) => {
  const data = event.data?.data(); if (!data) return;
  for (const uid of [data.buyerId, data.sellerId]) await emit(uid, `transaction-created:${event.params.transactionId}`, { type: "transaction_update", title: "Transaction started", body: "Review the next steps for your transaction.", href: `/transactions/${event.params.transactionId}`, transactionId: event.params.transactionId, listingId: data.listingId });
});
export const onTransactionEngagementUpdated = onDocumentUpdated("transactions/{transactionId}", async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data(); if (!before || !after) return;
  const id = event.params.transactionId;
  const target = `/transactions/${id}`;
  const updates: { uid: string; key: string; title: string; type: NotificationType }[] = [];
  if (after.status !== "completed" && !before.buyerConfirmedAt && after.buyerConfirmedAt) updates.push({ uid: after.sellerId, key: "buyer-confirmed", title: "Buyer confirmed completion", type: "transaction_update" });
  if (after.status !== "completed" && !before.sellerConfirmedAt && after.sellerConfirmedAt) updates.push({ uid: after.buyerId, key: "seller-confirmed", title: "Seller confirmed completion", type: "transaction_update" });
  if (!before.cancellationRequestedBy && after.cancellationRequestedBy) updates.push({ uid: after.cancellationRequestedBy === after.buyerId ? after.sellerId : after.buyerId, key: "cancellation-requested", title: "Cancellation requested", type: "transaction_update" });
  if (before.status !== after.status && ["completed", "cancelled", "disputed"].includes(after.status)) for (const uid of [after.buyerId, after.sellerId]) updates.push({ uid, key: `status-${after.status}`, title: after.status === "completed" ? "Transaction completed" : after.status === "cancelled" ? "Transaction cancelled" : "Transaction disputed", type: after.status === "completed" ? "transaction_completed" : "transaction_update" });
  for (const update of updates) await emit(update.uid, `transaction:${id}:${update.key}`, { type: update.type, title: update.title, body: "Open the transaction for details.", href: target, transactionId: id, listingId: after.listingId });
});

async function processJob(ref: FirebaseFirestore.DocumentReference, job: Job, leaseToken: string) {
  const listing = await db.collection("listings").doc(job.listingId).get();
  const data = listing.data();
  if (!data || !(await accountIsActive(data.sellerId))) { await runGuardedTransaction(db, async (tx) => { const current = await tx.get(ref); if (current.data()?.leaseToken === leaseToken) tx.delete(ref); }); return; }
  if (["followers", "searches"].includes(job.kind) && data.status !== "active") { await runGuardedTransaction(db, async (tx) => { const current = await tx.get(ref); if (current.data()?.leaseToken === leaseToken) tx.delete(ref); }); return; }
  let base: FirebaseFirestore.Query;
  if (job.kind === "followers") base = follows(String(data.sellerId)).orderBy(FieldPath.documentId());
  else if (job.kind === "watchers") base = db.collection("listingWatchers").doc(job.listingId).collection("users").orderBy(FieldPath.documentId());
  else if (job.kind === "losers") base = listing.ref.collection("bids").orderBy(FieldPath.documentId());
  else base = searches.where("categoryKey", "==", job.categoryKey).orderBy(FieldPath.documentId());
  const page = await (job.cursor ? base.startAfter(job.cursor) : base).limit(PAGE).get();
  for (const item of page.docs) {
    const record = item.data();
    const recipient = job.kind === "followers" || job.kind === "watchers" ? item.id : job.kind === "losers" ? record.bidderId : record.userId;
    if (!recipient || recipient === data.sellerId || !(await accountIsActive(recipient))) continue;
    if ((job.kind === "followers" || job.kind === "watchers" || job.kind === "searches") && record.createdAt instanceof Timestamp && record.createdAt.toMillis() > job.eventAt.toMillis()) continue;
    if (job.kind === "watchers" && record.savedAt instanceof Timestamp && record.savedAt.toMillis() > job.eventAt.toMillis()) continue;
    if (job.kind === "losers" && (recipient === data.winnerId || record.bidderId === data.winnerId)) continue;
    if (job.kind === "searches") {
      if (!record.active || record.frequency !== "instant" || !matchesSearch(record.criteria as SearchCriteria, job.listingSnapshot ?? data) || !matchesSearch(record.criteria as SearchCriteria, data)) continue;
      // Only alert for listings published after the search was saved.
      if (!(record.createdAt instanceof Timestamp) || record.createdAt.toMillis() > job.eventAt.toMillis() || record.updatedAt instanceof Timestamp && record.updatedAt.toMillis() > job.eventAt.toMillis()) continue;
      await emit(recipient, `search:${item.id}:${job.listingId}`, { type: "new_matching_listing", title: "New match for your saved search", body: String(data.title ?? "A new listing matches your search."), href: `/listings/${job.listingId}`, listingId: job.listingId });
      await item.ref.update({ lastTriggeredAt: Timestamp.now() });
      continue;
    }
    const href = `/listings/${job.listingId}`;
    const title = job.eventType === "saved_price_drop" ? "Price dropped on a saved item" : job.eventType === "saved_unavailable" ? "Saved item is no longer available" : job.eventType === "auction_ending" ? "Saved auction is ending soon" : job.eventType === "auction_lost" ? "Auction ended" : "New listing from a seller you follow";
    const body = job.eventType === "auction_lost" ? "Another bidder won this auction." : String(data.title ?? "Marketplace listing");
    await emit(recipient, `${job.eventType}:${job.listingId}:${job.eventKey}`, { type: job.eventType as NotificationType, title, body, href, listingId: job.listingId, sellerId: data.sellerId });
  }
  await runGuardedTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists || current.data()?.leaseToken !== leaseToken) return;
    if (page.size < PAGE) tx.delete(ref);
    else tx.update(ref, { cursor: page.docs.at(-1)!.id, leaseUntil: null, leaseToken: null, updatedAt: Timestamp.now() });
  });
}

export const processEngagementJobs = onSchedule({ schedule: "every 1 minutes", timeZone: "UTC", timeoutSeconds: 120 }, async () => {
  const jobs = await db.collection("engagementJobs").orderBy("createdAt").limit(5).get();
  for (const item of jobs.docs) {
    const leaseToken = randomUUID();
    const job = await runGuardedTransaction(db, async (tx) => {
      const current = await tx.get(item.ref);
      if (!current.exists || current.data()?.leaseUntil instanceof Timestamp && current.data()!.leaseUntil.toMillis() > Date.now()) return null;
      tx.update(item.ref, { leaseToken, leaseUntil: Timestamp.fromMillis(Date.now() + 150_000) });
      return current.data() as Job;
    });
    if (job) await processJob(item.ref, job, leaseToken);
  }
});

export const queueEndingAuctionAlerts = onSchedule({ schedule: "every 1 minutes", timeZone: "UTC", timeoutSeconds: 120 }, async () => {
  const now = Timestamp.now();
  const horizon = Timestamp.fromMillis(now.toMillis() + 60 * 60_000);
  const cursorRef = db.collection("engagementSchedulerCursors").doc("endingAuctions");
  const cursor = await cursorRef.get();
  const base = db.collection("listings").where("status", "==", "active").where("auctionStatus", "==", "active").where("auctionEndAt", ">", now).where("auctionEndAt", "<=", horizon).orderBy("auctionEndAt").orderBy(FieldPath.documentId());
  let query = cursor.data()?.endAt instanceof Timestamp && typeof cursor.data()?.listingId === "string" ? base.startAfter(cursor.data()!.endAt, cursor.data()!.listingId) : base;
  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const page = await query.limit(100).get();
    for (const listing of page.docs) await queueJob(`ending:${listing.id}`, { kind: "watchers", listingId: listing.id, eventType: "auction_ending", eventAt: now });
    if (page.size < 100) { await cursorRef.delete(); return; }
    const last = page.docs.at(-1)!;
    query = base.startAfter(last);
    if (pageNumber === 4) await cursorRef.set({ endAt: last.data().auctionEndAt, listingId: last.id, updatedAt: now });
  }
});

export const _engagementTest = { optionalTypes, priceSen, matchesSearch, parseSearch, stableId };
