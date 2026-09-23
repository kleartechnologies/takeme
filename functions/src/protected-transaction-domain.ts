import { createHash } from "node:crypto";

export type SettlementMode = "standard" | "protected";
export type ProtectedPaymentStatus = "not_required" | "pending" | "requires_action" | "authorized" | "protected" | "failed" | "refunded" | "partially_refunded" | "released" | "cancelled";
export type PayoutStatus = "not_eligible" | "eligible" | "processing" | "paid" | "failed" | "reversed";
export type RefundStatus = "none" | "requested" | "pending" | "approved" | "processing" | "refunded" | "failed" | "partially_refunded" | "cancelled";
export type SellerOnboardingStatus = "not_started" | "pending" | "restricted" | "active" | "disabled";
export type ProtectedDisputeStatus = "open" | "awaiting_buyer" | "awaiting_seller" | "under_review" | "resolved_buyer" | "resolved_seller" | "partially_resolved" | "cancelled";
export type FulfilmentStatus = "not_started" | "in_progress" | "shipped" | "delivered" | "received";

const paymentTransitions: Record<ProtectedPaymentStatus, readonly ProtectedPaymentStatus[]> = {
  not_required: [],
  pending: ["requires_action", "authorized", "failed", "cancelled"],
  requires_action: ["authorized", "failed", "cancelled"],
  authorized: ["protected", "failed", "cancelled"],
  protected: ["released", "refunded", "partially_refunded"],
  partially_refunded: ["released", "refunded"],
  failed: ["pending"],
  released: ["partially_refunded", "refunded"],
  refunded: [],
  cancelled: [],
};

const payoutTransitions: Record<PayoutStatus, readonly PayoutStatus[]> = {
  not_eligible: ["eligible"], eligible: ["processing"], processing: ["paid", "failed"], failed: ["processing"], paid: ["reversed"], reversed: [],
};

const refundTransitions: Record<RefundStatus, readonly RefundStatus[]> = {
  none: ["requested"], requested: ["pending", "approved", "cancelled"], pending: ["approved", "processing", "failed", "cancelled"],
  approved: ["processing", "cancelled"], processing: ["refunded", "partially_refunded", "failed"], failed: ["processing", "cancelled"],
  partially_refunded: ["requested", "processing", "refunded"], refunded: [], cancelled: [],
};

function transition<T extends string>(current: T, next: T, allowed: Record<T, readonly T[]>) {
  if (current === next) return { state: current, changed: false };
  if (!allowed[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}.`);
  return { state: next, changed: true };
}

export const transitionProtectedPayment = (current: ProtectedPaymentStatus, next: ProtectedPaymentStatus) => transition(current, next, paymentTransitions);
export const transitionPayout = (current: PayoutStatus, next: PayoutStatus) => transition(current, next, payoutTransitions);
export const transitionRefund = (current: RefundStatus, next: RefundStatus) => transition(current, next, refundTransitions);

export function validRefundAmount(amountSen: unknown, protectedAmountSen: unknown, alreadyRefundedSen = 0) {
  return Number.isSafeInteger(amountSen) && Number(amountSen) > 0 && Number.isSafeInteger(protectedAmountSen)
    && Number(protectedAmountSen) > 0 && Number.isSafeInteger(alreadyRefundedSen) && alreadyRefundedSen >= 0
    && Number(amountSen) + alreadyRefundedSen <= Number(protectedAmountSen);
}

export function protectedCompletionEligible(input: { paymentStatus: ProtectedPaymentStatus; payoutStatus: PayoutStatus; fulfilmentStatus: FulfilmentStatus; disputeStatus?: ProtectedDisputeStatus | null }) {
  return input.paymentStatus === "released" && input.payoutStatus === "paid" && input.fulfilmentStatus === "received"
    && (!input.disputeStatus || ["resolved_seller", "partially_resolved", "cancelled"].includes(input.disputeStatus));
}

export function legitimateGmv(input: { status: string; amountSen: unknown; buyerId?: string; sellerId?: string; settlementMode?: SettlementMode; paymentStatus?: ProtectedPaymentStatus; payoutStatus?: PayoutStatus }) {
  if (input.status !== "completed" || !Number.isSafeInteger(input.amountSen) || Number(input.amountSen) <= 0 || input.buyerId === input.sellerId) return 0;
  if ((input.settlementMode ?? "standard") === "standard") return Number(input.amountSen);
  return input.paymentStatus === "released" && input.payoutStatus === "paid" ? Number(input.amountSen) : 0;
}

export function protectedAuditEventId(transactionId: string, eventType: string, idempotencyKey: string) {
  return createHash("sha256").update(`${transactionId}|${eventType}|${idempotencyKey}`).digest("hex");
}

export const PROTECTED_AUDIT_EVENTS = [
  "transaction_created", "payment_created", "payment_authorized", "payment_protected", "seller_fulfilment_started", "shipment_recorded",
  "delivery_recorded", "buyer_received", "dispute_opened", "evidence_added", "seller_response_added", "dispute_resolved",
  "refund_requested", "refund_completed", "payout_eligible", "payout_started", "payout_completed", "transaction_completed",
] as const;

export function standardPaymentFields() {
  return { settlementMode: "standard" as const, paymentProvider: "none" as const };
}
