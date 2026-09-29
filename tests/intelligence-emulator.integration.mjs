import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdminApp({ projectId }, `intelligence-admin-${Date.now()}`);
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

async function eventually(check, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const [seller, buyer, stranger, guest] = await Promise.all([client("intelligence-seller"), client("intelligence-buyer"), client("intelligence-stranger"), client("intelligence-guest", false)]);
const call = (target, name, data) => httpsCallable(target.functions, name)(data).then((result) => result.data);
const cameraId = `intelligence-camera-${suffix}`;
const fashionId = `intelligence-fashion-${suffix}`;
const legacyId = `intelligence-legacy-${suffix}`;
const base = { sellerId: seller.uid, description: "A complete working marketplace item with useful details and images.", condition: "Good", price: 250, listingType: "buy_now", privacyVersion: 2, publicLocation: { districtOrCity: "Kuala Lumpur", state: "W.P. Kuala Lumpur", country: "Malaysia" }, location: "Kuala Lumpur, W.P. Kuala Lumpur", imageUrls: ["/brand/takeme-app-icon.png"], status: "active", createdAt: new Date(), updatedAt: new Date() };
await admin.doc(`listings/${cameraId}`).set({ ...base, id: cameraId, title: "Vintage camera kit", categoryId: "electronics", facetKeys: ["*|*|*|*", "electronics|*|*|*"] });
await admin.doc(`listings/${fashionId}`).set({ ...base, id: fashionId, title: "Fashion jacket", categoryId: "fashion", facetKeys: ["*|*|*|*", "fashion|*|*|*"] });
await admin.doc(`listings/${legacyId}`).set({ ...base, id: legacyId, privacyVersion: 1, title: "Legacy camera", categoryId: "electronics", facetKeys: ["*|*|*|*", "electronics|*|*|*"] });

await assert.rejects(() => call(guest, "trackMarketplaceEvent", { type: "VIEW_LISTING", listingId: cameraId }), /unauthenticated|sign in/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "SAVE_LISTING", listingId: cameraId }), /permission|authoritative/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "SEARCH", query: "x" }), /invalid|search/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "VIEW_LISTING", listingId: cameraId, userId: stranger.uid }), /invalid|unexpected/i);
await assert.rejects(() => setDoc(doc(buyer.db, "marketplaceEvents", "forged"), { userId: buyer.uid, eventType: "BID" }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "userInterests", buyer.uid), { category: { electronics: 1000 } }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "listingTrends", cameraId), { score: 1000 }), /permission/i);

const cold = await call(buyer, "getMarketplaceRecommendations", {});
assert.equal(cold.mode, "discovery");
assert.ok(cold.items.length > 0 && cold.items.length <= 8);
assert.ok(cold.items.every((item) => item.listing.status === "active"));
assert.ok(cold.items.every((item) => item.listing.id !== legacyId), "legacy listing is excluded from recommendations");
const coldDiscovery = await call(buyer, "getMarketplaceDiscovery", {});
assert.equal(coldDiscovery.metadata.personalized, false);
assert.equal(coldDiscovery.sections[0].id, "for_you");
assert.ok(coldDiscovery.sections.every((section) => section.listings.length <= 4));
assert.ok(coldDiscovery.sections.every((section) => section.listings.every((item) => item.listing.id !== legacyId)), "legacy listing is excluded from discovery");
assert.ok(coldDiscovery.sessionId);
assert.equal(coldDiscovery.sections.some((section) => section.id === "trending_near_you"), false, "no local lane without a profile location");
await assert.rejects(() => call(buyer, "getMarketplaceDiscovery", { sectionId: "for_you", cursor: "1000000" }), /invalid|cursor/i);
if (coldDiscovery.sections[0].nextCursor) {
  const nextPage = await call(buyer, "getMarketplaceDiscovery", { sectionId: coldDiscovery.sections[0].id, cursor: coldDiscovery.sections[0].nextCursor });
  assert.ok(nextPage.sections[0].listings.length <= 4);
  assert.ok(nextPage.sections[0].listings.every((item) => !coldDiscovery.sections[0].listings.some((first) => first.listing.id === item.listing.id)));
}
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "RECOMMENDATION_IMPRESSION", listingIds: [cameraId] }), /permission|session/i);
await assert.rejects(() => call(buyer, "trackMarketplaceEvent", { type: "RECOMMENDATION_CLICK", listingId: "not-served", sessionId: coldDiscovery.sessionId }), /permission|session/i);
const servedId = cameraId;
assert.ok(coldDiscovery.sections.some((section) => section.listings.some((item) => item.listing.id === servedId)));
const servedSectionId = coldDiscovery.sections.find((section) => section.listings.some((item) => item.listing.id === servedId)).id;
assert.equal((await call(buyer, "trackMarketplaceEvent", { type: "RECOMMENDATION_IMPRESSION", listingIds: [servedId], sessionId: coldDiscovery.sessionId })).accepted, true);
assert.equal((await call(buyer, "trackMarketplaceEvent", { type: "RECOMMENDATION_CLICK", listingId: servedId, sessionId: coldDiscovery.sessionId })).accepted, true);
await assert.rejects(() => setDoc(doc(buyer.db, "discoverySessions", "forged"), { userId: buyer.uid, listings: [cameraId] }), /permission/i);
await assert.rejects(() => setDoc(doc(buyer.db, "discoveryAttributions", "forged"), { sectionId: "for_you" }), /permission/i);
const sellerDiscovery = await call(seller, "getMarketplaceRecommendations", {});
assert.ok(sellerDiscovery.items.every((item) => item.listing.sellerId !== seller.uid));

const first = await call(buyer, "trackMarketplaceEvent", { type: "VIEW_LISTING", listingId: cameraId, context: "detail" });
assert.equal(first.accepted, true);
const duplicate = await call(buyer, "trackMarketplaceEvent", { type: "VIEW_LISTING", listingId: cameraId, context: "detail" });
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, "duplicate");
await call(buyer, "trackMarketplaceEvent", { type: "CATEGORY_VIEW", categoryId: "electronics", context: "home" });
await call(buyer, "trackMarketplaceEvent", { type: "SEARCH", query: "vintage camera", context: "explore" });
const personalized = await call(buyer, "getMarketplaceRecommendations", {});
assert.equal(personalized.mode, "personalized");
assert.ok(personalized.items.some((item) => item.listing.id === cameraId));
const personalizedDiscovery = await call(buyer, "getMarketplaceDiscovery", {});
assert.equal(personalizedDiscovery.metadata.personalized, true);
assert.ok(personalizedDiscovery.sections.some((section) => section.id === "for_you"));
assert.equal(new Set(personalizedDiscovery.sections.flatMap((section) => section.listings.map((item) => item.listing.id))).size,
  personalizedDiscovery.sections.flatMap((section) => section.listings).length, "personalized rails do not duplicate served listings");
assert.equal((await call(buyer, "trackMarketplaceEvent", { type: "NOT_INTERESTED", listingId: cameraId })).accepted, true);
assert.ok((await call(buyer, "getMarketplaceDiscovery", {})).sections.every((section) => section.listings.every((item) => item.listing.id !== cameraId)));
assert.equal((await call(buyer, "trackMarketplaceEvent", { type: "INTEREST_RESTORED", listingId: cameraId })).accepted, true);
assert.ok((await call(buyer, "getMarketplaceDiscovery", {})).sections.some((section) => section.listings.some((item) => item.listing.id === cameraId)));

await assert.rejects(() => getDoc(doc(stranger.db, "userInterests", buyer.uid)), /permission/i);
await assert.rejects(() => getDoc(doc(stranger.db, "listingTrends", cameraId)), /permission/i);
const eventSnapshot = await admin.collection("marketplaceEvents").where("userId", "==", buyer.uid).limit(20).get();
assert.ok(eventSnapshot.size >= 3);
await assert.rejects(() => getDoc(doc(stranger.db, "marketplaceEvents", eventSnapshot.docs[0].id)), /permission/i);
assert.equal(eventSnapshot.docs.some((item) => Object.hasOwn(item.data(), "body")), false);

await setDoc(doc(buyer.db, "users", buyer.uid, "saved", cameraId), { listingId: cameraId, savedAt: serverTimestamp() });
await eventually(async () => (await admin.collection("marketplaceEvents").where("userId", "==", buyer.uid).where("eventType", "==", "SAVE_LISTING").limit(1).get()).size === 1, "authoritative Saved event");
const savedProfile = await admin.doc(`userInterests/${buyer.uid}`).get();
assert.ok(savedProfile.data().category.electronics > 2);
const attributedSave = await admin.collection("marketplaceEvents").where("userId", "==", buyer.uid).where("eventType", "==", "SAVE_LISTING").limit(1).get();
assert.equal(attributedSave.docs[0].data().sectionId, servedSectionId);

const pendingId = `intelligence-pending-${suffix}`;
await admin.doc(`transactions/${pendingId}`).set({ status: "in_progress", buyerId: buyer.uid, sellerId: seller.uid, listingId: fashionId, categoryId: "fashion", amountSen: 25000, type: "buy_now" });
await admin.doc(`marketplaceEvents/transaction-completed-${pendingId}`).set({ eventType: "TRANSACTION_COMPLETED", source: "transaction", transactionId: pendingId, userId: buyer.uid, listingId: fashionId, categoryId: "fashion", createdAt: new Date() });
await new Promise((resolve) => setTimeout(resolve, 500));
assert.equal((await admin.doc(`intelligenceCompletions/${pendingId}`).get()).exists, false);
const completedId = `intelligence-completed-${suffix}`;
await admin.doc(`transactions/${completedId}`).set({ status: "completed", buyerId: buyer.uid, sellerId: seller.uid, listingId: fashionId, categoryId: "fashion", amountSen: 25000, type: "buy_now" });
await admin.doc(`marketplaceEvents/transaction-completed-${completedId}`).set({ eventType: "TRANSACTION_COMPLETED", source: "transaction", transactionId: completedId, userId: buyer.uid, listingId: fashionId, categoryId: "fashion", createdAt: new Date() });
await eventually(async () => (await admin.doc(`intelligenceCompletions/${completedId}`).get()).exists, "trusted completed transaction interest");
assert.ok((await admin.doc(`userInterests/${buyer.uid}`).get()).data().category.fashion > 0);

await getAdminAuth(adminApp).setCustomUserClaims(stranger.uid, { admin: true });
await stranger.auth.currentUser.getIdToken(true);
assert.equal((await getDoc(doc(stranger.db, "marketplaceEvents", eventSnapshot.docs[0].id))).exists(), true);
assert.equal((await getDoc(doc(stranger.db, "userInterests", buyer.uid))).exists(), true);

await Promise.all([seller, buyer, stranger, guest].map(({ app }) => deleteApp(app)));
await deleteAdminApp(adminApp);
console.log("Intelligence emulator integration passed: discovery, served impressions, negative preferences, trusted saves/completions, private analytics, admin access.");
