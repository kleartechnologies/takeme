import { marketplaceCall as onCall, runGuardedTransaction, accountIsActive } from "./account-lifecycle";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const db = getFirestore();
function uid(value: string | undefined) { if (!value) throw new HttpsError("unauthenticated", "Sign in to use messages."); return value; }
function id(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid ID."); return value; }
function iso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : null; }
function participant(data: FirebaseFirestore.DocumentData | undefined, userId: string) {
  if (!data || ![data.buyerId, data.sellerId].includes(userId)) throw new HttpsError("permission-denied", "This conversation is private.");
}
function summary(snapshot: FirebaseFirestore.DocumentSnapshot) {
  const data = snapshot.data()!;
  return { id: snapshot.id, listingId: data.listingId, listingTitle: data.listingTitle ?? "Listing", listingImage: data.listingImage ?? null, sellerId: data.sellerId, buyerId: data.buyerId, transactionId: data.transactionId ?? null, status: data.status ?? "open", latestMessage: data.latestMessage ?? null, lastMessageAt: iso(data.lastMessageAt), updatedAt: iso(data.updatedAt), unreadBy: data.unreadBy ?? {} };
}
function baseConversation(listing: FirebaseFirestore.DocumentData, listingId: string, buyerId: string, now: Timestamp, transactionId: string | null = null) {
  return { id: `${listingId}_${buyerId}`, listingId, listingTitle: String(listing.title ?? "Listing").slice(0, 80), listingImage: Array.isArray(listing.imageUrls) && typeof listing.imageUrls[0] === "string" ? listing.imageUrls[0] : null, sellerId: listing.sellerId, buyerId, participants: [buyerId, listing.sellerId], transactionId, status: "open", latestMessage: null, lastMessageAt: null, unreadBy: { [buyerId]: 0, [listing.sellerId]: 0 }, createdAt: now, updatedAt: now };
}

export const openListingConversation = onCall(async (request) => {
  const buyerId = uid(request.auth?.uid);
  const listingId = id(request.data?.listingId);
  const ref = db.collection("conversations").doc(`${listingId}_${buyerId}`);
  const listingRef = db.collection("listings").doc(listingId);
  await runGuardedTransaction(db, async (tx) => {
    const [existing, listing] = await Promise.all([tx.get(ref), tx.get(listingRef)]);
    if (existing.exists) { participant(existing.data(), buyerId); return; }
    const data = listing.data();
    if (!data || data.status !== "active" || data.sellerId === buyerId || (data.listingType === "auction" && (data.auctionStatus === "ended" || data.auctionStatus === "cancelled" || data.auctionEndAt instanceof Timestamp && data.auctionEndAt.toMillis() <= Date.now()))) throw new HttpsError("failed-precondition", "This listing cannot start a conversation.");
    if (!(await accountIsActive(data.sellerId, tx))) throw new HttpsError("failed-precondition", "This seller is unavailable.");
    tx.create(ref, baseConversation(data, listingId, buyerId, Timestamp.now()));
  });
  return { conversationId: ref.id };
});

export const openTransactionConversation = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const transactionId = id(request.data?.transactionId);
  const transaction = await db.collection("transactions").doc(transactionId).get();
  const data = transaction.data();
  if (!data || ![data.buyerId, data.sellerId].includes(userId)) throw new HttpsError("permission-denied", "This transaction is private.");
  const listingId = id(data.listingId);
  const ref = db.collection("conversations").doc(`${listingId}_${data.buyerId}`);
  await runGuardedTransaction(db, async (tx) => {
    if (!(await accountIsActive(data.buyerId, tx)) || !(await accountIsActive(data.sellerId, tx))) throw new HttpsError("failed-precondition", "A participant is unavailable. Use existing transaction resolution actions.");
    const [existing, listing] = await Promise.all([tx.get(ref), tx.get(db.collection("listings").doc(listingId))]);
    if (existing.exists) {
      const current = existing.data();
      if (current?.buyerId !== data.buyerId || current?.sellerId !== data.sellerId || current?.listingId !== listingId) throw new HttpsError("failed-precondition", "Conversation mismatch.");
      if (current?.transactionId && current.transactionId !== transactionId) throw new HttpsError("failed-precondition", "Conversation belongs to another transaction.");
      if (!current?.transactionId) tx.update(ref, { transactionId, updatedAt: Timestamp.now() });
      return;
    }
    const listingData = listing.data();
    if (!listingData || listingData.sellerId !== data.sellerId) throw new HttpsError("failed-precondition", "Listing and transaction do not match.");
    tx.create(ref, baseConversation(listingData, listingId, data.buyerId, Timestamp.now(), transactionId));
  });
  return { conversationId: ref.id };
});

export const getConversation = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const ref = db.collection("conversations").doc(id(request.data?.conversationId));
  const snapshot = await ref.get();
  participant(snapshot.data(), userId);
  const otherId = snapshot.data()!.buyerId === userId ? snapshot.data()!.sellerId : snapshot.data()!.buyerId;
  const other = await db.collection("users").doc(otherId).get();
  return { conversation: { ...summary(snapshot), otherId, otherName: String(other.data()?.displayName ?? "Deleted user") } };
});

export const getConversations = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const cursor = request.data?.cursor ? id(request.data.cursor) : null;
  const ref = db.collection("conversations");
  const base = ref.where("participants", "array-contains", userId).orderBy("updatedAt", "desc");
  const cursorDoc = cursor ? await ref.doc(cursor).get() : null;
  if (cursor && (!cursorDoc?.exists || !cursorDoc.data()?.participants?.includes(userId))) throw new HttpsError("invalid-argument", "Invalid cursor.");
  const page = await (cursorDoc ? base.startAfter(cursorDoc) : base).limit(21).get();
  const visible = page.docs.slice(0, 20);
  const otherIds = visible.map((item) => item.data().buyerId === userId ? item.data().sellerId : item.data().buyerId);
  const profiles = otherIds.length ? await db.getAll(...otherIds.map((otherId) => db.collection("users").doc(otherId))) : [];
  return { items: visible.map((item, index) => ({ ...summary(item), otherId: otherIds[index], otherName: String(profiles[index]?.data()?.displayName ?? "Deleted user"), unreadCount: Math.max(0, Number(item.data().unreadBy?.[userId] ?? 0)) })), cursor: visible.at(-1)?.id ?? null, hasMore: page.size > 20 };
});

export const getConversationMessages = onCall(async (request) => {
  const userId = uid(request.auth?.uid);
  const conversationId = id(request.data?.conversationId);
  const ref = db.collection("conversations").doc(conversationId);
  const conversation = await ref.get(); participant(conversation.data(), userId);
  const cursor = request.data?.cursor ? id(request.data.cursor) : null;
  const messages = ref.collection("messages");
  const cursorDoc = cursor ? await messages.doc(cursor).get() : null;
  if (cursor && !cursorDoc?.exists) throw new HttpsError("invalid-argument", "Invalid cursor.");
  const base = messages.orderBy("createdAt", "desc");
  const page = await (cursorDoc ? base.startAfter(cursorDoc) : base).limit(21).get();
  const visible = page.docs.slice(0, 20);
  return { items: visible.map((item) => ({ id: item.id, senderId: item.data().senderId, body: item.data().body, createdAt: iso(item.data().createdAt) })), cursor: visible.at(-1)?.id ?? null, hasMore: page.size > 20 };
});

export const sendConversationMessage = onCall(async (request) => {
  const senderId = uid(request.auth?.uid);
  const conversationId = id(request.data?.conversationId);
  if (typeof request.data?.body !== "string") throw new HttpsError("invalid-argument", "Enter a message.");
  const body = request.data.body.trim().replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n");
  if (!body || body.length > 2000) throw new HttpsError("invalid-argument", "Message must be 1–2000 characters.");
  const ref = db.collection("conversations").doc(conversationId);
  const messageRef = ref.collection("messages").doc();
  await runGuardedTransaction(db, async (tx) => {
    const conversation = await tx.get(ref); const data = conversation.data(); participant(data, senderId);
    if (data?.status === "closed") throw new HttpsError("failed-precondition", "This conversation is closed.");
    const otherId = data!.buyerId === senderId ? data!.sellerId : data!.buyerId;
    if (!(await accountIsActive(otherId, tx))) throw new HttpsError("failed-precondition", "This account is unavailable.");
    const now = Timestamp.now();
    tx.create(messageRef, { id: messageRef.id, senderId, body, createdAt: now });
    tx.update(ref, { latestMessage: body.slice(0, 120), lastMessageAt: now, updatedAt: now, [`unreadBy.${otherId}`]: Math.max(0, Number(data!.unreadBy?.[otherId] ?? 0)) + 1 });
  });
  return { messageId: messageRef.id };
});

export const markConversationSeen = onCall(async (request) => {
  const userId = uid(request.auth?.uid); const ref = db.collection("conversations").doc(id(request.data?.conversationId));
  await runGuardedTransaction(db, async (tx) => { const current = await tx.get(ref); participant(current.data(), userId); tx.update(ref, { [`unreadBy.${userId}`]: 0 }); });
  return { seen: true };
});

export const onTransactionConversationCreated = onDocumentCreated("transactions/{transactionId}", async (event) => {
  const data = event.data?.data(); if (!data?.listingId || !data?.buyerId || !data?.sellerId) return;
  const listingId = String(data.listingId); const buyerId = String(data.buyerId); const transactionId = event.params.transactionId;
  const ref = db.collection("conversations").doc(`${listingId}_${buyerId}`);
  await runGuardedTransaction(db, async (tx) => {
    if (!(await accountIsActive(buyerId, tx)) || !(await accountIsActive(data.sellerId, tx))) return;
    const [current, listing] = await Promise.all([tx.get(ref), tx.get(db.collection("listings").doc(listingId))]);
    if (current.exists) {
      const existing = current.data();
      if (existing?.buyerId === buyerId && existing?.sellerId === data.sellerId && existing?.listingId === listingId && !existing?.transactionId) tx.update(ref, { transactionId, updatedAt: Timestamp.now() });
      return;
    }
    const listingData = listing.data(); if (!listingData || listingData.sellerId !== data.sellerId) return;
    tx.create(ref, baseConversation(listingData, listingId, buyerId, Timestamp.now(), transactionId));
  });
});
