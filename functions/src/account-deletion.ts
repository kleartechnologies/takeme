import { createHash, randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue, Timestamp, type DocumentData, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { monthsAfter } from "./account-deletion-retention";
import { lifecycleRef } from "./account-lifecycle";

export const DELETION_POLICY_VERSION = "v1-2026-10-03";
const DAY = 86_400_000;
const db = getFirestore();
const operations = db.collection("accountDeletionOperations");
const terminal = new Set(["completed", "cancelled", "expired"]);
const caseClosed = new Set(["resolved", "dismissed", "closed"]);
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const stamp = (date: number) => Timestamp.fromMillis(date);
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
const keep = (data: DocumentData, keys: string[]) => Object.fromEntries(keys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

/** No credentials/default project are consulted. This release is deliberately demo-only. */
export function requireDeletionDemo() {
  const project = process.env.GCLOUD_PROJECT || getApp().options.projectId;
  if (project !== "demo-takeme" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") {
    throw new HttpsError("failed-precondition", "Account deletion is enabled only in the verified demo emulator environment.");
  }
}
async function owner(request: CallableRequest, recent: boolean) {
  requireDeletionDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to manage your TAKEME account deletion.");
  const uid = request.auth.uid;
  try { if ((await getAuth().getUser(uid)).disabled) throw new HttpsError("unauthenticated", "Sign in again."); }
  catch (error) { if ((error as { code?: string }).code === "auth/user-not-found") throw new HttpsError("unauthenticated", "This account no longer exists."); throw error; }
  const age = Date.now() / 1000 - Number(request.auth.token.auth_time);
  if (recent && (!Number.isFinite(age) || age < -60 || age > 300)) throw new HttpsError("failed-precondition", "Reauthenticate before requesting account deletion.", { reason: "recent-auth-required" });
  return uid;
}
function publicStatus(data: DocumentData | undefined) {
  if (!data) return { state: "not_requested", policyVersion: DELETION_POLICY_VERSION };
  return { state: data.state, phase: data.phase, blockers: data.blockers ?? [], failureCode: data.failureCode ?? null, requestedAt: iso(data.requestedAt), completedAt: iso(data.completedAt), policyVersion: data.policyVersion };
}
export const getAccountDeletionStatus = onCall(async (request) => {
  requireDeletionDemo();
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to check deletion progress.");
  const data = (await operations.doc(request.auth.uid).get()).data();
  // A still-valid, signed pre-deletion ID token can acknowledge completion after
  // the worker removes Auth. No caller-supplied UID or deletion shortcut is accepted.
  if (data?.state === "completed") return publicStatus(data);
  await owner(request, false);
  return publicStatus(data);
});
export const requestAccountDeletion = onCall({ timeoutSeconds: 540 }, async (request) => {
  const uid = await owner(request, true);
  if (request.data?.confirmation !== "DELETE" || request.data?.policyVersion !== DELETION_POLICY_VERSION || Object.keys(request.data ?? {}).some((key) => !["confirmation", "policyVersion"].includes(key))) throw new HttpsError("invalid-argument", "Confirm the current TAKEME deletion policy by typing DELETE.");
  await db.runTransaction(async (tx) => {
    const ref = operations.doc(uid); const existing = await tx.get(ref);
    if (existing.exists) return;
    const alias = `deleted-${randomUUID().replaceAll("-", "")}`;
    tx.create(ref, { uid, alias, state: "pending", phase: "personal_data", policyVersion: DELETION_POLICY_VERSION, requestedAt: Timestamp.now(), updatedAt: Timestamp.now(), blockers: [], attempts: 0 });
    tx.create(lifecycleRef(uid), { state: "deletion_pending", alias, requestedAt: Timestamp.now() });
  });
  await processAccountDeletion(uid);
  return publicStatus((await operations.doc(uid).get()).data());
});
export const retryAccountDeletion = onCall({ timeoutSeconds: 540 }, async (request) => {
  const uid = await owner(request, true);
  if (!(await operations.doc(uid).get()).exists) throw new HttpsError("failed-precondition", "Request deletion first.");
  await processAccountDeletion(uid);
  return publicStatus((await operations.doc(uid).get()).data());
});

async function pages(query: Query, visit: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>) {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    const page = await (cursor ? query.orderBy(FieldPath.documentId()).startAfter(cursor) : query.orderBy(FieldPath.documentId())).limit(100).get();
    for (const doc of page.docs) await visit(doc);
    if (page.size < 100) return;
    cursor = page.docs.at(-1);
  }
}
async function linked(collection: string, fields: string[], identities: string[]) {
  const found = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const field of fields) for (const uid of identities) await pages(db.collection(collection).where(field, "==", uid), async (doc) => { found.set(doc.ref.path, doc); });
  return [...found.values()];
}
async function groupLinked(collection: string, fields: string[], identities: string[]) {
  const found = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const field of fields) for (const uid of identities) await pages(db.collectionGroup(collection).where(field, "==", uid), async (doc) => { found.set(doc.ref.path, doc); });
  return [...found.values()];
}
async function erase(ref: FirebaseFirestore.DocumentReference) { await db.recursiveDelete(ref); }
function replaceIdentity(value: unknown, uid: string, alias: string): unknown {
  if (value === uid) return alias;
  if (Array.isArray(value)) return value.map((item) => replaceIdentity(item, uid, alias));
  if (value && typeof value === "object" && !(value instanceof Timestamp)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key === uid ? alias : key, replaceIdentity(item, uid, alias)]));
  return value;
}
async function pseudonymise(doc: DocumentSnapshot, uid: string, alias: string, keys?: string[]) {
  await db.runTransaction(async (tx) => {
    const current = await tx.get(doc.ref);
    if (!current.exists) return;
    const data = keys ? keep(current.data()!, keys) : current.data()!;
    tx.set(doc.ref, replaceIdentity(data, uid, alias) as DocumentData);
  });
}
async function storagePrefix(prefix: string) {
  for (const name of ["demo-takeme.firebasestorage.app", "demo-takeme.appspot.com"]) {
    const bucket = getStorage().bucket(name);
    for (;;) { const [files] = await bucket.getFiles({ prefix, maxResults: 100, autoPaginate: false }); if (!files.length) break; for (const file of files) await file.delete({ ignoreNotFound: true }); }
  }
}
async function removeListing(doc: DocumentSnapshot, uid: string) {
  // Stop serving first, so failed Storage cleanup remains a retryable unavailable listing.
  await doc.ref.set({ status: "removed", deletionWithdrawn: true }, { merge: true });
  await storagePrefix(`users/${uid}/listings/${doc.id}/`);
  for (const name of ["listingPriceHistory", "listingWatchers", "listingTrends", "promotionLocks"]) await erase(db.doc(`${name}/${doc.id}`));
  await pages(db.collection("engagementJobs").where("listingId", "==", doc.id), async (job) => { await erase(job.ref); });
  await pages(db.collection("engagementSchedulerCursors").where("listingId", "==", doc.id), async (cursor) => { await erase(cursor.ref); });
  await erase(doc.ref);
}
async function erasePersonal(uid: string) {
  // recursiveDelete includes children beneath missing parents.
  await erase(db.doc(`users/${uid}`));
  for (const name of ["privateUserAddresses", "notificationPreferences", "notificationSummaries", "userInterests", "trustSummaries", "savedSearchQuotas", "sellerFollowSummaries", "sellerPaymentProfiles"]) await erase(db.doc(`${name}/${uid}`));
  for (const name of ["savedSearches", "savedSearchFingerprints", "discoverySessions", "discoveryAttributions", "intelligenceQuotas"]) await pages(db.collection(name).where("userId", "==", uid), async (doc) => { await erase(doc.ref); });
  for (const doc of await groupLinked("users", ["userId"], [uid])) if (doc.ref.path.startsWith("listingWatchers/")) await erase(doc.ref);
  const outward = await groupLinked("members", ["userId"], [uid]);
  for (const doc of outward) if (doc.ref.path.startsWith("sellerFollowers/")) {
    await db.runTransaction(async (tx) => { const current = await tx.get(doc.ref); const summary = db.doc(`sellerFollowSummaries/${doc.data().sellerId}`); const count = await tx.get(summary); if (current.exists) { tx.delete(doc.ref); if (count.exists) tx.update(summary, { followerCount: Math.max(0, Number(count.data()?.followerCount ?? 0) - 1) }); } });
  }
  await pages(db.collection(`sellerFollowers/${uid}/members`), async (doc) => { await erase(db.doc(`users/${doc.id}/following/${uid}`)); });
  await erase(db.doc(`sellerFollowers/${uid}`));
  await pages(db.collection("engagementJobs").where("cursor", "==", uid), async (job) => { await db.runTransaction(async (tx) => { const current = await tx.get(job.ref); if (current.data()?.cursor === uid) tx.update(job.ref, { cursor: null }); }); });
  await storagePrefix(`users/${uid}/profile/`);
}

const LEGACY = ["favorites", "auctions", "bids", "orders", "reviews", "messages", "boosts", "featuredListings", "notifications"];
async function legacyCheck(uid: string) {
  const paths: string[] = [];
  const inspect = async (ref: FirebaseFirestore.DocumentReference) => {
    const doc = await ref.get();
    if (ref.path.split(/[\/_|]/).includes(uid) || doc.exists && JSON.stringify(doc.data()).includes(uid)) paths.push(ref.path);
    for (const child of await ref.listCollections()) for (const nested of await child.listDocuments()) await inspect(nested);
  };
  for (const name of LEGACY) for (const ref of await db.collection(name).listDocuments()) await inspect(ref);
  return paths;
}
async function blockers(identities: string[]) {
  const result = new Set<string>();
  const owned = await linked("listings", ["sellerId"], identities);
  const bids = await groupLinked("bids", ["bidderId"], identities);
  const auctions = new Map(owned.filter((doc) => doc.data().listingType !== "buy_now").map((doc) => [doc.ref.path, doc]));
  for (const bid of bids) { const listing = await bid.ref.parent.parent!.get(); if (listing.exists) auctions.set(listing.ref.path, listing as FirebaseFirestore.QueryDocumentSnapshot); }
  for (const auction of auctions.values()) {
    const data = auction.data();
    if (Number(data.bidCount ?? 0) > 0 && ["active", "scheduled"].includes(data.auctionStatus)) result.add("live_auction");
    if (data.auctionStatus === "ended" && data.winnerId && !(await db.doc(`transactions/auction-${auction.id}`).get()).exists) result.add("auction_finalisation");
  }
  for (const doc of await linked("transactions", ["buyerId", "sellerId"], identities)) if (!terminal.has(doc.data().status)) result.add(doc.data().status === "disputed" ? "unresolved_dispute" : "unfinished_deal");
  for (const doc of await linked("reports", ["reporterId", "userId", "targetId", "moderatedBy"], identities)) if (!caseClosed.has(doc.data().status)) result.add("unresolved_report");
  for (const doc of await linked("transactionDisputes", ["buyerId", "sellerId", "openedBy", "resolvedBy"], identities)) if (!caseClosed.has(doc.data().status)) result.add("unresolved_dispute");
  return [...result];
}

async function copyEvidenceMedia(value: unknown, uid: string, evidenceId: string): Promise<string[]> {
  const paths: string[] = [];
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const url = typeof item === "string" ? item : item && typeof item === "object" ? (item as Record<string, unknown>).url : null;
    if (typeof url !== "string") continue;
    const match = /\/b\/(demo-takeme(?:\.firebasestorage\.app|\.appspot\.com))\/o\/([^?]+)/.exec(url);
    if (!match) continue;
    const object = decodeURIComponent(match[2]!);
    if (!object.startsWith(`users/${uid}/`)) continue;
    const target = `accountDeletionEvidence/${evidenceId}/${digest(object)}`;
    const bucket = getStorage().bucket(match[1]!);
    try { const [bytes] = await bucket.file(object).download(); await bucket.file(target).save(bytes, { resumable: false, metadata: { contentType: "application/octet-stream" } }); paths.push(target); }
    catch (error) { if ((error as { code?: number }).code !== 404) throw error; }
  }
  return paths;
}

async function evidenceForCase(record: DocumentSnapshot, uid: string, alias: string, conversations: DocumentSnapshot[], redact = true) {
  const data = record.data()!;
  const evidenceId = data.deletionEvidenceId ?? digest(`${alias}|${record.ref.path}`);
  const ref = db.doc(`accountDeletionEvidence/${evidenceId}`);
  const closed = caseClosed.has(data.status);
  const closure = data.resolvedAt ?? data.closedAt ?? (closed ? data.updatedAt : null);
  await operations.doc(uid).set({ evidenceIds: FieldValue.arrayUnion(evidenceId) }, { merge: true });
  const existing = await ref.get();
  if (!existing.data()?.snapshotComplete) {
    if (!existing.exists) await ref.create({ casePath: record.ref.path, purpose: "Resolve marketplace report/dispute", access: "restricted_admin", retentionRule: "case_closure_plus_180_days", expiresAt: closed && closure instanceof Timestamp ? stamp(closure.toMillis() + 180 * DAY) : null, createdAt: Timestamp.now() });
    const minimal = keep(data, ["disputeReason", "disputeOpenedBy", "disputedAt", "reason", "details", "description", "sellerResponse", "resolution", "status", "reporterId", "userId", "targetType", "targetId", "conversationId", "listingId", "transactionId", "buyerId", "sellerId", "openedBy", "createdAt", "openedAt", "resolvedAt"]);
    await ref.collection("records").doc("case").set(minimal);
    for (const conversation of conversations) {
      if (data.conversationId !== conversation.id && data.transactionId !== conversation.data()?.transactionId && record.id !== conversation.data()?.transactionId && data.listingId !== conversation.data()?.listingId) continue;
      const recent = await conversation.ref.collection("messages").orderBy("createdAt", "desc").limit(20).get();
      const messages = new Map(recent.docs.map((doc) => [doc.id, doc as DocumentSnapshot]));
      if (data.targetType === "message" && typeof data.targetId === "string") { const target = await conversation.ref.collection("messages").doc(data.targetId).get(); if (target.exists) messages.set(target.id, target); }
      for (const message of messages.values()) { const media = await copyEvidenceMedia(message.data()?.attachments ?? message.data()?.media ?? [], uid, evidenceId); await ref.collection("records").doc(digest(message.ref.path)).set({ sourcePath: message.ref.path, ...keep(message.data()!, ["senderId", "body", "createdAt"]), media }); }
    }
    if (typeof data.listingId === "string") { const listing = await db.doc(`listings/${data.listingId}`).get(); if (listing.exists) { const media = await copyEvidenceMedia(listing.data()?.imageUrls ?? [], uid, evidenceId); await ref.collection("records").doc("listing").set({ ...keep(listing.data()!, ["title", "description", "categoryId", "condition"]), media }); } }
    if (data.targetType === "review" && typeof data.targetId === "string") { const review = await db.doc(`publicReviews/${data.targetId}`).get(); if (review.exists) await ref.collection("records").doc("review").set(keep(review.data()!, ["reviewedUserId", "reviewerRole", "rating", "tags", "comment", "createdAt", "publishedAt"])); }
    const sourceEvidence = await record.ref.collection("evidence").get();
    for (const item of sourceEvidence.docs) await ref.collection("records").doc(digest(item.ref.path)).set(keep(item.data(), ["actorId", "role", "actorRole", "note", "createdAt"]));
    await ref.set({ snapshotComplete: true }, { merge: true });
  }
  // Capture updates and redact the same current version, so a racing case response is never lost.
  if (redact) await db.runTransaction(async (tx) => {
    const current = await tx.get(record.ref); if (!current.exists) return;
    const fields = current.data()!;
    const updates = keep(fields, ["sellerResponse", "resolution", "resolvedBy", "resolvedAt"]);
    if (Object.keys(updates).length) tx.set(ref.collection("records").doc("case"), updates, { merge: true });
    tx.set(record.ref, replaceIdentity(keep(fields, ["status", "reason", "targetType", "targetId", "conversationId", "listingId", "transactionId", "buyerId", "sellerId", "reporterId", "userId", "openedBy", "resolvedBy", "moderatedBy", "createdAt", "openedAt", "resolvedAt", "updatedAt", "deletionEvidenceId", "retentionPurpose", "retentionExpiresAt"]), uid, alias) as DocumentData);
  });
  await record.ref.set({ deletionEvidenceId: evidenceId, ...(closed && closure instanceof Timestamp ? { retentionPurpose: "Closed marketplace case", retentionExpiresAt: existing.data()?.expiresAt ?? stamp(closure.toMillis() + 180 * DAY) } : {}) }, { merge: true });
  for (const item of (await record.ref.collection("evidence").get()).docs) await db.runTransaction(async (tx) => {
    const current = await tx.get(item.ref); if (!current.exists) return;
    tx.set(ref.collection("records").doc(digest(item.ref.path)), keep(current.data()!, ["actorId", "role", "actorRole", "note", "createdAt"]));
    tx.delete(item.ref);
  });

}

async function sharedCleanup(uid: string, alias: string, final: boolean) {
  const identities = [uid, alias]; const now = Timestamp.now();
  const deals = await linked("transactions", ["buyerId", "sellerId"], identities);
  const conversations = await linked("conversations", ["buyerId", "sellerId"], identities);
  const reports = new Map((await linked("reports", ["reporterId", "userId", "targetId", "moderatedBy"], identities)).map((doc) => [doc.ref.path, doc]));
  for (const conversation of conversations) for (const doc of await linked("reports", ["conversationId"], [conversation.id])) reports.set(doc.ref.path, doc);
  for (const listing of await linked("listings", ["sellerId"], identities)) for (const doc of await linked("reports", ["listingId"], [listing.id])) reports.set(doc.ref.path, doc);
  const reviewIds = new Set((await linked("publicReviews", ["reviewedUserId"], identities)).map((doc) => doc.id));
  for (const deal of deals) for (const review of (await deal.ref.collection("reviews").get()).docs) {
    const data = review.data();
    if (identities.includes(data.reviewerId) || identities.includes(data.reviewedUserId) || identities.includes(review.id)) reviewIds.add(data.publishedReviewId ?? digest(`${deal.id}|${review.id}`));
  }
  for (const reviewId of reviewIds) for (const report of await linked("reports", ["targetId"], [reviewId])) if (report.data().targetType === "review") reports.set(report.ref.path, report);
  const disputes = await linked("transactionDisputes", ["buyerId", "sellerId", "openedBy", "resolvedBy"], identities);
  for (const deal of deals) if (deal.data().status === "disputed" && deal.data().disputeReason && !(await db.doc(`transactionDisputes/${deal.id}`).get()).exists) {
    // Capture scoped conversation/media evidence before transaction redaction.
    await evidenceForCase(deal, uid, alias, conversations, false);
  }
  for (const record of [...reports.values(), ...disputes]) await evidenceForCase(record, uid, alias, conversations);
  for (const deal of deals) {
    const data = deal.data(); const closed = terminal.has(data.status);
    const closure = data.completedAt ?? data.cancelledAt ?? data.expiredAt ?? data.updatedAt ?? now;
    const deadline = data.retentionExpiresAt ?? monthsAfter(closure, 12);
    await pseudonymise(deal, uid, alias, ["listingId", "categoryId", "buyerId", "sellerId", "type", "sourceId", "status", "amountSen", "currency", "paymentMethod", "settlementMode", "paymentProvider", "buyerConfirmedAt", "sellerConfirmedAt", "cancellationRequestedBy", "disputeOpenedBy", "createdAt", "updatedAt", "completedAt", "cancelledAt", "expiredAt", "retentionExpiresAt", "retentionPurpose", "reviewCount", "reviewWindowEndAt", "reviewsVisibleAt"]);
    const dealLock = db.doc(`listingDeals/${data.listingId}`);
    if (closed && (await dealLock.get()).data()?.transactionId === deal.id) await dealLock.set({ status: data.status, retentionExpiresAt: deadline, retentionPurpose: "Prevent duplicate marketplace deal" }, { merge: true });
    await deal.ref.set({ listingTitle: "Removed listing", deletionRelated: true, ...(closed ? { retentionPurpose: "Temporary shared marketplace transaction history", retentionExpiresAt: deadline } : {}) }, { merge: true });
    for (const review of (await deal.ref.collection("reviews").get()).docs) {
      const r = review.data(); const publicRef = db.doc(`publicReviews/${r.publishedReviewId ?? digest(`${deal.id}|${review.id}`)}`);
      if (identities.includes(r.reviewedUserId)) { await erase(publicRef); await erase(review.ref); }
      else if (identities.includes(r.reviewerId) || identities.includes(review.id)) {
        const destination = deal.ref.collection("reviews").doc(alias);
        const pub = await publicRef.get();
        // Once published, preserve the existing rating without applying completion/rating credit again.
        if (pub.exists) await publicRef.set({ comment: "", deletedReviewer: true, retentionPurpose: "Authentic review of surviving member", retentionExpiresAt: deadline }, { merge: true });
        const minimal = replaceIdentity(keep(r, ["transactionId", "buyerId", "sellerId", "reviewedUserId", "reviewerRole", "rating", "tags", "createdAt"]), uid, alias) as DocumentData;
        await destination.set({ ...minimal, reviewerId: alias, comment: "", publishedReviewId: publicRef.id, deletedReviewer: true, retentionExpiresAt: deadline });
        if (review.id !== alias) await erase(review.ref);
      }
    }
  }
  // A public projection has no reviewerId: subject deletion is also queried directly.
  for (const doc of await linked("publicReviews", ["reviewedUserId"], identities)) await erase(doc.ref);
  for (const conversation of conversations) {
    const data = conversation.data(); const related = deals.find((deal) => deal.id === data.transactionId);
    const closedAt = related && terminal.has(related.data().status) ? related.data().completedAt ?? related.data().cancelledAt ?? related.data().updatedAt ?? now : null;
    const expiration = closedAt instanceof Timestamp ? stamp(closedAt.toMillis() + 90 * DAY) : !related ? stamp(now.toMillis() + 90 * DAY) : null;
    await pages(conversation.ref.collection("messages"), async (message) => {
      if (identities.includes(message.data().senderId)) await message.ref.set({ senderId: alias, body: "", deletedAuthor: true, createdAt: message.data().createdAt ?? now });
    });
    // IDs embed buyer UIDs. Copy to an opaque path, then recursively erase the old tree.
    const destination = db.doc(`conversations/${digest(`deleted-conversation|${conversation.id}|${alias}`)}`);
    const target = data.deletionRelated ? conversation.ref : destination;
    if (target.path !== conversation.ref.path) {
      await pages(conversation.ref.collection("messages"), async (message) => { await target.collection("messages").doc(message.id).set(message.data()); });
    }
    const minimal = replaceIdentity(keep(data, ["listingId", "buyerId", "sellerId", "participants", "transactionId", "createdAt", "lastMessageAt"]), uid, alias) as DocumentData;
    await target.set({ ...minimal, id: target.id, listingTitle: "Removed listing", listingImage: null, latestMessage: null, unreadBy: {}, status: "closed", deletionRelated: true, retentionPurpose: "Temporary counterparty deal history", retentionExpiresAt: data.retentionExpiresAt ?? expiration, updatedAt: now });
    if (target.path !== conversation.ref.path) {
      // Retained counterparty notifications must not point to the erased private UID-bearing path.
      for (const notice of await groupLinked("notifications", ["href"], [`/messages/${conversation.id}`])) await notice.ref.set({ href: `/messages/${target.id}`, title: "Conversation update", body: "Conversation with Deleted user", dedupeKey: digest(notice.data().dedupeKey ?? notice.id) }, { merge: true });
      for (const report of await linked("reports", ["conversationId"], [conversation.id])) await report.ref.set({ conversationId: target.id, ...(report.data().targetType === "conversation" ? { targetId: target.id } : {}) }, { merge: true });
      await erase(conversation.ref);
    }
  }
  for (const doc of await linked("offers", ["buyerId", "sellerId"], identities)) {
    const data = doc.data();
    if (["submitted", "countered"].includes(data.status)) await doc.ref.update({ status: data.buyerId === uid || data.buyerId === alias ? "withdrawn" : "rejected", updatedAt: now });
    if (!data.transactionId) await erase(doc.ref); else await pseudonymise(doc, uid, alias, ["listingId", "buyerId", "sellerId", "type", "status", "proposedAmountSen", "quotedAmountSen", "currency", "transactionId", "createdAt", "updatedAt"]);
    for (const identity of new Set([...identities, data.buyerId])) { const lock = db.doc(`offerLocks/${data.listingId}_${identity}`); await db.runTransaction(async (tx) => { const current = await tx.get(lock); if (current.data()?.offerId === doc.id) tx.delete(lock); }); }
  }
  for (const bid of await groupLinked("bids", ["bidderId", "outbidUserId"], identities)) {
    await pseudonymise(bid, uid, alias, ["bidderId", "outbidUserId", "amount", "createdAt", "retentionExpiresAt", "retentionPurpose"]);
    if (final) { const listing = await bid.ref.parent.parent!.get(); const closure = listing.data()?.endedAt ?? now; await bid.ref.set({ retentionPurpose: "Historical auction bid integrity", retentionExpiresAt: bid.data().retentionExpiresAt ?? monthsAfter(closure, 12) }, { merge: true }); }
  }
  for (const change of await groupLinked("changes", ["actorId"], identities)) if (change.ref.path.startsWith("listingPriceHistory/")) {
    await change.ref.set({ actorId: alias, retentionPurpose: "Historical listing price integrity", retentionExpiresAt: change.data().retentionExpiresAt ?? monthsAfter(now, 12) }, { merge: true });
  }
  const listings = await linked("listings", ["sellerId", "currentBidderId", "winnerId"], identities);
  for (const listing of listings) {
    const data = listing.data(); const owned = identities.includes(data.sellerId);
    const activeAuction = owned && data.listingType !== "buy_now" && Number(data.bidCount ?? 0) > 0 && ["scheduled", "active"].includes(data.auctionStatus);
    const linkedDeals = await linked("transactions", ["listingId"], [listing.id]);
    if (owned && !activeAuction && !linkedDeals.length && !(data.auctionStatus === "ended" && data.winnerId)) { await removeListing(listing, uid); continue; }
    if (owned && final) {
      await storagePrefix(`users/${uid}/listings/${listing.id}/`);
      await pseudonymise(listing, uid, alias, ["sellerId", "currentBidderId", "winnerId", "listingType", "categoryId", "status", "auctionStatus", "bidCount", "currentBid", "startingBid", "minimumBidIncrement", "finalBid", "endedAt", "createdAt", "auctionStartAt", "auctionEndAt"]);
      await listing.ref.set({ title: "Removed listing", imageUrls: [], status: "removed", retentionPurpose: "Marketplace result integrity", retentionExpiresAt: data.retentionExpiresAt ?? monthsAfter(now, 12) }, { merge: true });
      for (const name of ["listingWatchers", "listingTrends", "listingPriceHistory", "promotionLocks"]) await erase(db.doc(`${name}/${listing.id}`));
      for (const job of await linked("engagementJobs", ["listingId"], [listing.id])) await erase(job.ref);
      for (const cursor of await linked("engagementSchedulerCursors", ["listingId"], [listing.id])) await erase(cursor.ref);
    } else await pseudonymise(listing, uid, alias);
  }
  for (const doc of await linked("promotions", ["sellerId"], identities)) {
    if (["not_configured", "unpaid"].includes(doc.data().paymentStatus)) { await erase(db.doc(`promotionLocks/${doc.data().listingId}`)); await erase(doc.ref); }
    else throw new HttpsError("failed-precondition", "Unexpected paid promotion requires financial retention classification.");
  }
  for (const doc of await linked("marketplaceEvents", ["userId"], identities)) await erase(doc.ref);
  for (const doc of await linked("marketplaceEvents", ["sellerId"], identities)) await doc.ref.update({ sellerId: FieldValue.delete() });
  for (const doc of await linked("intelligenceCompletions", ["userId"], identities)) await doc.ref.set({ transactionId: doc.data().transactionId, processed: true });
  for (const doc of await linked("transactionEvents", ["actorId"], identities)) {
    await pseudonymise(doc, uid, alias, ["transactionId", "eventType", "actorType", "actorId", "provider", "createdAt"]);
    await doc.ref.set({ retentionPurpose: "Transaction audit integrity", retentionExpiresAt: doc.data().retentionExpiresAt ?? monthsAfter(now, 12) }, { merge: true });
  }
  // Future financial interfaces must not be silently treated as empty or auto-settled.
  for (const deal of deals) for (const name of ["protectedPayments", "payouts", "refunds", "paymentProviderEvents"]) {
    const direct = await db.doc(`${name}/${deal.id}`).get();
    const linkedRecords = await linked(name, ["transactionId"], [deal.id]);
    if (direct.exists || linkedRecords.length) throw new HttpsError("failed-precondition", "Financial/provider data requires explicit retention classification.");
  }
  for (const notice of await groupLinked("notifications", ["sellerId"], identities)) await notice.ref.set({ sellerId: alias, body: "Deleted user", title: "Marketplace update" }, { merge: true });
  if (final) await storagePrefix(`users/${uid}/`);
}

async function financialCheck(uid: string, alias: string) {
  if ((await db.doc(`sellerPaymentProfiles/${uid}`).get()).exists) return true;
  for (const promotion of await linked("promotions", ["sellerId"], [uid, alias])) if (!["not_configured", "unpaid"].includes(promotion.data().paymentStatus)) return true;
  for (const deal of await linked("transactions", ["buyerId", "sellerId"], [uid, alias])) for (const name of ["protectedPayments", "payouts", "refunds", "paymentProviderEvents"]) {
    if ((await db.doc(`${name}/${deal.id}`).get()).exists || (await linked(name, ["transactionId"], [deal.id])).length) return true;
  }
  return false;
}

export async function processAccountDeletion(uid: string, injectFailure?: (phase: string) => void) {
  requireDeletionDemo();
  const ref = operations.doc(uid); const lease = randomUUID();
  const data = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref); const state = doc.data();
    if (!state || state.state === "completed" || state.leaseUntil instanceof Timestamp && state.leaseUntil.toMillis() > Date.now()) return null;
    tx.update(ref, { state: "cleaning", lease, leaseUntil: stamp(Date.now() + 10 * 60_000), attempts: Number(state.attempts ?? 0) + 1, failureCode: null, updatedAt: Timestamp.now() });
    return state;
  });
  if (!data) return;
  const update = async (fields: DocumentData) => db.runTransaction(async (tx) => { const current = await tx.get(ref); if (current.data()?.lease === lease) tx.update(ref, { ...fields, updatedAt: Timestamp.now() }); });
  try {
    const unknown = await legacyCheck(uid);
    await erase(db.doc(`users/${uid}`));
    if (unknown.length) { await update({ state: "blocked", phase: "classification", blockers: ["unknown_legacy_schema"], classificationPaths: unknown, lease: null, leaseUntil: null }); return; }
    if (await financialCheck(uid, data.alias)) { await update({ state: "blocked", phase: "classification", blockers: ["financial_data_classification"], lease: null, leaseUntil: null }); return; }
    // Keep restricted evidence before redacting any shared records.
    await update({ phase: "shared_data" });
    await sharedCleanup(uid, data.alias, false);
    await erasePersonal(uid);
    injectFailure?.("personal_data");
    const unresolved = await blockers([uid, data.alias]);
    // Reports referencing conversations/listings can be linked without a userId field.
    const evidenceIds = (await ref.get()).data()?.evidenceIds ?? [];
    const caseHolds = await db.collection("accountDeletionEvidence").get();
    for (const hold of caseHolds.docs) {
      // Only this operation's deterministic holds; do not block on another account's cases.
      const casePath = hold.data().casePath;
      if (typeof casePath !== "string" || !evidenceIds.includes(hold.id) && digest(`${data.alias}|${casePath}`) !== hold.id) continue;
      const source = await db.doc(casePath).get();
      if (!source.exists || !caseClosed.has(source.data()?.status) && !terminal.has(source.data()?.status)) unresolved.push("unresolved_case");
    }
    if (unresolved.length) { await update({ state: "pending", phase: "awaiting_resolution", blockers: [...new Set(unresolved)], lease: null, leaseUntil: null }); return; }
    await update({ phase: "final_cleanup", blockers: [] });
    await sharedCleanup(uid, data.alias, true);
    await erasePersonal(uid);
    injectFailure?.("before_auth");
    await update({ phase: "auth_deletion" });
    await getAuth().revokeRefreshTokens(uid).catch((error) => { if (error.code !== "auth/user-not-found") throw error; });
    await getAuth().deleteUser(uid).catch((error) => { if (error.code !== "auth/user-not-found") throw error; });
    injectFailure?.("after_auth");
    const completed = Timestamp.now();
    await lifecycleRef(uid).set({ state: "deleted", completedAt: completed, expiresAt: stamp(completed.toMillis() + 30 * DAY) });
    await update({ state: "completed", phase: "completed", completedAt: completed, expiresAt: stamp(completed.toMillis() + 30 * DAY), lease: null, leaseUntil: null, failureCode: null });
  } catch (error) {
    // Never persist raw exception messages, request tokens, passwords or record content.
    const code = error instanceof HttpsError && error.code === "failed-precondition" ? "classification_required" : "cleanup_failed";
    await update({ state: "failed", failureCode: code, lease: null, leaseUntil: null });
  }
}

export async function enforceDeletionRetention(now = Timestamp.now()) {
  requireDeletionDemo();
  for (const collection of ["accountDeletionEvidence", "accountDeletionSecurityHolds"]) {
    await pages(db.collection(collection), async (doc) => {
      const data = doc.data();
      if (collection === "accountDeletionSecurityHolds" && (!data.purpose || data.access !== "restricted_admin" || !(data.expiresAt instanceof Timestamp))) throw new Error("Invalid restricted security hold requires classification");
      if (data.casePath && !data.expiresAt) {
        const source = await db.doc(data.casePath).get(); const s = source.data();
        if (s && (caseClosed.has(s.status) || terminal.has(s.status))) { const closure = s.resolvedAt ?? s.closedAt ?? s.completedAt ?? s.cancelledAt ?? s.updatedAt ?? now; const expiresAt = stamp(closure.toMillis() + 180 * DAY); await doc.ref.update({ expiresAt }); if (source.ref.path.startsWith("reports/") || source.ref.path.startsWith("transactionDisputes/")) await source.ref.set({ retentionPurpose: "Closed marketplace case", retentionExpiresAt: expiresAt }, { merge: true }); }
      }
    });
    await pages(db.collection(collection).where("expiresAt", "<=", now).orderBy("expiresAt"), async (doc) => { await storagePrefix(`accountDeletionEvidence/${doc.id}/`); await erase(doc.ref); });
  }
  for (const name of ["conversations", "transactions", "listingDeals", "listings", "transactionEvents", "publicReviews", "reports", "transactionDisputes"]) await pages(db.collection(name).where("retentionExpiresAt", "<=", now).orderBy("retentionExpiresAt"), async (doc) => {
    if (name === "transactions") {
      for (const offer of await linked("offers", ["transactionId"], [doc.id])) await erase(offer.ref);
      const lock = db.doc(`listingDeals/${doc.data().listingId}`); if ((await lock.get()).data()?.transactionId === doc.id) await erase(lock);
      await erase(db.doc(`intelligenceCompletions/${doc.id}`));
    }
    await erase(doc.ref);
  });
  for (const name of ["bids", "changes"]) await pages(db.collectionGroup(name).where("retentionExpiresAt", "<=", now).orderBy("retentionExpiresAt"), async (doc) => { await erase(doc.ref); });
  await pages(operations.where("state", "==", "completed").where("expiresAt", "<=", now).orderBy("expiresAt"), async (doc) => { await erase(lifecycleRef(doc.id)); await erase(doc.ref); });
}
export async function runDeletionMaintenance() {
  requireDeletionDemo();
  for (const state of ["pending", "failed", "cleaning"]) await pages(operations.where("state", "==", state), async (doc) => { await processAccountDeletion(doc.id); });
  await enforceDeletionRetention();
}
export const processAccountDeletions = onSchedule({ schedule: "every 5 minutes", timeZone: "UTC", timeoutSeconds: 540 }, runDeletionMaintenance);
