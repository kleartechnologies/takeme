// Bounded demo-only abuse controls. Synthetic credentials exist only in memory.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadBytes, deleteObject } from "firebase/storage";
import { acceptDemoPolicies, createDemoPassword, permitDemoUpload } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const admin = initializeAdmin({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
const db = adminFirestore(), identities = adminAuth(), bucket = adminStorage().bucket();
const clients = [], tracked = new Set(), objects = new Set();
const prefix = randomUUID().replaceAll("-", "");
// Firebase 12's HTTP transport appends its status; only that known suffix is accepted.
const safeLimited = error => error.code === "functions/resource-exhausted" && error.message?.replace(/ \[429\]$/, "") === "Too many attempts. Please try again shortly."
  && error.details?.reason === "cadence-limit" && Number.isInteger(error.details.retryAfterMs) && error.details.retryAfterMs > 0 && error.details.retryAfterMs <= 120_000
  && Object.keys(error.details).every(key => ["reason", "retryAfterMs"].includes(key));
const denied = error => /permission|unauthorized/.test(error.code ?? "");
let checks = 0;
async function check(label, action) { await action(); console.log(`PASS ${++checks}: ${label}`); }
async function person(label, eligible = true, signedIn = true) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.firebasestorage.app` }, randomUUID());
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app), firestore = getFirestore(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001); connectStorageEmulator(storage, "127.0.0.1", 9199); connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  const value = { app, auth, functions, storage, firestore, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  clients.push(value);
  if (signedIn) {
    value.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
    if (eligible) await acceptDemoPolicies(app, functions);
    await db.doc(`users/${value.uid}`).set({ uid: value.uid, displayName: "Cadence synthetic tester", photoURL: null, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
  return value;
}
async function seedCadence(person, action, count, resourceId) {
  const at = Timestamp.now(), resource = resourceId ? createHash("sha256").update(resourceId).digest("hex") : null;
  await db.doc(`users/${person.uid}/private/cadence-${action}`).set({ version: 1, action,
    events: Array.from({ length: count }, () => ({ at, ...(resource ? { resource } : {}) })), updatedAt: at, expiresAt: Timestamp.fromMillis(at.toMillis() + 60_000) });
}
async function put(path, value) { tracked.add(path); await db.doc(path).set(value); }
const listingInput = { title: `Synthetic cadence ${prefix}`, description: "Synthetic emulator-only item. No real goods or exchange.", categoryId: "electronics", condition: "Good", listingType: "buy_now", price: 100, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" } };
function listing(seller, overrides = {}) { return { ...listingInput, sellerId: seller.uid, status: "active", imageUrls: [], privacyVersion: 2, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...overrides }; }
try {
  const buyer = await person("buyer"), seller = await person("seller"), other = await person("other"), unaccepted = await person("unaccepted", false), guest = await person("guest", false, false);
  const fixedId = `cadence-fixed-${prefix}`, secondId = `cadence-second-${prefix}`, auctionId = `cadence-auction-${prefix}`;
  await put(`listings/${fixedId}`, listing(seller)); await put(`listings/${secondId}`, listing(seller));
  await put(`listings/${auctionId}`, listing(seller, { listingType: "auction", auctionStatus: "active", bidCount: 0, currentBid: 0, currentBidderId: null, startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: Timestamp.fromMillis(Date.now() - 60_000), auctionEndAt: Timestamp.fromMillis(Date.now() + 3_600_000) }));

  await check("unauthenticated and unaccepted accounts cannot mint permits or bypass action eligibility", async () => {
    for (const name of ["requestUploadPermits", "createFixedListingDraft", "submitOffer", "placeBid", "submitMarketplaceReport"]) {
      await assert.rejects(() => guest.call(name), error => error.code === "functions/unauthenticated");
      await assert.rejects(() => unaccepted.call(name), error => error.details?.reason === "account-policy-required");
    }
  });
  await check("two concurrent draft starts at the final allowance commit only one listing", async () => {
    await seedCadence(buyer, "listing", 9);
    const results = await Promise.allSettled([buyer.call("createFixedListingDraft", listingInput), buyer.call("createFixedListingDraft", listingInput)]);
    const accepted = results.filter(value => value.status === "fulfilled"), rejected = results.filter(value => value.status === "rejected");
    assert.equal(accepted.length, 1); assert.equal(rejected.length, 1); assert.ok(safeLimited(rejected[0].reason));
    tracked.add(`listings/${accepted[0].value.listingId}`);
    assert.equal((await db.doc(`users/${buyer.uid}/private/cadence-listing`).get()).data().events.length, 10);
    const query = await db.collection("listings").where("sellerId", "==", buyer.uid).get(); assert.equal(query.size, 1);
  });
  await check("same-listing offer generation is bounded and withdrawal remains available", async () => {
    await seedCadence(buyer, "offer", 7, fixedId);
    const offer = await buyer.call("submitOffer", { listingId: fixedId, type: "offer", amountSen: 9000, paymentMethod: "cod" }); tracked.add(`offers/${offer.offerId}`); tracked.add(`offerLocks/${fixedId}_${buyer.uid}`);
    await buyer.call("respondToOffer", { offerId: offer.offerId, action: "withdraw" });
    await assert.rejects(() => buyer.call("submitOffer", { listingId: fixedId, type: "offer", amountSen: 8500, paymentMethod: "cod" }), safeLimited);
    assert.equal((await db.doc(`offerLocks/${fixedId}_${buyer.uid}`).get()).data().status, "withdrawn");
    const different = await buyer.call("submitOffer", { listingId: secondId, type: "offer", amountSen: 8500, paymentMethod: "cod" }); tracked.add(`offers/${different.offerId}`); tracked.add(`offerLocks/${secondId}_${buyer.uid}`);
    await seedCadence(seller, "offer", 8, secondId);
    await assert.rejects(() => seller.call("respondToOffer", { offerId: different.offerId, action: "counter", amountSen: 9500 }), safeLimited);
    assert.equal((await db.doc(`offers/${different.offerId}`).get()).data().status, "submitted");
    await seller.call("respondToOffer", { offerId: different.offerId, action: "reject" });
  });
  await check("valid bids are throttled atomically without changing stale/increment validation", async () => {
    await seedCadence(buyer, "bid", 179);
    await buyer.call("placeBid", { listingId: auctionId, amount: 1000 });
    await assert.rejects(() => buyer.call("placeBid", { listingId: auctionId, amount: 1000 }), error => error.code === "functions/invalid-argument");
    await assert.rejects(() => buyer.call("placeBid", { listingId: auctionId, amount: 1100 }), safeLimited);
    assert.equal((await db.doc(`listings/${auctionId}`).get()).data().bidCount, 1);
    assert.equal((await db.collection(`listings/${auctionId}/bids`).get()).size, 1);
  });
  await check("distinct reports are bounded while duplicate submission returns its existing receipt", async () => {
    await seedCadence(buyer, "report", 19);
    const report = await buyer.call("submitMarketplaceReport", { targetType: "listing", targetId: fixedId, reason: "spam" }); tracked.add(`reports/${report.reportId}`);
    const duplicate = await buyer.call("submitMarketplaceReport", { targetType: "listing", targetId: fixedId, reason: "spam" }); assert.equal(duplicate.reportId, report.reportId);
    await assert.rejects(() => buyer.call("submitMarketplaceReport", { targetType: "listing", targetId: secondId, reason: "spam" }), safeLimited);
    assert.equal((await db.doc(`reports/listing-${secondId}-${buyer.uid}`).get()).exists, false);
  });
  await check("private counters and permits cannot be read or changed directly by their owner", async () => {
    await assert.rejects(() => getDoc(doc(buyer.firestore, "users", buyer.uid, "private", "cadence-bid")), denied);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "users", buyer.uid, "private", "cadence-bid"), { events: [] }), denied);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "users", buyer.uid, "private", "onboarding"), { uploadPermits: {} }), denied);
  });
  await check("uploads require an exact unexpired owner permit with matching type and size", async () => {
    const path = `users/${buyer.uid}/profile/${prefix}.png`, bytes = new Uint8Array([1, 2, 3]); objects.add(path);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, path), bytes, { contentType: "image/png" }), denied);
    const metadata = await permitDemoUpload(buyer.app, path, "image/png", bytes.length, buyer.functions);
    await assert.rejects(() => uploadBytes(ref(other.storage, path), bytes, metadata), denied);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, `${path}-other`), bytes, metadata), denied);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, path), bytes, { ...metadata, contentType: "image/jpeg" }), denied);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, path), new Uint8Array([1]), metadata), denied);
    const acceptanceRef = db.doc(`users/${buyer.uid}/private/onboarding`), accepted = (await acceptanceRef.get()).data();
    const permitId = metadata.customMetadata.takemeUploadPermit;
    await acceptanceRef.update({ [`uploadPermits.${permitId}.expiresAt`]: Timestamp.fromMillis(Date.now() - 1) });
    await assert.rejects(() => uploadBytes(ref(buyer.storage, path), bytes, metadata), denied);
    await acceptanceRef.set(accepted);
    await uploadBytes(ref(buyer.storage, path), bytes, metadata);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, path), bytes, metadata), denied, "create-only denies replay overwrite");
    await deleteObject(ref(buyer.storage, path));
    // Documented scope: owner deletion allows recreating this exact path until expiry.
    await uploadBytes(ref(buyer.storage, path), bytes, metadata);
    await deleteObject(ref(buyer.storage, path));
    const listingPath = `users/${seller.uid}/listings/${fixedId}/permit-${prefix}.png`; objects.add(listingPath);
    const listingMetadata = await permitDemoUpload(seller.app, listingPath, "image/png", bytes.length, seller.functions);
    await uploadBytes(ref(seller.storage, listingPath), bytes, listingMetadata);
    await assert.rejects(() => uploadBytes(ref(seller.storage, listingPath), bytes, listingMetadata), denied, "existing listing images cannot be overwritten");
    await deleteObject(ref(seller.storage, listingPath));
  });
  await check("forged paths, batch duplicates, wrong owners and locked auction paths are refused before permits", async () => {
    const upload = path => ({ path, contentType: "image/png", sizeBytes: 3 });
    for (const uploads of [[upload(`users/${other.uid}/profile/x`)], [upload(`users/${buyer.uid}/profile/../x`)], Array.from({ length: 9 }, (_, i) => upload(`users/${buyer.uid}/profile/${i}`)), [upload(`users/${buyer.uid}/profile/same`), upload(`users/${buyer.uid}/profile/same`)]]) {
      await assert.rejects(() => buyer.call("requestUploadPermits", { uploads }), error => error.code === "functions/invalid-argument");
    }
    await assert.rejects(() => buyer.call("requestUploadPermits", { uploads: [upload(`users/${buyer.uid}/listings/${fixedId}/wrong`)] }), denied);
    await assert.rejects(() => seller.call("requestUploadPermits", { uploads: [upload(`users/${seller.uid}/listings/${auctionId}/locked`)] }), denied);
  });
  await check("every batch start is charged and rejected batches create no permit", async () => {
    await seedCadence(buyer, "upload", 63);
    const uploads = [0, 1].map(i => ({ path: `users/${buyer.uid}/profile/burst-${i}-${prefix}`, contentType: "image/png", sizeBytes: 3 }));
    const before = (await db.doc(`users/${buyer.uid}/private/onboarding`).get()).data().uploadPermits;
    await assert.rejects(() => buyer.call("requestUploadPermits", { uploads }), safeLimited);
    assert.deepEqual((await db.doc(`users/${buyer.uid}/private/onboarding`).get()).data().uploadPermits, before);
    const issued = await buyer.call("requestUploadPermits", { uploads: uploads.slice(0, 1) }); assert.equal(issued.permits.length, 1);
    await assert.rejects(() => buyer.call("requestUploadPermits", { uploads: uploads.slice(1) }), safeLimited);
  });
  await check("expired cadence and permit state is pruned on reuse without a TTL activation", async () => {
    const old = Timestamp.fromMillis(Date.now() - 180_000);
    await db.doc(`users/${buyer.uid}/private/cadence-upload`).set({ version: 1, action: "upload", events: Array.from({ length: 64 }, () => ({ at: old })), updatedAt: old, expiresAt: old });
    const acceptance = db.doc(`users/${buyer.uid}/private/onboarding`);
    await acceptance.update({ uploadPermits: { expired: { path: `users/${buyer.uid}/profile/old`, contentType: "image/png", sizeBytes: 3, expiresAt: old } } });
    const issued = await buyer.call("requestUploadPermits", { uploads: [{ path: `users/${buyer.uid}/profile/recovered-${prefix}`, contentType: "image/png", sizeBytes: 3 }] });
    assert.equal(issued.permits.length, 1);
    assert.equal((await db.doc(`users/${buyer.uid}/private/cadence-upload`).get()).data().events.length, 1);
    assert.equal(Object.keys((await acceptance.get()).data().uploadPermits).length, 1);
    assert.equal("expired" in (await acceptance.get()).data().uploadPermits, false);
  });
  await check("deletion-pending guard and atomic acceptance erasure revoke outstanding permits", async () => {
    await db.doc(`users/${other.uid}/private/cadence-upload`).delete();
    const path = `users/${other.uid}/profile/pending-${prefix}`, metadata = await permitDemoUpload(other.app, path, "image/png", 3, other.functions);
    tracked.add(`accountLifecycles/${other.uid}`);
    const batch = db.batch(); batch.set(db.doc(`accountLifecycles/${other.uid}`), { state: "deletion_pending" }); batch.delete(db.doc(`users/${other.uid}/private/onboarding`)); await batch.commit();
    await assert.rejects(() => other.call("requestUploadPermits", { uploads: [{ path, contentType: "image/png", sizeBytes: 3 }] }), error => error.code === "functions/failed-precondition");
    await assert.rejects(() => uploadBytes(ref(other.storage, path), new Uint8Array([1, 2, 3]), metadata), denied);
  });
} finally {
  for (const path of objects) await bucket.file(path).delete({ ignoreNotFound: true });
  for (const path of tracked) await db.recursiveDelete(db.doc(path));
  for (const person of clients) {
    if (person.uid) { await db.recursiveDelete(db.doc(`users/${person.uid}`)); await identities.deleteUser(person.uid).catch(() => undefined); }
    await deleteApp(person.app);
  }
  await deleteAdmin(admin);
}
console.log(`Bounded demo cadence/upload integration checks passed: ${checks}.`);
