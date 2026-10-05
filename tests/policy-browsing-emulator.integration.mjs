// Local demo only. Synthetic credentials remain in memory; every owned fixture is cleaned.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
for (const [key, value] of Object.entries({ GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" })) {
  if (process.env[key] !== undefined) assert.equal(process.env[key], value, `Refuse mismatched ${key}.`);
  process.env[key] = value;
}
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { demoReleasePolicy } = require("../functions/lib/release-policy.js");
const admin = initializeAdmin({ projectId, storageBucket: "demo-takeme.firebasestorage.app" }, randomUUID());
const db = adminFirestore(admin), identities = adminAuth(admin), people = [], prefix = randomUUID();
const mirror = db.doc("releasePolicies/current"), previousMirror = await mirror.get();
const listingId = `policy-browse-${prefix}`, listingRef = db.doc(`listings/${listingId}`);
const policyRequired = error => error.code === "functions/failed-precondition" && error.details?.reason === "account-policy-required";
const unavailable = error => error.code === "functions/failed-precondition" && error.details?.reason === "policy-release-unavailable";
const denied = error => error.code === "permission-denied";
let checks = 0;
async function check(label, action) { await action(); console.log(`PASS ${++checks}: ${label}`); }
async function client(label, signedIn = true) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com` }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const person = { app, auth, firestore, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(person);
  if (signedIn) person.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  return person;
}
const current = person => db.doc(`users/${person.uid}/private/onboarding`);
const acceptance = { acceptTerms: true, acceptPrivacy: true, confirmAge18: true,
  termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion };
async function publicReads(person, seller) {
  const detail = await person.call("getPublicListingDetail", { listingId });
  assert.equal(detail.listing.title, "Synthetic public policy check");
  const page = await person.call("getPublicListingPage", { filters: { sellerId: seller.uid, pageSize: 2 } });
  assert.equal(page.listings.some(item => item.id === listingId), true);
  assert.equal((await person.call("getPublicSellerSummaries", { sellerIds: [seller.uid] })).sellers.length, 1);
  assert.equal((await getDoc(doc(person.firestore, "users", seller.uid))).exists(), true);
  assert.equal((await getDoc(doc(person.firestore, "listings", listingId))).exists(), true);
}
try {
  await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy });
  const guest = await client("guest", false), fresh = await client("fresh"), legacy = await client("legacy"), seller = await client("seller");
  for (const person of [legacy, seller]) await db.doc(`users/${person.uid}`).set({ uid: person.uid,
    displayName: "Synthetic policy fixture", photoURL: null, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  await listingRef.set({ sellerId: seller.uid, title: "Synthetic public policy check", description: "No real goods or exchange.",
    categoryId: "electronics", condition: "Good", price: 25, listingType: "buy_now", status: "active", imageUrls: [],
    privacyVersion: 2, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, location: "Jitra, Kedah",
    createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  const oldEvidence = { termsVersion: "previous-terms-v1", privacyVersion: "previous-privacy-v1", acceptanceSource: "web",
    termsAcceptedAt: Timestamp.fromMillis(1_700_000_000_000), privacyAcceptedAt: Timestamp.fromMillis(1_700_000_000_000),
    age18ConfirmedAt: Timestamp.fromMillis(1_700_000_000_000), profileCompletedAt: Timestamp.fromMillis(1_700_000_000_000),
    welcomeCompletedAt: Timestamp.fromMillis(1_700_000_000_000) };
  await current(legacy).set(oldEvidence);
  const saved = db.doc(`users/${legacy.uid}/saved/${listingId}`), following = db.doc(`users/${legacy.uid}/following/${seller.uid}`);
  await saved.set({ listingId, savedAt: Timestamp.now() }); await following.set({ sellerId: seller.uid, followedAt: Timestamp.now() });
  const beforeSaved = (await saved.get()).data(), beforeFollowing = (await following.get()).data();
  await check("signed-out and signed-in missing/outdated acceptance can read public marketplace content", async () => {
    for (const person of [guest, fresh, legacy]) await publicReads(person, seller);
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "acceptance");
    assert.equal((await legacy.call("getAccountSetupStatus")).step, "acceptance");
    assert.deepEqual((await current(legacy).get()).data(), oldEvidence);
    assert.equal((await current(fresh).get()).exists, false);
  });
  await check("Sell, Chat, Offer, Bid, Follow and upload reject an outdated owner before any mutation", async () => {
    for (const name of ["createFixedListingDraft", "openListingConversation", "sendConversationMessage", "submitOffer", "placeBid", "setSellerFollow", "requestUploadPermits"]) {
      await assert.rejects(legacy.call(name), policyRequired, name);
    }
    await assert.rejects(setDoc(doc(fresh.firestore, "users", fresh.uid, "saved", listingId),
      { listingId, savedAt: serverTimestamp() }), denied);
    await assert.rejects(deleteDoc(doc(legacy.firestore, "users", legacy.uid, "saved", listingId)), denied);
    assert.deepEqual((await current(legacy).get()).data(), oldEvidence);
    assert.deepEqual((await saved.get()).data(), beforeSaved); assert.deepEqual((await following.get()).data(), beforeFollowing);
  });
  await check("explicit reacceptance preserves profile, welcome and prior marketplace records", async () => {
    await legacy.call("acceptWebPolicies", acceptance);
    const accepted = (await current(legacy).get()).data();
    assert.equal(accepted.termsVersion, demoReleasePolicy.termsVersion);
    assert.equal(accepted.privacyVersion, demoReleasePolicy.privacyVersion);
    assert.deepEqual(accepted.profileCompletedAt, oldEvidence.profileCompletedAt);
    assert.deepEqual(accepted.welcomeCompletedAt, oldEvidence.welcomeCompletedAt);
    assert.equal((await legacy.call("getAccountSetupStatus")).step, "ready");
    assert.deepEqual((await saved.get()).data(), beforeSaved); assert.deepEqual((await following.get()).data(), beforeFollowing);
    await publicReads(legacy, seller);
    // Argument validation proves eligibility without creating a marketplace record.
    await assert.rejects(legacy.call("createFixedListingDraft"), { code: "functions/invalid-argument" });
  });
  await check("inactive and malformed policy deny writes while public browsing remains available", async () => {
    for (const change of [{ publicationApproved: false }, { minimumAge: "18" }, { privacyVersion: null }]) {
      await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy, ...change });
      for (const person of [guest, legacy]) await publicReads(person, seller);
      assert.equal((await legacy.call("getAccountSetupStatus")).policyAvailable, false);
      await assert.rejects(legacy.call("acceptWebPolicies", acceptance), unavailable);
      await assert.rejects(legacy.call("createFixedListingDraft"), unavailable);
      await assert.rejects(legacy.call("requestUploadPermits"), unavailable);
    }
    await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy });
  });
  await check("browsing, setup and retries never execute an intended marketplace action", async () => {
    await legacy.call("acceptWebPolicies", acceptance);
    for (const person of [fresh, legacy]) {
      for (const query of [db.collection("listings").where("sellerId", "==", person.uid),
        db.collection("conversations").where("participants", "array-contains", person.uid),
        db.collection("offers").where("buyerId", "==", person.uid),
        db.collectionGroup("bids").where("bidderId", "==", person.uid),
        db.collectionGroup("messages").where("senderId", "==", person.uid)]) assert.equal((await query.limit(1).get()).empty, true);
    }
  });
  await check("deletion_pending still blocks authenticated marketplace browsing and mutations", async () => {
    await db.doc(`accountLifecycles/${legacy.uid}`).set({ state: "deletion_pending", alias: `deleted-synthetic-${prefix}` });
    assert.equal((await legacy.call("getAccountSetupStatus")).step, "deletion");
    await assert.rejects(legacy.call("getPublicListingDetail", { listingId }), { code: "functions/failed-precondition" });
    await assert.rejects(legacy.call("acceptWebPolicies", acceptance), { code: "functions/failed-precondition" });
    await publicReads(guest, seller);
  });
} finally {
  if (previousMirror.exists) await mirror.set(previousMirror.data()); else await mirror.delete();
  await db.recursiveDelete(listingRef);
  for (const person of people) {
    if (person.uid) { await db.recursiveDelete(db.doc(`users/${person.uid}`)); await db.doc(`accountLifecycles/${person.uid}`).delete(); await identities.deleteUser(person.uid); }
    await deleteApp(person.app);
  }
  await deleteAdmin(admin);
}
console.log(`Demo public/protected policy integration: ${checks} groups passed. Existing mirror restored; owned fixtures removed.`);
