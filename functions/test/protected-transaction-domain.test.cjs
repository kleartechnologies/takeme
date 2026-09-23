const assert = require("node:assert/strict");
const test = require("node:test");
const {
  legitimateGmv,
  protectedAuditEventId,
  protectedCompletionEligible,
  standardPaymentFields,
  transitionPayout,
  transitionProtectedPayment,
  transitionRefund,
  validRefundAmount,
} = require("../lib/protected-transaction-domain.js");
const { protectedPaymentsConfig, protectedPaymentProvider } = require("../lib/payments/stripe-connect-provider.js");

test("standard settlement stays unchanged and the Stripe provider is fail-closed", async () => {
  assert.deepEqual(standardPaymentFields(), { settlementMode: "standard", paymentProvider: "none" });
  assert.equal(protectedPaymentsConfig.enabled, false);
  assert.equal(protectedPaymentsConfig.implementationReady, false);
  assert.equal(protectedPaymentProvider.enabled, false);
  await assert.rejects(() => protectedPaymentProvider.createProtectedPayment({}), /not enabled/i);
});

test("payment transitions validate order and duplicate delivery is idempotent", () => {
  assert.deepEqual(transitionProtectedPayment("pending", "authorized"), { state: "authorized", changed: true });
  assert.deepEqual(transitionProtectedPayment("authorized", "authorized"), { state: "authorized", changed: false });
  assert.deepEqual(transitionProtectedPayment("failed", "pending"), { state: "pending", changed: true });
  assert.throws(() => transitionProtectedPayment("pending", "released"), /invalid transition/i);
  assert.throws(() => transitionProtectedPayment("refunded", "pending"), /invalid transition/i);
});

test("payout cannot skip eligibility, retries are visible, and duplicates do not advance twice", () => {
  assert.throws(() => transitionPayout("not_eligible", "processing"), /invalid transition/i);
  assert.deepEqual(transitionPayout("not_eligible", "eligible"), { state: "eligible", changed: true });
  assert.deepEqual(transitionPayout("processing", "failed"), { state: "failed", changed: true });
  assert.deepEqual(transitionPayout("failed", "processing"), { state: "processing", changed: true });
  assert.deepEqual(transitionPayout("paid", "paid"), { state: "paid", changed: false });
});

test("refunds stay within the protected integer-sen amount and do not imply completion", () => {
  assert.equal(validRefundAmount(5000, 10000), true);
  assert.equal(validRefundAmount(5001, 10000, 5000), false);
  assert.equal(validRefundAmount(1.5, 10000), false);
  assert.equal(validRefundAmount(-1, 10000), false);
  assert.deepEqual(transitionRefund("processing", "refunded"), { state: "refunded", changed: true });
  assert.deepEqual(transitionRefund("refunded", "refunded"), { state: "refunded", changed: false });
  assert.throws(() => transitionRefund("requested", "refunded"), /invalid transition/i);
  assert.equal(protectedCompletionEligible({ paymentStatus: "refunded", payoutStatus: "not_eligible", fulfilmentStatus: "received" }), false);
});

test("protected completion requires independent settlement, payout, fulfilment, and dispute state", () => {
  assert.equal(protectedCompletionEligible({ paymentStatus: "released", payoutStatus: "paid", fulfilmentStatus: "received" }), true);
  assert.equal(protectedCompletionEligible({ paymentStatus: "protected", payoutStatus: "paid", fulfilmentStatus: "received" }), false);
  assert.equal(protectedCompletionEligible({ paymentStatus: "released", payoutStatus: "eligible", fulfilmentStatus: "received" }), false);
  assert.equal(protectedCompletionEligible({ paymentStatus: "released", payoutStatus: "paid", fulfilmentStatus: "delivered" }), false);
  assert.equal(protectedCompletionEligible({ paymentStatus: "released", payoutStatus: "paid", fulfilmentStatus: "received", disputeStatus: "under_review" }), false);
  assert.equal(protectedCompletionEligible({ paymentStatus: "released", payoutStatus: "paid", fulfilmentStatus: "received", disputeStatus: "resolved_seller" }), true);
});

test("GMV counts legitimate completions only and keeps payment state separate", () => {
  assert.equal(legitimateGmv({ status: "completed", amountSen: 25000, buyerId: "b", sellerId: "s", settlementMode: "standard" }), 25000);
  assert.equal(legitimateGmv({ status: "in_progress", amountSen: 25000, buyerId: "b", sellerId: "s", settlementMode: "protected", paymentStatus: "protected" }), 0);
  assert.equal(legitimateGmv({ status: "completed", amountSen: 25000, buyerId: "b", sellerId: "s", settlementMode: "protected", paymentStatus: "protected", payoutStatus: "processing" }), 0);
  assert.equal(legitimateGmv({ status: "cancelled", amountSen: 25000, buyerId: "b", sellerId: "s", settlementMode: "protected", paymentStatus: "refunded" }), 0);
  assert.equal(legitimateGmv({ status: "completed", amountSen: 25000, buyerId: "b", sellerId: "s", settlementMode: "protected", paymentStatus: "released", payoutStatus: "paid" }), 25000);
  assert.equal(legitimateGmv({ status: "completed", amountSen: 25000, buyerId: "same", sellerId: "same" }), 0);
});

test("audit IDs deduplicate one logical event without colliding with another", () => {
  const first = protectedAuditEventId("tx-1", "payment_protected", "provider-event-1");
  assert.equal(first, protectedAuditEventId("tx-1", "payment_protected", "provider-event-1"));
  assert.notEqual(first, protectedAuditEventId("tx-1", "payment_protected", "provider-event-2"));
  assert.equal(first.length, 64);
});
