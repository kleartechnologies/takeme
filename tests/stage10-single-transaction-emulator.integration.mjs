import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, getIdToken } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

// This suite runs alone against a fresh demo-takeme emulator instance.
const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdmin({ projectId }, `stage10-admin-${Date.now()}`);
const admin = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };

async function client(label, signedIn = true) {
  const app = initializeApp(config, `stage10-${label}-${suffix}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  if (signedIn) await createUserWithEmailAndPassword(auth, `stage10-${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, db, functions, uid: auth.currentUser?.uid };
}
const call = (person, name, data = {}) => httpsCallable(person.functions, name)(data).then((response) => response.data);
const count = async (path) => (await admin.collection(path).get()).size;
const summary = async (uid, role) => (await admin.doc(`trustSummaries/${uid}`).get()).data()?.[role];
const card = (result, label) => result.cards.find((item) => item.label === label)?.value;

const [seller, buyer, outsider, guest] = await Promise.all([client("seller"), client("buyer"), client("outsider"), client("guest", false)]);
const listingId = `stage10-listing-${suffix}`;
const amountSen = 1100;
const now = Timestamp.now();
await admin.doc(`users/${seller.uid}`).set({ uid: seller.uid, displayName: "Stage 10 Seller", createdAt: now });
await admin.doc(`users/${buyer.uid}`).set({ uid: buyer.uid, displayName: "Stage 10 Buyer", createdAt: now });
await admin.doc(`listings/${listingId}`).set({ id: listingId, sellerId: seller.uid, title: "Stage 10 emulator token", categoryId: "collectibles", listingType: "buy_now", status: "active", price: 11, createdAt: now, updatedAt: now });
await adminAuth.setCustomUserClaims(outsider.uid, { admin: true });
await getIdToken(outsider.auth.currentUser, true);

const revenue = () => call(outsider, "getAdminMetrics", { section: "revenue", preset: "all" });
const before = await revenue();
assert.equal(card(before, "GMV"), 0);
assert.equal(await count("transactions"), 0);

const offer = await call(buyer, "submitOffer", { listingId, type: "buy_now", paymentMethod: "other" });
const accepted = await call(seller, "respondToOffer", { offerId: offer.offerId, action: "accept" });
const transactionId = accepted.transactionId;
const ref = admin.doc(`transactions/${transactionId}`);
assert.equal(await count("transactions"), 1);
let deal = (await ref.get()).data();
assert.equal(deal.status, "in_progress");
assert.equal(deal.listingId, listingId);
assert.equal(deal.buyerId, buyer.uid);
assert.equal(deal.sellerId, seller.uid);
assert.equal(deal.amountSen, amountSen);
assert.equal(deal.settlementMode, "standard");
assert.equal(deal.paymentProvider, "none");
assert.equal(card(await revenue(), "GMV"), 0);
assert.equal((await call(seller, "respondToOffer", { offerId: offer.offerId, action: "accept" })).transactionId, transactionId);
assert.equal(await count("transactions"), 1);

const buyerDetail = await call(buyer, "getTransactionDetail", { transactionId });
const sellerDetail = await call(seller, "getTransactionDetail", { transactionId });
for (const detail of [buyerDetail, sellerDetail]) {
  assert.equal(detail.transaction.id, transactionId);
  assert.equal(detail.transaction.amountSen, amountSen);
  assert.equal(detail.transaction.settlementMode, "standard");
  assert.equal(detail.payment, null);
  assert.equal(detail.payout, null);
  assert.deepEqual(detail.refunds, []);
  for (const key of ["address", "coordinates", "meetupLocations", "admin", "moderation", "paymentSecret"]) assert.equal(detail.transaction[key], undefined);
}
assert.equal(buyerDetail.reviewed, false);
assert.equal(sellerDetail.reviewed, false);
await assert.rejects(() => call(outsider, "getTransactionDetail", { transactionId }), /not yours|permission/i);
await assert.rejects(() => call(guest, "getTransactionDetail", { transactionId }), /sign in|unauthenticated/i);
await assert.rejects(() => getDoc(doc(guest.db, "transactions", transactionId)), /permission/i);

await assert.rejects(() => call(outsider, "confirmTransactionCompletion", { transactionId }), /not yours|permission/i);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, rating: 5, tags: ["Item as described"], comment: "Too early" }), /complete|window/i);
const buyerConfirmation = await call(buyer, "confirmTransactionCompletion", { transactionId, role: "seller" });
assert.equal(buyerConfirmation.status, "in_progress");
deal = (await ref.get()).data();
assert.ok(deal.buyerConfirmedAt);
assert.equal(deal.sellerConfirmedAt, null, "A buyer-supplied seller role cannot confirm for the seller.");
assert.equal(deal.status, "in_progress");
assert.equal((await summary(buyer.uid, "buyer"))?.completedCount ?? 0, 0);
assert.equal((await summary(seller.uid, "seller"))?.completedCount ?? 0, 0);
assert.equal(card(await revenue(), "GMV"), 0);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, rating: 5, tags: [], comment: "Still early" }), /complete|window/i);
assert.equal((await call(buyer, "confirmTransactionCompletion", { transactionId })).alreadyConfirmed, true);
assert.equal((await ref.get()).data().sellerConfirmedAt, null);

const sellerConfirmation = await call(seller, "confirmTransactionCompletion", { transactionId, role: "buyer" });
assert.equal(sellerConfirmation.status, "completed");
deal = (await ref.get()).data();
assert.ok(deal.sellerConfirmedAt);
assert.ok(deal.completedAt);
assert.equal(deal.amountSen, amountSen);
assert.equal(deal.buyerId, buyer.uid);
assert.equal(deal.sellerId, seller.uid);
assert.equal(deal.listingId, listingId);
assert.equal(await count("transactions"), 1);
assert.equal((await summary(buyer.uid, "buyer")).completedCount, 1);
assert.equal((await summary(seller.uid, "seller")).completedCount, 1);
assert.equal(card(await revenue(), "GMV"), amountSen);
assert.equal((await call(buyer, "confirmTransactionCompletion", { transactionId })).alreadyConfirmed, true);
assert.equal((await call(seller, "confirmTransactionCompletion", { transactionId })).alreadyConfirmed, true);
assert.equal((await summary(buyer.uid, "buyer")).completedCount, 1);
assert.equal((await summary(seller.uid, "seller")).completedCount, 1);
assert.equal(card(await revenue(), "GMV"), amountSen);
assert.equal((await admin.collection("marketplaceEvents").where("transactionId", "==", transactionId).where("eventType", "==", "TRANSACTION_COMPLETED").get()).size, 1);

const policy = await call(guest, "getReputationPolicy");
assert.equal(policy.reviewWindowDays, 14);
assert.ok(Math.abs(deal.reviewWindowEndAt.toMillis() - deal.completedAt.toMillis() - 14 * 86_400_000) < 1000);
await assert.rejects(() => call(outsider, "submitTransactionReview", { transactionId, rating: 5, tags: [], comment: "Impostor" }), /not yours|permission/i);
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, reviewerRole: "seller", rating: 5, tags: ["Easy to deal with"], comment: "Wrong role" }), /tags/i);
await assert.rejects(() => call(seller, "submitTransactionReview", { transactionId, reviewerRole: "buyer", rating: 5, tags: ["Item as described"], comment: "Wrong role" }), /tags/i);
assert.equal(await count("publicReviews"), 0);
const buyerReview = await call(buyer, "submitTransactionReview", { transactionId, reviewerRole: "seller", rating: 5, tags: ["Item as described"], comment: "Emulator seller review" });
assert.equal(buyerReview.submitted, true);
assert.equal(buyerReview.visible, false);
assert.equal(await count("publicReviews"), 0);
assert.equal((await admin.doc(`transactions/${transactionId}/reviews/${buyer.uid}`).get()).data().reviewedUserId, seller.uid);
assert.equal((await admin.doc(`transactions/${transactionId}/reviews/${buyer.uid}`).get()).data().reviewerRole, "buyer", "A forged reviewerRole cannot turn a buyer review into a seller review.");
await assert.rejects(() => call(buyer, "submitTransactionReview", { transactionId, rating: 5, tags: [], comment: "Duplicate" }), /already|reviewed/i);
const sellerReview = await call(seller, "submitTransactionReview", { transactionId, reviewerRole: "buyer", rating: 4, tags: ["Easy to deal with"], comment: "Emulator buyer review" });
assert.equal(sellerReview.submitted, true);
assert.equal(sellerReview.visible, true);
assert.equal((await admin.doc(`transactions/${transactionId}/reviews/${seller.uid}`).get()).data().reviewedUserId, buyer.uid);
assert.equal((await admin.doc(`transactions/${transactionId}/reviews/${seller.uid}`).get()).data().reviewerRole, "seller", "A forged reviewerRole cannot turn a seller review into a buyer review.");
await assert.rejects(() => call(seller, "submitTransactionReview", { transactionId, rating: 4, tags: [], comment: "Duplicate" }), /already|reviewed/i);
assert.equal(await count("publicReviews"), 2);
assert.equal((await summary(seller.uid, "seller")).reviewCount, 1);
assert.equal((await summary(seller.uid, "seller")).averageRating, 5);
assert.equal((await summary(buyer.uid, "buyer")).reviewCount, 1);
assert.equal((await summary(buyer.uid, "buyer")).averageRating, 4);

const publicSeller = await call(guest, "getPublicSellerSummaries", { sellerIds: [seller.uid] });
assert.equal(publicSeller.sellers.length, 1);
assert.equal(publicSeller.sellers[0].sellerCompletedTransactionCount, 1);
assert.equal(publicSeller.sellers[0].sellerReviewCount, 1);
assert.equal(publicSeller.sellers[0].sellerRating, 5);
for (const key of ["buyer", "buyerTier", "buyerCompletedTransactionCount", "buyerReviewCount", "address", "coordinates", "meetupLocations", "payment", "admin", "moderation"]) assert.equal(publicSeller.sellers[0][key], undefined);
assert.equal((await call(guest, "getPublicReviews", { userId: seller.uid })).reviews.length, 1);
assert.equal((await call(guest, "getPublicReviews", { userId: buyer.uid })).reviews.length, 0);

await assert.rejects(() => setDoc(doc(buyer.db, "trustSummaries", seller.uid), { seller: { completedCount: 999, tier: "platinum" } }), /permission/i);
await assert.rejects(() => updateDoc(doc(buyer.db, "trustSummaries", buyer.uid), { "buyer.completedCount": 999 }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `transactions/${transactionId}/reviews/${buyer.uid}`), { rating: 1 }), /permission/i);
await assert.rejects(() => updateDoc(doc(seller.db, "transactions", transactionId), { status: "completed", amountSen: 1 }), /permission/i);
assert.equal(await count("transactions"), 1);
assert.equal(card(await revenue(), "GMV"), amountSen);

await Promise.all([seller, buyer, outsider, guest].map(({ app }) => deleteApp(app)));
await deleteAdmin(adminApp);
console.log(`Stage 10 isolated emulator verification passed: transaction=${transactionId}, buyer=${buyer.uid}, seller=${seller.uid}, amountSen=${amountSen}`);
