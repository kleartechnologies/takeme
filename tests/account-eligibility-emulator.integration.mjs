// Explicit demo only. Random identities and credentials remain in memory.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, deleteObject } from "firebase/storage";
import { acceptDemoPolicies, permitDemoUpload, createDemoPassword } from "./helpers/demo-eligibility.mjs";

process.env.GCLOUD_PROJECT = "demo-takeme";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const { marketplaceMutationCall, runGuardedTransaction } = require("../functions/lib/account-lifecycle.js");
const adminApp = initializeAdmin({ projectId: "demo-takeme", storageBucket: "demo-takeme.firebasestorage.app" });
const { DELETION_POLICY_VERSION } = require("../functions/lib/account-deletion.js");
const { getAccountSetupStatus, acceptWebPolicies } = require("../functions/lib/auth-onboarding.js");
const db = adminFirestore(), identities = adminAuth(), bucket = adminStorage().bucket();
const people = [], paths = new Set(), media = new Set();
const prefix = randomUUID().replaceAll("-", "");
let mirrorBefore, passed = 0;
const policyRequired = error => error.code === "functions/failed-precondition" && error.details?.reason === "account-policy-required";
const unavailable = error => error.code === "functions/failed-precondition" && error.details?.reason === "policy-release-unavailable";
const permission = error => /permission|unauthorized/.test(error.code ?? "");
async function check(label, fn) { await fn(); console.log(`PASS ${++passed}: ${label}`); }
const setup = person => db.doc(`users/${person.uid}/private/onboarding`);
async function put(path, data) { paths.add(path); await db.doc(path).set(data); }
async function client(label, provider = "password") {
  const app = initializeApp({ projectId: "demo-takeme", apiKey: "demo-api-key", authDomain: "demo-takeme.firebaseapp.com", storageBucket: "demo-takeme.firebasestorage.app" }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001); connectStorageEmulator(storage, "127.0.0.1", 9199);
  const person = { app, auth, firestore, storage, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(person);
  const email = `${label}-${prefix}@example.test`;
  person.uid = provider === "google"
    ? (await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: randomUUID(), email, email_verified: true })))).user.uid
    : (await createUserWithEmailAndPassword(auth, email, createDemoPassword())).user.uid;
  await setDoc(doc(firestore, "users", person.uid), { uid: person.uid, displayName: "Eligibility demo", photoURL: null, location: "Jitra, Kedah", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return person;
}
function listing(seller, overrides = {}) {
  return { sellerId: seller.uid, title: "Synthetic eligibility demo", description: "No real goods or exchange", categoryId: "electronics", price: 100, condition: "Good", listingType: "buy_now", status: "active", imageUrls: [], privacyVersion: 2, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...overrides };
}
const mutations = ["requestUploadPermits", "createFixedListingDraft", "publishFixedListing", "updateFixedListing", "removeFixedListing", "createAuctionListing", "publishAuctionListing", "updateAuctionListing", "placeBid", "cancelAuction", "submitOffer", "respondToOffer", "submitTransactionReview", "reportPublicReview", "confirmTransactionCompletion", "requestTransactionCancellation", "declineTransactionCancellation", "disputeTransaction", "openListingConversation", "openTransactionConversation", "sendConversationMessage", "markConversationSeen", "markNotificationRead", "openNotification", "markAllNotificationsRead", "setNotificationPreference", "setSellerFollow", "saveSearch", "deleteSavedSearch", "createPromotionRequest", "cancelPromotionRequest", "trackPromotionEngagement", "submitMarketplaceReport", "trackMarketplaceEvent", "createProtectedPayment", "respondToProtectedDispute", "addProtectedDisputeEvidence", "updateAdminReport"];
try {
  const buyer = await client("buyer"), seller = await client("seller"), google = await client("google", "google");
  await acceptDemoPolicies(seller.app);
  mirrorBefore = (await db.doc("releasePolicies/current").get()).data();
  const lid = `eligibility-${prefix}`; await put(`listings/${lid}`, listing(seller));
  await check("every marketplace mutation rejects an unaccepted password account before validating input", async () => {
    for (const name of mutations) await assert.rejects(() => buyer.call(name), policyRequired, name);
    assert.deepEqual((await buyer.call("getSavedSearches")).items, []);
    assert.equal((await buyer.call("getAccountSetupStatus")).step, "acceptance");
  });
  await check("direct Google sign-in has the same server eligibility requirements", async () => {
    for (const name of ["createFixedListingDraft", "placeBid", "submitOffer", "setSellerFollow", "sendConversationMessage", "saveSearch"]) await assert.rejects(() => google.call(name), policyRequired);
    await acceptDemoPolicies(google.app);
    const result = await google.call("setSellerFollow", { sellerId: seller.uid, following: true }); assert.equal(result.following, true);
  });
  await check("profile bootstrap remains possible but direct Saved/profile/address/meetup/media writes require acceptance", async () => {
    assert.equal((await getDoc(doc(buyer.firestore, "users", buyer.uid))).exists(), true);
    await assert.rejects(() => updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Changed" }), permission);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "users", buyer.uid, "saved", lid), { listingId: lid, savedAt: serverTimestamp() }), permission);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "privateUserAddresses", buyer.uid), { uid: buyer.uid, addressLine1: "Synthetic private address", addressLine2: "", postcode: "06000", city: "Jitra", state: "Kedah", country: "Malaysia", updatedAt: serverTimestamp() }), permission);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "users", buyer.uid, "meetupLocations", "test"), { ownerId: buyer.uid, name: "Synthetic public place", area: "Jitra", state: "Kedah", country: "Malaysia", isDefault: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), permission);
    await assert.rejects(() => uploadBytes(ref(buyer.storage, `users/${buyer.uid}/profile/before.png`), new Uint8Array([1]), { contentType: "image/png" }), permission);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "releasePolicies", "current"), mirrorBefore), permission);
    await assert.rejects(() => setDoc(doc(buyer.firestore, "users", buyer.uid, "private", "onboarding"), { ...mirrorBefore, age18ConfirmedAt: serverTimestamp() }), permission);
  });
  await check("accepted accounts can create listings, bid, offer, follow, chat, save and manage preferences", async () => {
    await acceptDemoPolicies(buyer.app);
    const draft = await buyer.call("createFixedListingDraft", { title: "Synthetic test listing", description: "Synthetic demonstration only; no real goods or exchange", listingType: "buy_now", price: 20, categoryId: "electronics", condition: "Good", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" } });
    paths.add(`listings/${draft.listingId}`);
    const auctionId = `auction-${prefix}`;
    await put(`listings/${auctionId}`, listing(seller, { listingType: "auction", auctionStatus: "active", startingBid: 10000, currentBid: 0, bidCount: 0, minimumBidIncrement: 500, currentBidderId: null, winnerId: null, auctionStartAt: Timestamp.fromMillis(Date.now() - 60_000), auctionEndAt: Timestamp.fromMillis(Date.now() + 3_600_000) }));
    await buyer.call("placeBid", { listingId: auctionId, amount: 10000 });
    await buyer.call("submitOffer", { listingId: lid, type: "offer", paymentMethod: "cod", amountSen: 9000, idempotencyKey: `offer-${prefix}` });
    await buyer.call("setSellerFollow", { sellerId: seller.uid, following: true });
    const conversation = await buyer.call("openListingConversation", { listingId: lid });
    await buyer.call("sendConversationMessage", { conversationId: conversation.conversationId, body: "Synthetic emulator message", idempotencyKey: `message-${prefix}` });
    await buyer.call("saveSearch", { criteria: { query: `eligibility${prefix}` }, frequency: "instant", requestId: prefix });
    await buyer.call("setNotificationPreference", { type: "saved_price_drop", frequency: "instant" });
    await updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Accepted demo" });
    await setDoc(doc(buyer.firestore, "users", buyer.uid, "saved", lid), { listingId: lid, savedAt: serverTimestamp() });
    const path = `users/${buyer.uid}/profile/accepted.png`; media.add(path);
    await uploadBytes(ref(buyer.storage, path), new Uint8Array([1]), await permitDemoUpload(buyer.app, path, "image/png", 1));
    const listingPath = `users/${buyer.uid}/listings/${draft.listingId}/accepted.png`; media.add(listingPath);
    await uploadBytes(ref(buyer.storage, listingPath), new Uint8Array([1]), await permitDemoUpload(buyer.app, listingPath, "image/png", 1));
  });
  await check("wrong versions and per-account revocation deny callable and direct writes immediately", async () => {
    const accepted = (await setup(buyer).get()).data();
    for (const patch of [{ termsVersion: "old" }, { privacyVersion: "old" }, { age18ConfirmedAt: null }, { revokedAt: Timestamp.now() }]) {
      await setup(buyer).set({ ...accepted, ...patch });
      await assert.rejects(() => buyer.call("createFixedListingDraft"), policyRequired);
      await assert.rejects(() => updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Denied" }), permission);
      await assert.rejects(() => deleteDoc(doc(buyer.firestore, "users", buyer.uid, "saved", lid)), permission);
      await assert.rejects(() => deleteObject(ref(buyer.storage, `users/${buyer.uid}/profile/accepted.png`)), permission);
    }
    await setup(buyer).delete(); await assert.rejects(() => buyer.call("saveSearch"), policyRequired);
    await acceptDemoPolicies(buyer.app);
  });
  await check("policy mirror revocation fails closed and status exposes friendly unavailable metadata", async () => {
    try {
      await db.doc("releasePolicies/current").update({ publicationApproved: false });
      const status = await buyer.call("getAccountSetupStatus");
      assert.equal(status.step, "acceptance"); assert.equal(status.policyAvailable, false); assert.equal(status.termsVersion, null); assert.equal(status.privacyVersion, null);
      await assert.rejects(() => buyer.call("createFixedListingDraft"), unavailable);
      await assert.rejects(() => buyer.call("acceptWebPolicies", { termsVersion: mirrorBefore.termsVersion, privacyVersion: mirrorBefore.privacyVersion, acceptTerms: true, acceptPrivacy: true, confirmAge18: true }), unavailable);
      await assert.rejects(() => updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Denied" }), permission);
    } finally { await db.doc("releasePolicies/current").set(mirrorBefore); }
  });
  await check("revocation after the callable precheck prevents the guarded transaction from writing", async () => {
    let entered, release;
    const barrier = new Promise(resolve => { entered = resolve; }); const hold = new Promise(resolve => { release = resolve; });
    const path = `eligibilityProbes/${prefix}`; paths.add(path);
    const mutation = marketplaceMutationCall(async () => {
      entered(); await hold; // Revoke after the outer guard, before acquiring transaction read locks.
      return runGuardedTransaction(db, async tx => {
        await tx.get(db.doc(path));
        tx.set(db.doc(path), { ownerId: buyer.uid });
      });
    });
    const pending = mutation.run({ auth: { uid: buyer.uid, token: {} }, data: {} });
    await Promise.race([barrier, pending]); await setup(buyer).delete(); release();
    await assert.rejects(() => pending, error => error.code === "failed-precondition" && error.details?.reason === "account-policy-required");
    assert.equal((await db.doc(path).get()).exists, false);
    await acceptDemoPolicies(buyer.app);
  });
  await check("legacy exact addresses and mixed-case abbreviations are omitted from Following and denied by direct public reads", async () => {
    const original = (await db.doc(`users/${seller.uid}`).get()).data();
    for (const location of ["99 Jalan Synthetic Private, Kedah", "jLn Synthetic Private, Kedah", "lRg Synthetic Private, Kedah", "TaMaN Synthetic Private, Kedah", "Condo Synthetic Private, Kedah", "UnIt Synthetic Private, Kedah"]) {
      await db.doc(`users/${seller.uid}`).update({ location });
      const follow = (await buyer.call("getFollowing")).items.find(item => item.sellerId === seller.uid);
      assert.equal(follow.location, ""); assert.equal(JSON.stringify(follow).includes(location), false);
      await assert.rejects(() => getDoc(doc(google.firestore, "users", seller.uid)), permission);
    }
    await db.doc(`users/${seller.uid}`).set(original);
    assert.equal((await buyer.call("getFollowing")).items.find(item => item.sellerId === seller.uid).location, "Jitra, Kedah");
  });
  await check("unavailable production context reports acceptance without activating a draft policy", async () => {
    const old = process.env.TAKEME_RELEASE_TARGET;
    try {
      process.env.TAKEME_RELEASE_TARGET = "production";
      const request = { auth: { uid: buyer.uid, token: {} }, data: {} };
      const status = await getAccountSetupStatus.run(request);
      assert.equal(status.step, "acceptance"); assert.equal(status.policyAvailable, false); assert.equal(status.termsVersion, null);
      await assert.rejects(() => acceptWebPolicies.run(request), error => error.details?.reason === "policy-release-unavailable");
    } finally { if (old === undefined) delete process.env.TAKEME_RELEASE_TARGET; else process.env.TAKEME_RELEASE_TARGET = old; }
  });
  console.log(`Account eligibility emulator checks: ${passed} passed; ${mutations.length} mutation entry points denied before acceptance.`);
} finally {
  if (mirrorBefore) await db.doc("releasePolicies/current").set(mirrorBefore);
  for (const path of paths) await db.recursiveDelete(db.doc(path));
  for (const person of people) {
    if (person.uid) {
      // The existing deletion infrastructure cleans server-created marketplace mirrors safely.
      try { await person.call("requestAccountDeletion", { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION, expectedOwnerUid: person.uid }); } catch { /* Cleanup below is scoped to disposable fixtures. */ }
      await db.recursiveDelete(db.doc(`users/${person.uid}`));
      try { await identities.deleteUser(person.uid); } catch { /* Already removed by deletion. */ }
    }
    await deleteApp(person.app);
  }
  for (const path of media) await bucket.file(path).delete({ ignoreNotFound: true });
  await deleteAdmin(adminApp);
}
