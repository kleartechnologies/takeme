import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const adminApp = initializeAdminApp({ projectId }, `public-seller-admin-${Date.now()}`);
const admin = getAdminFirestore(adminApp);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };

function app(label) {
  const firebaseApp = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const functions = getFunctions(firebaseApp, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { firebaseApp, auth, db, functions };
}

const signed = app("public-seller-signed");
const guest = app("public-seller-guest");
await createUserWithEmailAndPassword(signed.auth, `public-seller-${suffix}@example.test`, "TestPass123!");
const sellerIds = Array.from({ length: 40 }, (_, index) => `public-seller-${suffix}-${index}`);
await Promise.all(sellerIds.map((sellerId, index) => admin.doc(`users/${sellerId}`).set({ uid: sellerId, displayName: `Seller ${index}`, photoURL: null, email: `private-${index}@example.test`, location: "Kuala Lumpur" })));
await admin.doc(`trustSummaries/${sellerIds[0]}`).set({
  userId: sellerIds[0], verificationStatus: "verified",
  seller: { completedCount: 30, tier: "gold", reviewCount: 2, ratingSum: 9, averageRating: 4.5, ratingDistribution: { "4": 1, "5": 1 }, lifetimeValueSen: 450000 },
  buyer: { completedCount: 75, tier: "platinum", reviewCount: 1, averageRating: 5 }, internalRiskScore: 87,
});

await assert.rejects(() => setDoc(doc(signed.db, "trustSummaries", sellerIds[0]), { seller: { completedCount: 999 } }), /permission/i);
const call = httpsCallable(guest.functions, "getPublicSellerSummaries");
for (const count of [10, 20, 40]) {
  const result = (await call({ sellerIds: sellerIds.slice(0, count) })).data;
  assert.equal(result.sellers.length, count);
}
const trusted = (await call({ sellerIds: [sellerIds[0]] })).data.sellers[0];
assert.deepEqual(trusted, { uid: sellerIds[0], displayName: "Seller 0", photoURL: null, sellerRating: 4.5, sellerReviewCount: 2, sellerCompletedTransactionCount: 30, sellerTier: "gold", verificationStatus: "verified" });
assert.equal("buyer" in trusted, false);
assert.equal("amountSen" in trusted, false);
assert.equal("lifetimeValueSen" in trusted, false);
assert.equal("internalRiskScore" in trusted, false);
const newcomer = (await call({ sellerIds: [sellerIds[1]] })).data.sellers[0];
assert.equal(newcomer.sellerRating, null);
assert.equal(newcomer.sellerReviewCount, 0);
assert.equal(newcomer.sellerTier, null);

await admin.doc(`trustSummaries/${sellerIds[0]}`).update({ "seller.completedCount": 75, "seller.tier": "platinum" });
const updated = (await call({ sellerIds: [sellerIds[0]] })).data.sellers[0];
assert.equal(updated.sellerCompletedTransactionCount, 75);
assert.equal(updated.sellerTier, "platinum");
await assert.rejects(() => call({ sellerIds: [...sellerIds, "one-too-many"] }), /invalid-argument|up to 40/i);

await Promise.all([deleteApp(signed.firebaseApp), deleteApp(guest.firebaseApp)]);
await deleteAdminApp(adminApp);
console.log("Public seller emulator integration passed: bounded public batching, trusted updates, write denial and private-field exclusion.");
