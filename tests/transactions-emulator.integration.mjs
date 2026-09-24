import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdmin({ projectId }, `transaction-admin-${Date.now()}`);
const admin = getAdminFirestore(adminApp);
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
  if (signedIn) await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, db, functions, uid: auth.currentUser?.uid };
}
const call = (person, name, data = {}) => httpsCallable(person.functions, name)(data).then((result) => result.data);
async function eventually(check, label) {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
const [seller, buyer, outsider, guest] = await Promise.all([client("phase8-seller"), client("phase8-buyer"), client("phase8-outsider"), client("phase8-guest", false)]);
const listingId = `phase8-fixed-${suffix}`;
const cancelId = `phase8-cancel-${suffix}`;
const disputeId = `phase8-dispute-${suffix}`;
const auctionId = `phase8-auction-${suffix}`;
const now = Timestamp.now();
const base = { title: "Working vintage camera", description: "A complete working camera with accessories and case.", categoryId: "electronics", condition: "Good", price: 1500, location: "Kuala Lumpur",
  listingType: "buy_now", imageUrls: ["/brand/takeme-app-icon.png"], status: "active", createdAt: now, updatedAt: now, searchTokens: ["camera"], facetKeys: ["*|*|*|*"], sellerId: seller.uid };
for (const id of [listingId, cancelId, disputeId]) await admin.doc(`listings/${id}`).set({ ...base, id });
await admin.doc(`listings/${auctionId}`).set({ ...base, id: auctionId, listingType: "auction", auctionStatus: "active", status: "active", startingBid: 10000,
  currentBid: 15000, currentBidderId: buyer.uid, bidCount: 1, minimumBidIncrement: 1000, winnerId: null, finalBid: null, endedAt: null,
  auctionStartAt: Timestamp.fromMillis(Date.now() - 86_400_000), auctionEndAt: Timestamp.fromMillis(Date.now() + 60_000) });

const policy = await call(guest, "getReputationPolicy");
assert.equal(policy.thresholds.gold, 30);
assert.equal(policy.reviewWindowDays, 14);
await assert.rejects(() => call(guest, "submitOffer", { listingId, type: "offer", amountSen: 100000, paymentMethod: "cod" }), /unauthenticated|sign in/i);
await assert.rejects(() => call(seller, "submitOffer", { listingId, type: "offer", amountSen: 100000, paymentMethod: "cod" }), /own listing|permission/i);
await assert.rejects(() => call(buyer, "submitOffer", { listingId, type: "offer", amountSen: 1000.5, paymentMethod: "cod" }), /amount|invalid/i);
await assert.rejects(() => call(buyer, "submitOffer", { listingId, type: "offer", amountSen: 150001, paymentMethod: "cod" }), /amount|price/i);
await assert.rejects(() => setDoc(doc(buyer.db, "offers", `fake-${suffix}`), { status: "accepted" }), /permission/i);

const submitted = await call(buyer, "submitOffer", { listingId, type: "offer", amountSen: 120000, paymentMethod: "cod", paymentSuccessful: true });
assert.equal(submitted.status, "submitted");
assert.equal((await call(seller, "getListingDealState", { listingId })).offers.length, 1);
assert.equal((await call(outsider, "getListingDealState", { listingId })).offers.length, 0);
await assert.rejects(() => call(buyer, "submitOffer", { listingId, type: "buy_now", paymentMethod: "cod" }), /already|open/i);
await assert.rejects(() => call(outsider, "respondToOffer", { offerId: submitted.offerId, action: "accept" }), /correct party|permission/i);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId: `offer-${submitted.offerId}`, rating: 5, tags: [], comment: "" }), /not yours|permission|complete/i);
await call(seller, "respondToOffer", { offerId: submitted.offerId, action: "counter", amountSen: 130000 });
assert.equal((await admin.doc(`offers/${submitted.offerId}`).get()).data().quotedAmountSen, 130000);
await assert.rejects(() => call(seller, "respondToOffer", { offerId: submitted.offerId, action: "accept" }), /correct party|permission/i);
const accepted = await call(buyer, "respondToOffer", { offerId: submitted.offerId, action: "accept", amountSen: 1, paymentSuccessful: true });
assert.equal(accepted.status, "accepted");
const transactionId = accepted.transactionId;
const transactionRef = admin.doc(`transactions/${transactionId}`);
assert.equal((await transactionRef.get()).data().amountSen, 130000);
assert.equal((await transactionRef.get()).data().status, "in_progress");
assert.equal((await admin.doc(`listings/${listingId}`).get()).data().status, "ended");
assert.equal((await call(buyer, "respondToOffer", { offerId: submitted.offerId, action: "accept" })).transactionId, transactionId);
await assert.rejects(() => updateDoc(doc(buyer.db, `transactions/${transactionId}`), { status: "completed", amountSen: 1 }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `transactions/${transactionId}/reviews/${buyer.uid}`), { rating: 5 }), /permission/i);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, rating: 5, tags: [], comment: "" }), /complete|window/i);
await assert.rejects(() => call(outsider, "confirmTransactionCompletion", { transactionId }), /not yours|permission/i);

const confirmations = await Promise.all([call(buyer, "confirmTransactionCompletion", { transactionId }), call(seller, "confirmTransactionCompletion", { transactionId })]);
assert.ok(confirmations.some((result) => result.status === "completed"));
assert.equal((await transactionRef.get()).data().status, "completed");
assert.equal((await call(buyer, "confirmTransactionCompletion", { transactionId })).alreadyConfirmed, true);
assert.equal((await admin.doc(`trustSummaries/${buyer.uid}`).get()).data().buyer.completedCount, 1);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.completedCount, 1);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.tier, null);
assert.equal((await admin.doc(`listings/${listingId}`).get()).data().status, "sold");
assert.equal((await getDoc(doc(buyer.db, "listings", listingId))).data().status, "sold");
assert.equal((await getDoc(doc(guest.db, "listings", listingId))).data().status, "sold");
const completionEvent = await admin.doc(`marketplaceEvents/transaction-completed-${transactionId}`).get();
assert.equal(completionEvent.data().eventType, "TRANSACTION_COMPLETED");
assert.equal(completionEvent.data().amountSen, 130000);
assert.equal((await admin.collection("marketplaceEvents").where("transactionId", "==", transactionId).get()).size, 1);
await assert.rejects(() => setDoc(doc(buyer.db, `trustSummaries/${buyer.uid}`), { buyer: { tier: "platinum" } }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "adminMetrics", "global"), { gmvSen: 999999999 }), /permission/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "TRANSACTION_COMPLETED", listingId }), /authoritative|permission/i);

const buyerReview = await call(buyer, "submitTransactionReview", { transactionId, rating: 5, tags: ["Item as described"], comment: "Good camera" });
assert.equal(buyerReview.visible, false);
assert.equal((await call(guest, "getPublicReviews", { userId: seller.uid })).reviews.length, 0);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.reviewCount ?? 0, 0);
await assert.rejects(() => getDoc(doc(seller.db, `transactions/${transactionId}/reviews/${buyer.uid}`)), /permission/i);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, rating: 1, tags: [], comment: "Changed" }), /already|reviewed/i);
await assert.rejects(() => call(outsider, "submitTransactionReview", { transactionId, rating: 5, tags: [], comment: "Fake" }), /not yours|permission/i);
await assert.rejects(() => call(seller, "submitTransactionReview", { transactionId, rating: 5, tags: ["Item as described"], comment: "Wrong tags" }), /tags/i);
const sellerReview = await call(seller, "submitTransactionReview", { transactionId, rating: 4, tags: ["Easy to deal with"], comment: "Smooth deal" });
assert.equal(sellerReview.visible, true);
const sellerPublic = (await call(guest, "getPublicReviews", { userId: seller.uid })).reviews;
const buyerPublic = (await call(buyer, "getPublicReviews", { userId: buyer.uid })).reviews;
assert.equal((await call(guest, "getPublicReviews", { userId: buyer.uid })).reviews.length, 0);
assert.equal(sellerPublic.length, 1);
assert.equal(buyerPublic.length, 1);
assert.equal(sellerPublic[0].rating, 5);
assert.equal(buyerPublic[0].rating, 4);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.averageRating, 5);
assert.equal((await admin.doc(`trustSummaries/${buyer.uid}`).get()).data().buyer.averageRating, 4);
assert.equal((await call(buyer, "getTransactionDetail", { transactionId })).reviewed, true);
await assert.rejects(() => getDoc(doc(guest.db, "publicReviews", sellerPublic[0].id)), /permission/i);
assert.equal((await call(buyer, "reportPublicReview", { reviewId: sellerPublic[0].id, reason: "false_information", details: "Concern" })).submitted, true);
assert.equal((await admin.doc(`reports/review-${sellerPublic[0].id}-${buyer.uid}`).get()).data().targetType, "review");

const buyRequest = await call(buyer, "submitOffer", { listingId: cancelId, type: "buy_now", amountSen: 1, paymentMethod: "bank_transfer" });
const buyAccepted = await call(seller, "respondToOffer", { offerId: buyRequest.offerId, action: "accept" });
assert.equal((await admin.doc(`transactions/${buyAccepted.transactionId}`).get()).data().amountSen, 150000);
await call(buyer, "requestTransactionCancellation", { transactionId: buyAccepted.transactionId, reason: "Item unavailable" });
await assert.rejects(() => call(seller, "confirmTransactionCompletion", { transactionId: buyAccepted.transactionId }), /cancellation/i);
await call(seller, "requestTransactionCancellation", { transactionId: buyAccepted.transactionId, reason: "Agreed" });
assert.equal((await admin.doc(`transactions/${buyAccepted.transactionId}`).get()).data().status, "cancelled");
assert.equal((await admin.doc(`listings/${cancelId}`).get()).data().status, "active");
assert.equal((await admin.doc(`trustSummaries/${buyer.uid}`).get()).data().buyer.completedCount, 1);
assert.equal((await admin.doc(`marketplaceEvents/transaction-completed-${buyAccepted.transactionId}`).get()).exists, false);

const disputeRequest = await call(buyer, "submitOffer", { listingId: disputeId, type: "buy_now", paymentMethod: "external" });
const disputeDeal = await call(seller, "respondToOffer", { offerId: disputeRequest.offerId, action: "accept" });
await call(buyer, "disputeTransaction", { transactionId: disputeDeal.transactionId, reason: "Item not as described" });
await assert.rejects(() => call(seller, "confirmTransactionCompletion", { transactionId: disputeDeal.transactionId }), /cancelled|disputed/i);
assert.equal((await admin.doc(`marketplaceEvents/transaction-completed-${disputeDeal.transactionId}`).get()).exists, false);

const expiredReviewId = `phase8-expired-${suffix}`;
await admin.doc(`transactions/${expiredReviewId}`).set({ buyerId: buyer.uid, sellerId: seller.uid, status: "completed", reviewWindowEndAt: Timestamp.fromMillis(Date.now() - 1000), reviewCount: 0 });
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId: expiredReviewId, rating: 5, tags: [], comment: "Too late" }), /window|closed/i);
const selfReviewId = `phase8-self-${suffix}`;
await admin.doc(`transactions/${selfReviewId}`).set({ buyerId: buyer.uid, sellerId: buyer.uid, status: "completed", reviewWindowEndAt: Timestamp.fromMillis(Date.now() + 86_400_000), reviewCount: 0 });
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId: selfReviewId, rating: 5, tags: [], comment: "Fake" }), /self-review/i);

const promotionRequest = await call(seller, "createPromotionRequest", { listingId: auctionId, packageId: "boost_24h" });
assert.equal(promotionRequest.status, "pending_payment");
await admin.doc(`listings/${auctionId}`).update({ auctionStatus: "ended", status: "ended", winnerId: buyer.uid, finalBid: 15000, endedAt: Timestamp.now(), updatedAt: Timestamp.now() });
await eventually(async () => (await admin.doc(`transactions/auction-${auctionId}`).get()).exists, "auction transaction");
await eventually(async () => (await admin.doc(`promotions/${promotionRequest.promotionId}`).get()).data().status === "cancelled", "promotion cancellation on auction end");
const auctionDeal = (await admin.doc(`transactions/auction-${auctionId}`).get()).data();
assert.equal(auctionDeal.amountSen, 15000);
assert.equal(auctionDeal.status, "in_progress");
assert.equal((await call(seller, "getMyTransactions")).transactions.some((item) => item.id === `auction-${auctionId}`), true);
await call(buyer, "confirmTransactionCompletion", { transactionId: `auction-${auctionId}` });
await call(seller, "confirmTransactionCompletion", { transactionId: `auction-${auctionId}` });
assert.equal((await admin.doc(`trustSummaries/${buyer.uid}`).get()).data().buyer.completedCount, 2);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.completedCount, 2);
assert.equal((await admin.doc(`listings/${auctionId}`).get()).data().auctionStatus, "ended");
assert.equal((await admin.doc(`listings/${auctionId}`).get()).data().finalBid, 15000);
await admin.doc(`listings/${auctionId}`).update({ updatedAt: Timestamp.now() });
assert.equal((await admin.collection("transactions").where("sourceId", "==", auctionId).get()).size, 1);

// Trusted prior-count fixture exercises the 4→5 Bronze boundary without inventing product activity.
await admin.doc(`trustSummaries/${outsider.uid}`).set({ userId: outsider.uid, buyer: { completedCount: 4, tier: null }, updatedAt: Timestamp.now() });
const tierListingId = `phase8-tier-${suffix}`;
await admin.doc(`listings/${tierListingId}`).set({ ...base, id: tierListingId });
const tierRequest = await call(outsider, "submitOffer", { listingId: tierListingId, type: "buy_now", paymentMethod: "cod" });
const tierDeal = await call(seller, "respondToOffer", { offerId: tierRequest.offerId, action: "accept" });
await Promise.all([call(outsider, "confirmTransactionCompletion", { transactionId: tierDeal.transactionId }), call(seller, "confirmTransactionCompletion", { transactionId: tierDeal.transactionId })]);
assert.equal((await admin.doc(`trustSummaries/${outsider.uid}`).get()).data().buyer.tier, "bronze");
assert.equal((await admin.doc(`trustSummaries/${outsider.uid}`).get()).data().seller, undefined);
assert.equal((await admin.doc(`trustSummaries/${seller.uid}`).get()).data().seller.tier, null);

await Promise.all([seller, buyer, outsider, guest].map(({ app }) => deleteApp(app)));
await deleteAdmin(adminApp);
console.log("Transactions integration passed: offer/counter/accept, dual-confirm race, review double-blind, reputation, cancellation, dispute, auction handoff and security.");
