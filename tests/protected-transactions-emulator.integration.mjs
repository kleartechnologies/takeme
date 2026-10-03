import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, getIdToken } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

// All records in this file are isolated demo-takeme emulator fixtures. Never run it against production.
const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdmin({ projectId }, `phase11-admin-${Date.now()}`);
const admin = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };

async function client(label, signedIn = true) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  if (signedIn) { await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword()); await acceptDemoPolicies(app); }
  return { app, auth, db, functions, uid: auth.currentUser?.uid };
}
const call = (person, name, data = {}) => httpsCallable(person.functions, name)(data).then((result) => result.data);
const [seller, buyer, outsider, operator, guest] = await Promise.all([client("phase11-seller"), client("phase11-buyer"), client("phase11-outsider"), client("phase11-operator"), client("phase11-guest", false)]);
await adminAuth.setCustomUserClaims(operator.uid, { admin: true });
await getIdToken(operator.auth.currentUser, true);

const policy = await call(guest, "getProtectedPaymentPolicy");
assert.equal(policy.enabled, false);
assert.equal(policy.implementationReady, false);
assert.equal(policy.provider, "stripe_connect");
assert.match(policy.message, /coming soon/i);
const onboarding = await call(seller, "getSellerPaymentOnboarding");
assert.equal(onboarding.status, "not_started");
assert.equal(onboarding.enabled, false);
assert.equal("providerAccountReference" in onboarding, false);

const now = Timestamp.now();
const listingId = `phase11-standard-listing-${suffix}`;
await admin.doc(`listings/${listingId}`).set({ id: listingId, sellerId: seller.uid, title: "Phase eleven standard camera", description: "A complete standard-flow emulator listing for regression coverage.", categoryId: "electronics", condition: "Good", price: 1250, listingType: "buy_now", location: "Kuala Lumpur", locationKey: "kuala lumpur", imageUrls: ["/brand/takeme-app-icon.png"], searchTokens: ["camera"], facetKeys: ["*|*|*|*"], status: "active", createdAt: now, updatedAt: now });
const request = await call(buyer, "submitOffer", { listingId, type: "buy_now", paymentMethod: "cod" });
const accepted = await call(seller, "respondToOffer", { offerId: request.offerId, action: "accept" });
const standard = (await admin.doc(`transactions/${accepted.transactionId}`).get()).data();
assert.equal(standard.settlementMode, "standard");
assert.equal(standard.paymentProvider, "none");
assert.equal((await admin.doc(`protectedPayments/${accepted.transactionId}`).get()).exists, false);
await call(buyer, "confirmTransactionCompletion", { transactionId: accepted.transactionId });
await call(seller, "confirmTransactionCompletion", { transactionId: accepted.transactionId });
assert.equal((await admin.doc(`transactions/${accepted.transactionId}`).get()).data().status, "completed");
const beforeProtectedMetrics = await call(operator, "getAdminMetrics", { section: "transactions", preset: "all" });
const card = (metrics, label) => metrics.cards.find((item) => item.label === label).value;

const protectedId = `phase11-protected-${suffix}`;
const protectedListingId = `phase11-protected-listing-${suffix}`;
const protectedBase = { listingId: protectedListingId, listingTitle: "Phase eleven protected fixture", categoryId: "electronics", buyerId: buyer.uid, sellerId: seller.uid, type: "buy_now", sourceId: `fixture-${suffix}`, status: "in_progress", amountSen: 250000, currency: "MYR", paymentMethod: "protected", settlementMode: "protected", paymentProvider: "stripe_connect", buyerConfirmedAt: null, sellerConfirmedAt: null, cancellationRequestedBy: null, cancellationReason: null, disputeReason: null, reviewCount: 0, reviewsVisibleAt: null, reviewWindowEndAt: null, createdAt: now, updatedAt: now, completedAt: null, cancelledAt: null };
await admin.doc(`transactions/${protectedId}`).set(protectedBase);
await admin.doc(`protectedPayments/${protectedId}`).set({ transactionId: protectedId, provider: "stripe_connect", providerReference: `provider-private-${suffix}`, status: "protected", protectedAmountSen: 250000, currency: "MYR", platformFeeSen: 5000, sellerNetAmountSen: 245000, paidAt: now, protectedAt: now, releasedAt: null, refundedAt: null, internalNotes: "admin only" });
await admin.doc(`payouts/${protectedId}`).set({ transactionId: protectedId, status: "not_eligible", amountSen: 245000, providerReference: null, eligibleAt: null, paidAt: null });
await admin.doc(`transactionEvents/phase11-created-${suffix}`).set({ transactionId: protectedId, eventType: "payment_protected", actorType: "provider", actorId: null, providerReference: `provider-private-${suffix}`, metadata: {}, createdAt: now });

await assert.rejects(() => call(buyer, "createProtectedPayment", { transactionId: protectedId }), /not enabled|failed-precondition/i);
assert.equal((await admin.collection("protectedPayments").where("transactionId", "==", protectedId).get()).size, 1);
await assert.rejects(() => call(outsider, "createProtectedPayment", { transactionId: protectedId }), /only the buyer|permission/i);
await assert.rejects(() => call(buyer, "confirmTransactionCompletion", { transactionId: protectedId }), /provider-confirmed|protected/i);
await assert.rejects(() => call(seller, "requestTransactionCancellation", { transactionId: protectedId, reason: "try bypass" }), /protected|refund workflow/i);
await assert.rejects(() => call(seller, "disputeTransaction", { transactionId: protectedId, reason: "seller attempt" }), /only the buyer|permission/i);

for (const path of [`protectedPayments/${protectedId}`, `payouts/${protectedId}`, `sellerPaymentProfiles/${seller.uid}`, `transactionEvents/phase11-created-${suffix}`, `paymentProviderEvents/fake-${suffix}`]) {
  await assert.rejects(() => getDoc(doc(buyer.db, path)), /permission/i);
  await assert.rejects(() => setDoc(doc(buyer.db, path), { status: "paid", amountSen: 1 }), /permission/i);
}
await assert.rejects(() => getDoc(doc(operator.db, `protectedPayments/${protectedId}`)), /permission/i);
await assert.rejects(() => setDoc(doc(seller.db, `refunds/fake-${suffix}`), { transactionId: protectedId, amountSen: 250000, status: "refunded" }), /permission/i);
await assert.rejects(() => updateDoc(doc(buyer.db, `transactions/${protectedId}`), { status: "completed", paymentStatus: "released" }), /permission/i);

const opened = await call(buyer, "disputeTransaction", { transactionId: protectedId, reason: "Item differs from the description" });
assert.equal(opened.status, "disputed");
const duplicateOpen = await call(buyer, "disputeTransaction", { transactionId: protectedId, reason: "Item differs from the description" });
assert.equal(duplicateOpen.alreadyOpened, true);
await assert.rejects(() => call(outsider, "getTransactionDetail", { transactionId: protectedId }), /not yours|permission/i);

const participantDetail = await call(buyer, "getTransactionDetail", { transactionId: protectedId });
assert.equal(participantDetail.transaction.status, "disputed");
assert.equal(participantDetail.transaction.settlementMode, "protected");
assert.equal(participantDetail.payment.status, "protected");
assert.equal(participantDetail.payout.status, "not_eligible");
assert.equal(participantDetail.dispute.status, "awaiting_seller");
assert.equal(participantDetail.timeline.some((event) => event.eventType === "dispute_opened"), true);
assert.equal("providerReference" in participantDetail.payment, false);
assert.equal(JSON.stringify(participantDetail).includes("admin only"), false);
assert.equal(JSON.stringify(participantDetail).includes(`provider-private-${suffix}`), false);

const response = await call(seller, "respondToProtectedDispute", { transactionId: protectedId, response: "I have delivery photos and the original listing details." });
assert.equal(response.status, "under_review");
const duplicateResponse = await call(seller, "respondToProtectedDispute", { transactionId: protectedId, response: "I have delivery photos and the original listing details." });
assert.equal(duplicateResponse.alreadyRecorded, true);
await assert.rejects(() => call(outsider, "respondToProtectedDispute", { transactionId: protectedId, response: "forged" }), /only the transaction seller|permission/i);

const evidence = await call(buyer, "addProtectedDisputeEvidence", { transactionId: protectedId, note: "Package photo retained for review.", idempotencyKey: `buyer-evidence-${suffix}` });
const duplicateEvidence = await call(buyer, "addProtectedDisputeEvidence", { transactionId: protectedId, note: "Package photo retained for review.", idempotencyKey: `buyer-evidence-${suffix}` });
assert.equal(evidence.evidenceId, duplicateEvidence.evidenceId);
assert.equal(duplicateEvidence.alreadyRecorded, true);
await assert.rejects(() => call(outsider, "addProtectedDisputeEvidence", { transactionId: protectedId, note: "forged", idempotencyKey: `outsider-${suffix}` }), /not yours|permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `transactionDisputes/${protectedId}/evidence/forged`), { note: "forged" }), /permission/i);

const afterDispute = await call(buyer, "getTransactionDetail", { transactionId: protectedId });
assert.equal(afterDispute.dispute.status, "under_review");
assert.equal(afterDispute.dispute.evidence.length, 1);
assert.equal(afterDispute.timeline.filter((event) => event.eventType === "evidence_added").length, 1);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId: protectedId, rating: 5, tags: [], comment: "premature" }), /complete|window/i);
assert.equal((await admin.doc(`marketplaceEvents/transaction-completed-${protectedId}`).get()).exists, false);
assert.equal((await admin.doc(`trustSummaries/${buyer.uid}`).get()).data().buyer.completedCount, 1);

const adminRecord = await call(operator, "getAdminRecord", { section: "transactions", id: protectedId });
assert.equal(adminRecord.detail.protectedPayment.providerReference, `provider-private-${suffix}`);
assert.equal(adminRecord.detail.protectedDispute.internalNotes, null);
assert.equal(adminRecord.detail.financialActionsEnabled, false);
assert.equal(adminRecord.detail.auditTimeline.some((event) => event.eventType === "dispute_opened"), true);
const afterProtectedMetrics = await call(operator, "getAdminMetrics", { section: "transactions", preset: "all" });
assert.ok(card(afterProtectedMetrics, "Protected transactions") >= 1);
assert.equal(card(afterProtectedMetrics, "GMV"), card(beforeProtectedMetrics, "GMV"));

await Promise.all([seller, buyer, outsider, operator, guest].map(({ app }) => deleteApp(app)));
await deleteAdmin(adminApp);
console.log("Protected transaction integration passed: disabled provider, standard regression, participant/admin projections, rules, disputes, evidence, idempotency and no completion credit.");
