import { marketplaceCall as onCall, marketplaceMutationCall, resolutionMutationCall, runGuardedTransaction } from "./account-lifecycle";
import { getFirestore, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { protectedAuditEventId } from "./protected-transaction-domain";
import { protectedPaymentProvider, protectedPaymentsConfig } from "./payments/stripe-connect-provider";

const db = getFirestore();
const requiredId = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", `${label} is invalid.`);
  return value;
};
const requireUid = (value: string | undefined) => {
  if (!value) throw new HttpsError("unauthenticated", "Sign in to manage protected transactions.");
  return value;
};
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
const transactionRef = (transactionId: string) => db.collection("transactions").doc(transactionId);
const disputeRef = (transactionId: string) => db.collection("transactionDisputes").doc(transactionId);

export const getProtectedPaymentPolicy = onCall(async () => ({
  enabled: protectedPaymentsConfig.enabled,
  provider: protectedPaymentsConfig.provider,
  implementationReady: protectedPaymentsConfig.implementationReady,
  message: "Protected payments coming soon",
  legalNotice: "Protected transactions are designed to support eligible purchases and disputes under TAKEME's applicable terms.",
}));

export const getSellerPaymentOnboarding = onCall(async (request) => {
  const userId = requireUid(request.auth?.uid);
  const profile = await db.collection("sellerPaymentProfiles").doc(userId).get();
  const data = profile.data();
  return {
    enabled: protectedPaymentsConfig.enabled,
    provider: "stripe_connect" as const,
    status: data?.status ?? "not_started",
    chargesEnabled: data?.chargesEnabled === true,
    payoutsEnabled: data?.payoutsEnabled === true,
    requirementsStatus: typeof data?.requirementsStatus === "string" ? data.requirementsStatus : "not_available",
    lastCheckedAt: iso(data?.lastCheckedAt),
    message: "Protected payments are not enabled yet.",
  };
});

/** Deliberately non-operational until the provider, legal and rollout gates are approved. */
export const createProtectedPayment = marketplaceMutationCall(async (request) => {
  const userId = requireUid(request.auth?.uid);
  const transactionId = requiredId(request.data?.transactionId, "Transaction");
  const deal = await transactionRef(transactionId).get();
  if (!deal.exists || deal.data()?.buyerId !== userId) throw new HttpsError("permission-denied", "Only the buyer can start a protected payment.");
  if (!protectedPaymentsConfig.enabled || !protectedPaymentProvider.enabled) throw new HttpsError("failed-precondition", "Protected payments are not enabled yet.");
  throw new HttpsError("failed-precondition", "Protected payments are not enabled yet.");
});

export function writeProtectedAuditEvent(tx: Transaction, input: { transactionId: string; eventType: string; idempotencyKey: string; actorType: "buyer" | "seller" | "admin" | "provider" | "system"; actorId?: string | null; metadata?: Record<string, string | number | boolean | null> }, now: Timestamp) {
  const eventId = protectedAuditEventId(input.transactionId, input.eventType, input.idempotencyKey);
  tx.create(db.collection("transactionEvents").doc(eventId), {
    transactionId: input.transactionId, eventType: input.eventType, actorType: input.actorType, actorId: input.actorId ?? null,
    metadata: input.metadata ?? {}, provider: input.actorType === "provider" ? "stripe_connect" : null, providerReference: null,
    createdAt: now,
  });
  return eventId;
}

export function openProtectedDispute(tx: Transaction, transactionId: string, deal: DocumentData, buyerId: string, reason: string, now: Timestamp) {
  const ref = disputeRef(transactionId);
  tx.create(ref, {
    id: transactionId, transactionId, buyerId: deal.buyerId, sellerId: deal.sellerId, reason: "item_issue", description: reason,
    status: "awaiting_seller", openedBy: buyerId, openedAt: now, sellerResponse: null, resolution: null, resolvedBy: null,
    resolvedAt: null, refundAmountSen: null, internalNotes: null, updatedAt: now,
  });
  writeProtectedAuditEvent(tx, { transactionId, eventType: "dispute_opened", idempotencyKey: "buyer-open", actorType: "buyer", actorId: buyerId }, now);
}

export const respondToProtectedDispute = resolutionMutationCall(async (request) => {
  const sellerId = requireUid(request.auth?.uid);
  const transactionId = requiredId(request.data?.transactionId, "Transaction");
  const response = typeof request.data?.response === "string" ? request.data.response.trim().slice(0, 2000) : "";
  if (!response) throw new HttpsError("invalid-argument", "Provide a seller response.");
  return runGuardedTransaction(db, async (tx) => {
    const [deal, dispute] = await Promise.all([tx.get(transactionRef(transactionId)), tx.get(disputeRef(transactionId))]);
    if (!deal.exists || deal.data()?.sellerId !== sellerId) throw new HttpsError("permission-denied", "Only the transaction seller can respond.");
    if (!dispute.exists) throw new HttpsError("not-found", "Protected dispute not found.");
    const data = dispute.data()!;
    const restrictedCase = data.deletionEvidenceId ? db.doc(`accountDeletionEvidence/${data.deletionEvidenceId}/records/case`) : null;
    const held = restrictedCase ? await tx.get(restrictedCase) : null;
    if ((data.sellerResponse ?? held?.data()?.sellerResponse) === response && data.status === "under_review") return { status: "under_review", alreadyRecorded: true };
    if (data.status !== "awaiting_seller" || data.sellerResponse) throw new HttpsError("failed-precondition", "This dispute is not awaiting a seller response.");
    const now = Timestamp.now();
    if (restrictedCase) tx.set(restrictedCase, { sellerResponse: response }, { merge: true });
    tx.update(dispute.ref, { ...(restrictedCase ? {} : { sellerResponse: response }), status: "under_review", updatedAt: now });
    writeProtectedAuditEvent(tx, { transactionId, eventType: "seller_response_added", idempotencyKey: "seller-response", actorType: "seller", actorId: sellerId }, now);
    return { status: "under_review", alreadyRecorded: false };
  });
});

export const addProtectedDisputeEvidence = resolutionMutationCall(async (request) => {
  const userId = requireUid(request.auth?.uid);
  const transactionId = requiredId(request.data?.transactionId, "Transaction");
  const idempotencyKey = requiredId(request.data?.idempotencyKey, "Idempotency key");
  const note = typeof request.data?.note === "string" ? request.data.note.trim().slice(0, 1000) : "";
  if (!note) throw new HttpsError("invalid-argument", "Provide evidence notes.");
  return runGuardedTransaction(db, async (tx) => {
    const [deal, dispute] = await Promise.all([tx.get(transactionRef(transactionId)), tx.get(disputeRef(transactionId))]);
    const data = deal.data();
    if (!deal.exists || !data || ![data.buyerId, data.sellerId].includes(userId)) throw new HttpsError("permission-denied", "This transaction is not yours.");
    if (!dispute.exists || !["open", "awaiting_buyer", "awaiting_seller", "under_review"].includes(String(dispute.data()?.status))) throw new HttpsError("failed-precondition", "This dispute is not accepting evidence.");
    const evidenceId = protectedAuditEventId(transactionId, "evidence", `${userId}|${idempotencyKey}`);
    const evidenceRef = dispute.data()?.deletionEvidenceId ? db.doc(`accountDeletionEvidence/${dispute.data()!.deletionEvidenceId}/records/evidence-${evidenceId}`) : dispute.ref.collection("evidence").doc(evidenceId);
    const existing = await tx.get(evidenceRef);
    if (existing.exists) return { evidenceId, alreadyRecorded: true };
    const now = Timestamp.now();
    const actorRole = data.buyerId === userId ? "buyer" : "seller";
    tx.create(evidenceRef, { id: evidenceId, transactionId, actorId: userId, actorRole, note, createdAt: now });
    writeProtectedAuditEvent(tx, { transactionId, eventType: "evidence_added", idempotencyKey: evidenceId, actorType: actorRole, actorId: userId }, now);
    return { evidenceId, alreadyRecorded: false };
  });
});

export async function protectedTransactionDetail(transactionId: string) {
  const [payment, payout, dispute, refunds, events, evidence] = await Promise.all([
    db.collection("protectedPayments").doc(transactionId).get(), db.collection("payouts").doc(transactionId).get(), disputeRef(transactionId).get(),
    db.collection("refunds").where("transactionId", "==", transactionId).limit(20).get(),
    db.collection("transactionEvents").where("transactionId", "==", transactionId).limit(50).get(),
    disputeRef(transactionId).collection("evidence").limit(20).get(),
  ]);
  const paymentData = payment.data(); const payoutData = payout.data(); const disputeData = dispute.data();
  return {
    payment: payment.exists ? { provider: paymentData?.provider, status: paymentData?.status, protectedAmountSen: paymentData?.protectedAmountSen, currency: paymentData?.currency,
      platformFeeSen: paymentData?.platformFeeSen ?? null, sellerNetAmountSen: paymentData?.sellerNetAmountSen ?? null, paidAt: iso(paymentData?.paidAt), protectedAt: iso(paymentData?.protectedAt), releasedAt: iso(paymentData?.releasedAt), refundedAt: iso(paymentData?.refundedAt) } : null,
    payout: payout.exists ? { status: payoutData?.status, amountSen: payoutData?.amountSen ?? null, eligibleAt: iso(payoutData?.eligibleAt), paidAt: iso(payoutData?.paidAt) } : null,
    refunds: refunds.docs.map((item) => ({ id: item.id, status: item.data().status, amountSen: item.data().amountSen, reason: item.data().reason, requestedAt: iso(item.data().requestedAt), refundedAt: iso(item.data().refundedAt) })),
    dispute: dispute.exists ? { id: dispute.id, status: disputeData?.status, reason: disputeData?.reason, description: disputeData?.description, openedBy: disputeData?.openedBy,
      openedAt: iso(disputeData?.openedAt), sellerResponse: disputeData?.sellerResponse ?? null, resolution: disputeData?.resolution ?? null, resolvedAt: iso(disputeData?.resolvedAt), refundAmountSen: disputeData?.refundAmountSen ?? null,
      evidence: evidence.docs.map((item) => ({ id: item.id, actorRole: item.data().actorRole, note: item.data().note, createdAt: iso(item.data().createdAt) })) } : null,
    timeline: events.docs.map((item) => ({ id: item.id, eventType: item.data().eventType, actorType: item.data().actorType, createdAt: iso(item.data().createdAt), metadata: item.data().metadata ?? {} }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  };
}
