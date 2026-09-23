import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("buyer selection is honest, disabled, and has no protected checkout action", () => {
  const panel = source("src/components/transactions/listing-deal-panel.tsx");
  assert.match(panel, /TAKEME Protected Transaction/);
  assert.match(panel, /Protected payments coming soon/);
  assert.match(panel, /disabled/);
  assert.doesNotMatch(panel, />Pay now</i);
});

test("participant, seller, and admin surfaces represent protected state without money actions", () => {
  const transaction = source("src/components/transactions/transaction-view.tsx");
  assert.match(transaction, /REAL PAYMENT MOVEMENT IS NOT ENABLED/);
  assert.match(transaction, /Transaction timeline/);
  assert.match(transaction, /respondToProtectedDispute/);
  assert.match(transaction, /addProtectedDisputeEvidence/);
  const seller = source("src/components/transactions/seller-payment-status.tsx");
  assert.match(seller, /Protected payments are not enabled yet/);
  const admin = source("src/components/admin/admin-record.tsx");
  assert.match(admin, /No payment, refund or payout action is available/);
});

test("provider stub and rules stay fail-closed", () => {
  const provider = source("functions/src/payments/stripe-connect-provider.ts");
  assert.match(provider, /readonly enabled = false/);
  assert.match(provider, /implementationReady: false/);
  assert.doesNotMatch(source("functions/package.json"), /stripe/);
  const rules = source("firestore.rules");
  for (const collection of ["protectedPayments", "payouts", "refunds", "sellerPaymentProfiles", "transactionDisputes", "transactionEvents", "paymentProviderEvents"]) {
    assert.match(rules, new RegExp(`match \\/${collection}`));
  }
});

test("architecture and mobile documentation carry the disabled warning", () => {
  for (const path of ["docs/protected-transactions.md", "docs/mobile-protected-transactions.md"]) {
    const document = source(path);
    assert.match(document, /REAL PAYMENT MOVEMENT NOT ENABLED/);
    assert.match(document, /idempoten/i);
  }
});
