import { Timestamp, doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase/client";
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

export async function submitReport(input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details: string; conversationId?: string }) {
  if (!functions || !auth?.currentUser) throw new Error("Sign in to submit a report.");
  const result = await httpsCallable<typeof input, { reportId: string }>(functions, "submitMarketplaceReport")(input);
  return result.data.reportId;
}
