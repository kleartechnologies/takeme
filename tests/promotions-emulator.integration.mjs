import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, query, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdminApp({ projectId }, `promotion-admin-${Date.now()}`);
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
const call = (client, name, data = {}) => httpsCallable(client.functions, name)(data).then((result) => result.data);
async function eventually(check, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const [seller, otherSeller, buyer, guest] = await Promise.all([client("promotion-seller"), client("promotion-other"), client("promotion-buyer"), client("promotion-guest", false)]);
const listingId = `promotion-listing-${suffix}`;
const featuredId = `promotion-featured-${suffix}`;
const inactiveId = `promotion-inactive-${suffix}`;
const cameraThreeId = `promotion-camera-three-${suffix}`;
const cameraFourId = `promotion-camera-four-${suffix}`;
const auctionId = `promotion-auction-${suffix}`;
const endedAuctionId = `promotion-ended-auction-${suffix}`;
const now = Timestamp.now();
const base = { title: "Vintage camera kit", description: "A complete working camera with accessories and case.", categoryId: "electronics", condition: "Good", price: 250, location: "Kuala Lumpur", listingType: "buy_now", imageUrls: ["/brand/takeme-app-icon.png"], status: "active", createdAt: now, updatedAt: now, searchTokens: ["camera", "vintage"], facetKeys: ["*|*|*|*"] };
await admin.doc(`listings/${listingId}`).set({ ...base, id: listingId, sellerId: seller.uid });
await admin.doc(`listings/${featuredId}`).set({ ...base, id: featuredId, sellerId: otherSeller.uid, title: "Featured vintage camera" });
await admin.doc(`listings/${inactiveId}`).set({ ...base, id: inactiveId, sellerId: seller.uid, status: "removed" });
await admin.doc(`listings/${cameraThreeId}`).set({ ...base, id: cameraThreeId, sellerId: buyer.uid });
await admin.doc(`listings/${cameraFourId}`).set({ ...base, id: cameraFourId, sellerId: buyer.uid });
const auction = { ...base, sellerId: seller.uid, listingType: "auction", auctionStatus: "active", auctionStartAt: Timestamp.fromMillis(Date.now() - 3_600_000), auctionEndAt: Timestamp.fromMillis(Date.now() + 86_400_000) };
await admin.doc(`listings/${auctionId}`).set({ ...auction, id: auctionId });
await admin.doc(`listings/${endedAuctionId}`).set({ ...auction, id: endedAuctionId, auctionStatus: "ended", auctionEndAt: Timestamp.fromMillis(Date.now() - 60_000) });

const packageResponse = await call(guest, "getPromotionPackages");
assert.equal(packageResponse.paymentAvailable, false);
assert.equal(packageResponse.pricingFinal, false);
assert.equal(packageResponse.packages.length, 3);
await assert.rejects(() => call(guest, "createPromotionRequest", { listingId, packageId: "boost_24h" }), /unauthenticated|sign in/i);
await assert.rejects(() => call(buyer, "createPromotionRequest", { listingId, packageId: "boost_24h" }), /seller|permission/i);
await assert.rejects(() => call(seller, "createPromotionRequest", { listingId: inactiveId, packageId: "boost_24h" }), /eligible/i);
await assert.rejects(() => call(seller, "createPromotionRequest", { listingId: endedAuctionId, packageId: "boost_24h" }), /eligible/i);
await assert.rejects(() => call(seller, "createPromotionRequest", { listingId, packageId: "unknown" }), /unavailable/i);
await assert.rejects(() => setDoc(doc(seller.db, "promotionPackages", "boost_24h"), { priceSen: 1 }), /permission/i);
await assert.rejects(() => getDoc(doc(seller.db, "promotionPackages", "boost_24h")), /permission/i);
const packageRef = admin.doc("promotionPackages/boost_24h");
const originalPackage = await packageRef.get();
await packageRef.set({ type: "boost", label: "24 hours", durationHours: 24, priceSen: 350, currency: "MYR", available: true });
const configured = await call(seller, "getPromotionPackages");
assert.equal(configured.packages.find((item) => item.id === "boost_24h").priceSen, 350);

const created = await call(seller, "createPromotionRequest", { listingId, packageId: "boost_24h", priceSen: 1, paymentSuccessful: true });
assert.equal(created.status, "pending_payment");
const promotionRef = admin.doc(`promotions/${created.promotionId}`);
const data = (await promotionRef.get()).data();
assert.equal(data.priceSen, 350);
assert.equal(data.paymentStatus, "not_configured");
assert.equal(data.startAt, null);
assert.equal(data.endAt, null);
assert.equal(data.impressions, 0);
assert.equal(data.clicks, 0);
await assert.rejects(() => call(seller, "createPromotionRequest", { listingId, packageId: "featured_168h" }), /already|promotion request/i);
await assert.rejects(() => call(buyer, "getMyPromotionRequests", { listingId }), /yours|permission/i);
await assert.rejects(() => getDoc(doc(buyer.db, "promotions", created.promotionId)), /permission/i);
await assert.rejects(() => getDocs(query(collection(buyer.db, "promotions"), limit(10))), /permission/i);
await assert.rejects(() => updateDoc(doc(seller.db, "promotions", created.promotionId), { paymentStatus: "paid", status: "active" }), /permission/i);
await assert.rejects(() => setDoc(doc(seller.db, "promotionLocks", listingId), { status: "active" }), /permission/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "PROMOTION_CLICK", listingId }), /authoritative|permission/i);
const noUnpaidPlacement = await call(buyer, "getPromotionPlacements", { listingIds: [listingId], categoryId: "electronics", search: "camera" });
assert.equal(Object.keys(noUnpaidPlacement.badges).length, 0);
const noUnpaidEngagement = await call(buyer, "trackPromotionEngagement", { type: "PROMOTION_IMPRESSION", promotionId: created.promotionId, listingId });
assert.equal(noUnpaidEngagement.accepted, false);
assert.equal((await promotionRef.get()).data().impressions, 0);
const history = await call(seller, "getMyPromotionRequests", { listingId });
assert.equal(history.promotions[0].status, "pending_payment");
await assert.rejects(() => call(buyer, "cancelPromotionRequest", { promotionId: created.promotionId }), /your|permission/i);
assert.equal((await call(seller, "cancelPromotionRequest", { promotionId: created.promotionId })).status, "cancelled");
const second = await call(seller, "createPromotionRequest", { listingId, packageId: "featured_168h" });
assert.equal(second.status, "pending_payment");
await call(seller, "cancelPromotionRequest", { promotionId: second.promotionId });
const auctionRequest = await call(seller, "createPromotionRequest", { listingId: auctionId, packageId: "boost_24h" });
assert.equal(auctionRequest.status, "pending_payment");
await admin.doc(`listings/${auctionId}`).update({ auctionStatus: "ended", status: "ended", updatedAt: Timestamp.now() });
await eventually(async () => (await admin.doc(`promotions/${auctionRequest.promotionId}`).get()).data().status === "cancelled", "auction-end cancellation");

// Trusted emulator fixture exercises the paid-only rendering and analytics gate; no payment is simulated in product code.
const paidId = `paid-fixture-${suffix}`;
await admin.doc(`promotions/${paidId}`).set({ listingId: featuredId, sellerId: otherSeller.uid, type: "featured", packageId: "featured_168h", status: "active", paymentStatus: "paid", paymentProvider: "verified-test-fixture", priceSen: 990, currency: "MYR", durationHours: 168, startAt: Timestamp.fromMillis(Date.now() - 60_000), endAt: Timestamp.fromMillis(Date.now() + 86_400_000), impressions: 0, clicks: 0, createdAt: now, updatedAt: now });
await admin.doc(`promotionLocks/${featuredId}`).set({ promotionId: paidId, sellerId: otherSeller.uid, status: "active", updatedAt: now });
const featured = await call(buyer, "getFeaturedPromotions");
assert.ok(featured.items.some((item) => item.promotionId === paidId));
const placement = await call(buyer, "getPromotionPlacements", { listingIds: [listingId, featuredId, cameraThreeId, cameraFourId], categoryId: "electronics", search: "camera" });
assert.deepEqual(placement.orderIds, [listingId, cameraThreeId, featuredId, cameraFourId]);
assert.equal(placement.badges[featuredId].type, "featured");
const unrelated = await call(buyer, "getPromotionPlacements", { listingIds: [listingId, featuredId, cameraThreeId, cameraFourId], categoryId: "fashion", search: "camera" });
assert.equal(Object.keys(unrelated.badges).length, 0);
const impression = await call(buyer, "trackPromotionEngagement", { type: "PROMOTION_IMPRESSION", promotionId: paidId, listingId: featuredId, context: "home" });
assert.equal(impression.accepted, true);
assert.equal((await call(buyer, "trackPromotionEngagement", { type: "PROMOTION_IMPRESSION", promotionId: paidId, listingId: featuredId, context: "home" })).reason, "duplicate");
assert.equal((await call(otherSeller, "trackPromotionEngagement", { type: "PROMOTION_CLICK", promotionId: paidId, listingId: featuredId })).reason, "promotion_unavailable");
assert.equal((await call(buyer, "trackPromotionEngagement", { type: "PROMOTION_CLICK", promotionId: paidId, listingId: featuredId })).accepted, true);
assert.equal((await admin.doc(`promotions/${paidId}`).get()).data().impressions, 1);
assert.equal((await admin.doc(`promotions/${paidId}`).get()).data().clicks, 1);
const paidEvent = await admin.collection("marketplaceEvents").where("promotionId", "==", paidId).where("eventType", "==", "PROMOTION_CLICK").limit(1).get();
assert.equal(paidEvent.size, 1);
assert.equal(paidEvent.docs[0].data().sellerId, otherSeller.uid);
await admin.doc(`listings/${featuredId}`).update({ status: "removed", updatedAt: Timestamp.now() });
await eventually(async () => (await admin.doc(`promotions/${paidId}`).get()).data().status === "cancelled", "listing-unavailable cancellation");
assert.equal((await admin.doc(`promotions/${paidId}`).get()).data().refundReviewRequired, true);
assert.equal((await call(buyer, "getFeaturedPromotions")).items.some((item) => item.promotionId === paidId), false);
assert.equal((await call(seller, "trackPromotionEngagement", { type: "PROMOTION_CLICK", promotionId: paidId, listingId: featuredId })).reason, "promotion_unavailable");

await getAdminAuth(adminApp).setCustomUserClaims(buyer.uid, { admin: true });
await buyer.auth.currentUser.getIdToken(true);
assert.equal((await getDoc(doc(buyer.db, "promotionPackages", "boost_24h"))).exists(), true);
assert.ok((await getDocs(query(collection(buyer.db, "promotions"), limit(10)))).size > 0);

if (originalPackage.exists) await packageRef.set(originalPackage.data());
else await packageRef.delete();
await Promise.all([seller, otherSeller, buyer, guest].map(({ app }) => deleteApp(app)));
await deleteAdminApp(adminApp);
console.log("Promotions emulator integration passed: ownership, package snapshot, pending-only flow, direct-write denial, paid fixture gate, analytics, and listing cancellation.");
