import { Timestamp, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { ReportReason, ReportTargetType, RoleReputation, TrustSummary } from "@/types/marketplace";

function role(data: Record<string, unknown> | undefined): RoleReputation {
  return { completedCount: Number(data?.completedCount ?? 0), tier: (data?.tier ?? null) as RoleReputation["tier"],
    reviewCount: Number(data?.reviewCount ?? 0), ratingSum: Number(data?.ratingSum ?? 0),
    averageRating: typeof data?.averageRating === "number" ? data.averageRating : null,
    ratingDistribution: (data?.ratingDistribution ?? {}) as Record<string, number> };
}

export async function getTrustSummary(uid: string): Promise<TrustSummary | null> {
  if (!db) throw new Error("Firebase is not configured.");
  const result = await getDoc(doc(db, "trustSummaries", uid));
  if (!result.exists()) return null;
  const data = result.data();
  return { userId: result.id, verificationStatus: data.verificationStatus === "verified" ? "verified" : "unverified",
    buyer: role(data.buyer), seller: role(data.seller), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : "" } as TrustSummary;
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
