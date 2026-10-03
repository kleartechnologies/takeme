import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const functionsModule = requireFunctions("./lib/index.js");
const admin = getAdminFirestore();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
async function client(label) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app), db = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword());
  await acceptDemoPolicies(app);
  await admin.doc(`users/${auth.currentUser.uid}`).set({ uid: auth.currentUser.uid, displayName: `${label} user`, photoURL: null, location: "Kuala Lumpur", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  return { app, auth, db, functions, uid: auth.currentUser.uid };
}
const call = (person, name, data = {}) => httpsCallable(person.functions, name)(data).then((result) => result.data);
async function eventually(check, label, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 200)); }
  throw new Error(`Timed out waiting for ${label}`);
}
async function drainJobs() {
  // Existing demo jobs may precede this suite's jobs; keep the drain bounded.
  for (let i = 0; i < 500; i += 1) {
    const jobs = await admin.collection("engagementJobs").limit(1).get();
    if (jobs.empty) return;
    await functionsModule.processEngagementJobs.run();
  }
  throw new Error("Engagement jobs did not drain");
}
const [seller, buyer, other] = await Promise.all([client("seller"), client("buyer"), client("other")]);

await assert.rejects(() => call(buyer, "setSellerFollow", { sellerId: buyer.uid, following: true }), /follow|invalid/i);
const firstFollow = await call(buyer, "setSellerFollow", { sellerId: seller.uid, following: true });
assert.equal(firstFollow.followerCount, 1);
assert.equal((await call(buyer, "setSellerFollow", { sellerId: seller.uid, following: true })).followerCount, 1);
assert.equal((await call(other, "getFollowState", { sellerId: seller.uid })).followerCount, 1);
const followingPage = await call(buyer, "getFollowing");
assert.equal(followingPage.items.length, 1);
assert.equal(followingPage.items[0].sellerReviewCount, 0);
assert.equal("buyer" in followingPage.items[0], false);
await assert.rejects(() => setDoc(doc(buyer.db, "sellerFollowSummaries", seller.uid), { followerCount: 999 }), /permission/i);

const criteria = { query: "camera", category: "electronics", condition: "Good", type: "buy_now", auction: "", price: 1500, location: "Kuala Lumpur", sort: "newest" };
const savedSearchId = (await call(buyer, "saveSearch", { criteria, frequency: "instant", requestId: `first-${suffix}` })).searchId;
assert.equal((await call(buyer, "saveSearch", { criteria, frequency: "instant", requestId: `repeat-${suffix}` })).searchId, savedSearchId);
assert.equal((await call(buyer, "getSavedSearches")).items.length, 1);
assert.equal((await admin.doc(`savedSearchQuotas/${buyer.uid}`).get()).data().count, 1);
await assert.rejects(() => call(other, "deleteSavedSearch", { searchId: savedSearchId }), /yours|permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "savedSearches", savedSearchId), { frequency: "off" }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "savedSearchQuotas", buyer.uid), { count: 0 }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "savedSearchFingerprints", `fake-${suffix}`), { searchId: savedSearchId }), /permission/i);
await assert.rejects(() => call(buyer, "setNotificationPreference", { type: "saved_price_drop", frequency: "daily" }), /invalid|preference/i);

const listingId = `engagement-${suffix}`;
const base = { id: listingId, sellerId: seller.uid, title: "Working vintage camera", description: "A complete camera with accessories and carrying case.", categoryId: "electronics", condition: "Good", price: 1500, listingType: "buy_now", location: "Kuala Lumpur", locationKey: "kuala lumpur", imageUrls: ["/brand/takeme-app-icon.png"], searchTokens: ["camera", "working"], facetKeys: ["*|*|*|*"], status: "draft", createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
await admin.doc(`listings/${listingId}`).set(base);
await admin.doc(`listings/${listingId}`).update({ status: "active", updatedAt: Timestamp.now() });
await eventually(async () => !(await admin.collection("engagementJobs").limit(1).get()).empty, "new listing jobs");
await drainJobs();
await eventually(async () => (await call(buyer, "getNotifications")).items.some((item) => item.type === "new_matching_listing"), "saved search alert");
const initial = (await call(buyer, "getNotifications")).items;
assert.equal(initial.filter((item) => item.type === "new_matching_listing").length, 1);
assert.equal(initial.filter((item) => item.type === "followed_seller_listing").length, 1);
assert.ok(initial.every((item) => item.href === `/listings/${listingId}`));
assert.equal((await call(other, "getNotifications")).items.length, 0);

await setDoc(doc(buyer.db, "users", buyer.uid, "saved", listingId), { listingId, savedAt: serverTimestamp() });
await eventually(async () => (await admin.doc(`listingWatchers/${listingId}/users/${buyer.uid}`).get()).exists, "saved watcher mirror");
await admin.doc(`listings/${listingId}`).update({ price: 1400, updatedAt: Timestamp.now() });
await eventually(async () => !(await admin.collection("listingPriceHistory").doc(listingId).collection("changes").limit(1).get()).empty, "price history");
await eventually(async () => !(await admin.collection("engagementJobs").limit(1).get()).empty, "price-drop job");
await drainJobs();
const priceAlert = (await call(buyer, "getNotifications")).items.find((item) => item.type === "saved_price_drop");
assert.ok(priceAlert);
const history = (await admin.doc(`listingPriceHistory/${listingId}`).collection("changes").get()).docs;
assert.equal(history.length, 1);
assert.equal(history[0].data().oldPriceSen, 150000);
assert.equal(history[0].data().newPriceSen, 140000);
await admin.doc(`listings/${listingId}`).update({ price: 1400, updatedAt: Timestamp.now() });
await admin.doc(`listings/${listingId}`).update({ price: 1450, updatedAt: Timestamp.now() });
await new Promise((resolve) => setTimeout(resolve, 500));
assert.equal((await admin.doc(`listingPriceHistory/${listingId}`).collection("changes").get()).size, 1);

await assert.rejects(() => setDoc(doc(buyer.db, `users/${buyer.uid}/notifications/fake`), { type: "auction_won" }), /permission/i);
await assert.rejects(() => getDoc(doc(other.db, `users/${buyer.uid}/notifications/${priceAlert.id}`)), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `notificationSummaries/${buyer.uid}`), { unreadCount: 999 }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `listingPriceHistory/${listingId}/changes/fake`), { oldPriceSen: 1 }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, `engagementJobs/fake`), { eventType: "auction_won" }), /permission/i);
const unreadBefore = (await call(buyer, "getUnreadCount")).unreadCount;
assert.ok(unreadBefore >= 3);
await call(buyer, "openNotification", { notificationId: priceAlert.id });
assert.equal((await call(buyer, "getUnreadCount")).unreadCount, unreadBefore - 1);
assert.equal((await admin.doc(`users/${buyer.uid}/notifications/${priceAlert.id}`).get()).data().openedAt instanceof Timestamp, true);
await call(buyer, "openNotification", { notificationId: priceAlert.id });
assert.equal((await call(buyer, "getUnreadCount")).unreadCount, unreadBefore - 1);
await call(buyer, "markAllNotificationsRead");
assert.equal((await call(buyer, "getUnreadCount")).unreadCount, 0);

await call(buyer, "setNotificationPreference", { type: "saved_price_drop", frequency: "off" });
await admin.doc(`listings/${listingId}`).update({ price: 1300, updatedAt: Timestamp.now() });
await eventually(async () => !(await admin.collection("engagementJobs").limit(1).get()).empty, "second price-drop job");
await drainJobs();
assert.equal((await call(buyer, "getNotifications")).items.filter((item) => item.type === "saved_price_drop").length, 1);
await admin.doc(`listings/${listingId}`).update({ status: "removed", updatedAt: Timestamp.now() });
await eventually(async () => !(await admin.collection("engagementJobs").limit(1).get()).empty, "unavailable job");
await drainJobs();
assert.equal((await call(buyer, "getNotifications")).items.filter((item) => item.type === "saved_unavailable").length, 1);

const auctionId = `engagement-auction-${suffix}`;
const auctionRef = admin.doc(`listings/${auctionId}`);
await auctionRef.set({ ...base, id: auctionId, title: "Working vintage camera auction", listingType: "auction", status: "active", auctionStatus: "active", price: 100,
  startingBid: 10000, currentBid: 0, currentBidderId: null, bidCount: 0, minimumBidIncrement: 1000, winnerId: null, finalBid: null, endedAt: null,
  auctionStartAt: Timestamp.fromMillis(Date.now() - 60000), auctionEndAt: Timestamp.fromMillis(Date.now() + 10 * 60000), updatedAt: Timestamp.now() });
await setDoc(doc(buyer.db, "users", buyer.uid, "saved", auctionId), { listingId: auctionId, savedAt: serverTimestamp() });
await eventually(async () => (await admin.doc(`listingWatchers/${auctionId}/users/${buyer.uid}`).get()).exists, "auction watcher");
await functionsModule.queueEndingAuctionAlerts.run();
await drainJobs();
await functionsModule.queueEndingAuctionAlerts.run();
await drainJobs();
assert.equal((await call(buyer, "getNotifications")).items.filter((item) => item.type === "auction_ending").length, 1);
await call(buyer, "placeBid", { listingId: auctionId, amount: 10000 });
await call(other, "placeBid", { listingId: auctionId, amount: 11000 });
assert.equal((await auctionRef.get()).data().price, 110);
await eventually(async () => (await call(buyer, "getNotifications")).items.some((item) => item.type === "outbid"), "outbid alert");
await auctionRef.update({ auctionEndAt: Timestamp.fromMillis(Date.now() - 1000), updatedAt: Timestamp.now() });
await functionsModule.advanceAuctionLifecycle.run();
await eventually(async () => (await auctionRef.get()).data().auctionStatus === "ended", "auction finalization");
await eventually(async () => (await call(other, "getNotifications")).items.some((item) => item.type === "auction_won"), "winner alert");
await eventually(async () => !(await admin.collection("engagementJobs").limit(1).get()).empty, "auction loser job");
await drainJobs();
assert.equal((await call(buyer, "getNotifications")).items.filter((item) => item.type === "auction_lost").length, 1);
await eventually(async () => (await admin.doc(`transactions/auction-${auctionId}`).get()).exists, "auction transaction");
await eventually(async () => (await call(seller, "getNotifications")).items.some((item) => item.type === "transaction_update"), "transaction created alert");
await Promise.all([call(other, "confirmTransactionCompletion", { transactionId: `auction-${auctionId}` }), call(seller, "confirmTransactionCompletion", { transactionId: `auction-${auctionId}` })]);
await eventually(async () => (await call(other, "getNotifications")).items.some((item) => item.type === "transaction_completed"), "transaction completed alert");

const offerListingId = `engagement-offer-${suffix}`;
await admin.doc(`listings/${offerListingId}`).set({ ...base, id: offerListingId, status: "active", updatedAt: Timestamp.now() });
const offer = await call(buyer, "submitOffer", { listingId: offerListingId, type: "offer", amountSen: 100000, paymentMethod: "cod" });
await eventually(async () => (await call(seller, "getNotifications")).items.some((item) => item.type === "offer_received"), "offer received alert");
const accepted = await call(seller, "respondToOffer", { offerId: offer.offerId, action: "accept" });
await eventually(async () => (await call(buyer, "getNotifications")).items.some((item) => item.type === "offer_accepted"), "offer accepted alert");
assert.equal((await call(buyer, "getNotifications")).items.find((item) => item.type === "offer_accepted").href, `/transactions/${accepted.transactionId}`);

await assert.rejects(() => call(buyer, "getAdminMetrics", { section: "engagement", preset: "all" }), /admin|permission/i);
await getAdminAuth().setCustomUserClaims(seller.uid, { admin: true });
await seller.auth.currentUser.getIdToken(true);
const engagementMetrics = await call(seller, "getAdminMetrics", { section: "engagement", preset: "all" });
assert.equal(engagementMetrics.section, "engagement");
assert.ok(engagementMetrics.cards.find((item) => item.label === "Notifications created").value >= 1);
assert.ok(engagementMetrics.cards.find((item) => item.label === "Notifications opened").value >= 1);

const editedSearchId = (await call(buyer, "saveSearch", { searchId: savedSearchId, criteria: { ...criteria, query: "lens" }, frequency: "off", active: false })).searchId;
assert.equal(editedSearchId, savedSearchId);
assert.equal((await call(buyer, "getSavedSearches")).items[0].active, false);
assert.equal((await admin.doc(`savedSearchQuotas/${buyer.uid}`).get()).data().count, 1);
await call(buyer, "deleteSavedSearch", { searchId: editedSearchId });
assert.equal((await call(buyer, "getSavedSearches")).items.length, 0);
assert.equal((await admin.doc(`savedSearchQuotas/${buyer.uid}`).get()).data().count, 0);
await call(buyer, "setSellerFollow", { sellerId: seller.uid, following: false });
assert.equal((await call(buyer, "getFollowState", { sellerId: seller.uid })).followerCount, 0);
assert.equal((await call(buyer, "getFollowing")).items.length, 0);

await Promise.all([seller, buyer, other].map(({ app }) => deleteApp(app)));
console.log("Engagement emulator verified follows, saved searches, price/unavailable/auction/transaction alerts, dedupe, unread/open, preferences, owner isolation and denied client writes.");
