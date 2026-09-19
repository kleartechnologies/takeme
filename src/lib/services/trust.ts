import { Timestamp, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { ReportReason, ReportTargetType, TrustSummary } from "@/types/marketplace";

export const reputationPolicy = Object.freeze({
  levels: ["bronze", "silver", "gold", "platinum"] as const,
  enabled: false,
  // Thresholds require verified transaction aggregates and product approval.
  thresholds: null,
});

export async function getTrustSummary(uid: string): Promise<TrustSummary | null> {
  if (!db) throw new Error("Firebase is not configured.");
  const result = await getDoc(doc(db, "trustSummaries", uid));
  if (!result.exists()) return null;
  const data = result.data();
  return { userId: result.id, verificationStatus: data.verificationStatus, completedSellerTransactions: data.completedSellerTransactions, reviewCount: data.reviewCount, ratingSum: data.ratingSum, reputationLevel: data.reputationLevel, updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : "" } as TrustSummary;
}

export async function submitReport(input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details: string }) {
  if (!db || !auth?.currentUser) throw new Error("Sign in to submit a report.");
  if (!["listing", "user"].includes(input.targetType) || !["spam", "misleading", "prohibited_item", "harassment", "fraud_concern", "other"].includes(input.reason)) throw new Error("Choose a valid report reason.");
  const details = input.details.trim();
  if (!input.targetId || details.length > 1000) throw new Error("Report details must be at most 1000 characters.");
  const reference = doc(collection(db, "reports"));
  await setDoc(reference, { id: reference.id, reporterId: auth.currentUser.uid, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details, status: "submitted", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return reference.id;
}

export async function reviewCompletedTransaction(transactionId: string, rating: number, comment: string) {
  if (!db || !auth?.currentUser) throw new Error("Sign in to review a transaction.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.trim().length > 1000) throw new Error("Choose a rating from 1 to 5 and a comment under 1000 characters.");
  const uid = auth.currentUser.uid;
  const transaction = await getDoc(doc(db, "transactions", transactionId));
  if (!transaction.exists() || transaction.data().status !== "completed") throw new Error("Only completed transactions can be reviewed.");
  const data = transaction.data();
  if (uid !== data.buyerId && uid !== data.sellerId || data.buyerId === data.sellerId) throw new Error("You cannot review this transaction.");
  const reviewedUserId = uid === data.buyerId ? data.sellerId : data.buyerId;
  await setDoc(doc(db, "transactions", transactionId, "reviews", uid), { transactionId, buyerId: data.buyerId, sellerId: data.sellerId, reviewerId: uid, reviewedUserId, rating, comment: comment.trim(), createdAt: serverTimestamp() });
}
