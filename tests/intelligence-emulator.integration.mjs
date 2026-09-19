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
const base = { sellerId: seller.uid, description: "A complete working marketplace item with useful details and images.", condition: "Good", price: 250, listingType: "buy_now", location: "Kuala Lumpur", imageUrls: ["/brand/takeme-app-icon.png"], status: "active", createdAt: new Date(), updatedAt: new Date() };
await admin.doc(`listings/${cameraId}`).set({ ...base, id: cameraId, title: "Vintage camera kit", categoryId: "electronics", facetKeys: ["*|*|*|*", "electronics|*|*|*"] });
await admin.doc(`listings/${fashionId}`).set({ ...base, id: fashionId, title: "Fashion jacket", categoryId: "fashion", facetKeys: ["*|*|*|*", "fashion|*|*|*"] });

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

await getAdminAuth(adminApp).setCustomUserClaims(stranger.uid, { admin: true });
await stranger.auth.currentUser.getIdToken(true);
assert.equal((await getDoc(doc(stranger.db, "marketplaceEvents", eventSnapshot.docs[0].id))).exists(), true);
assert.equal((await getDoc(doc(stranger.db, "userInterests", buyer.uid))).exists(), true);

await Promise.all([seller, buyer, stranger, guest].map(({ app }) => deleteApp(app)));
await deleteAdminApp(adminApp);
console.log("Intelligence emulator integration passed: auth, validation, dedupe, personalization, authoritative Saved signal, private analytics, admin access.");
