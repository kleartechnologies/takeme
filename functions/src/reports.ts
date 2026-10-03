import { marketplaceMutationCall, runGuardedTransaction } from "./account-lifecycle";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();
const reasons: Record<string, string[]> = {
  listing: ["prohibited_item", "counterfeit", "misleading", "wrong_category", "spam", "other"],
  user: ["suspicious_behavior", "harassment", "fraud_concern", "other"],
  conversation: ["harassment", "fraud_concern", "spam", "other"],
  message: ["harassment", "fraud_concern", "spam", "other"],
};
function id(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid target."); return value; }

export const submitMarketplaceReport = marketplaceMutationCall(async (request) => {
  const reporterId = request.auth?.uid;
  if (!reporterId) throw new HttpsError("unauthenticated", "Sign in to report content.");
  const targetType = String(request.data?.targetType ?? "");
  const targetId = id(request.data?.targetId);
  const reason = String(request.data?.reason ?? "");
  if (!reasons[targetType]?.includes(reason)) throw new HttpsError("invalid-argument", "Choose a valid reason.");
  const details = typeof request.data?.details === "string" ? request.data.details.trim() : "";
  if (details.length > 1000) throw new HttpsError("invalid-argument", "Details must be at most 1000 characters.");
  const conversationId = ["conversation", "message"].includes(targetType) ? id(request.data?.conversationId ?? (targetType === "conversation" ? targetId : null)) : null;
  let listingId: string | null = null; let userId: string | null = null;
  if (targetType === "listing") {
    const listing = await db.collection("listings").doc(targetId).get();
    if (!listing.exists || !["active", "ended", "sold"].includes(String(listing.data()?.status))) throw new HttpsError("not-found", "Listing not found.");
    listingId = targetId; userId = listing.data()?.sellerId ?? null;
    if (userId === reporterId) throw new HttpsError("failed-precondition", "You cannot report your own listing.");
  } else if (targetType === "user") {
    const user = await db.collection("users").doc(targetId).get();
    if (!user.exists || targetId === reporterId) throw new HttpsError("failed-precondition", "This seller cannot be reported.");
    userId = targetId;
  } else if (conversationId) {
    const conversation = await db.collection("conversations").doc(conversationId).get();
    const data = conversation.data();
    if (!data || ![data.buyerId, data.sellerId].includes(reporterId)) throw new HttpsError("permission-denied", "This conversation is private.");
    if (targetType === "conversation" && targetId !== conversationId) throw new HttpsError("invalid-argument", "Conversation mismatch.");
    if (targetType === "message") {
      const message = await conversation.ref.collection("messages").doc(targetId).get();
      if (!message.exists || message.data()?.senderId === reporterId) throw new HttpsError("failed-precondition", "This message cannot be reported.");
    }
    listingId = data.listingId; userId = data.buyerId === reporterId ? data.sellerId : data.buyerId;
  }
  const ref = db.collection("reports").doc(`${targetType}-${targetId}-${reporterId}`);
  await runGuardedTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists) return;
    const now = Timestamp.now();
    tx.create(ref, { id: ref.id, reporterId, targetType, targetId, conversationId, listingId, userId, reason, details, status: "submitted", resolution: "", internalNotes: "", createdAt: now, updatedAt: now });
  });
  return { reportId: ref.id, submitted: true };
});
