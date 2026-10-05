// Demo/loopback only. Credentials are generated in memory; only owned synthetic
// fixtures are removed, and both server-owned release records are restored.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getMetadata, deleteObject } from "firebase/storage";
import { acceptDemoPolicies, permitDemoUpload, createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme", bucketName = "demo-takeme.firebasestorage.app";
for (const [key, value] of Object.entries({ GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" })) {
  if (process.env[key] !== undefined) assert.equal(process.env[key], value, `Refuse mismatched ${key}.`);
  process.env[key] = value;
}
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin, getApps } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const { demoReleasePolicy } = require("../functions/lib/release-policy.js");
const { UPLOAD_PERMIT_TTL_MS } = require("../functions/lib/upload-permit-domain.js");
const admin = initializeAdmin({ projectId, storageBucket: bucketName }, randomUUID());
const db = adminFirestore(admin), identities = adminAuth(admin), bucket = adminStorage(admin).bucket();
const mirror = db.doc("releasePolicies/current"), control = db.doc("releaseControls/current");
const previousMirror = await mirror.get(), previousControl = await control.get();
const people = [], paths = new Set(), objects = new Set(), prefix = randomUUID();
const fixedId = `maintenance-${prefix}`, endingId = `${fixedId}-ending`, startingId = `${fixedId}-starting`;
const normalControl = { releaseTarget: "demo", projectId, protectedWritesPaused: false };
const maintenance = error => error.code === "functions/failed-precondition" && error.details?.reason === "protected-writes-paused";
const policyRequired = error => error.code === "functions/failed-precondition" && error.details?.reason === "account-policy-required";
const policyUnavailable = error => error.code === "functions/failed-precondition" && error.details?.reason === "policy-release-unavailable";
const denied = error => /permission-denied|unauthorized/.test(error.code ?? "");
let groups = 0;
async function check(label, run) { await run(); console.log(`PASS ${++groups}: ${label}`); }
async function put(path, value) { paths.add(path); await db.doc(path).set(value); }
async function client(label, signedIn = true) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, storageBucket: bucketName }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001); connectStorageEmulator(storage, "127.0.0.1", 9199);
  const person = { app, auth, firestore, functions, storage, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(person);
  if (signedIn) {
    person.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
    await put(`users/${person.uid}`, { uid: person.uid, displayName: "Synthetic maintenance account", photoURL: null, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
  return person;
}
const setup = person => db.doc(`users/${person.uid}/private/onboarding`);
const generalLocation = { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" };
const draft = { title: "Synthetic maintenance listing", description: "Synthetic emulator-only item. No real goods or exchange.", categoryId: "electronics", condition: "Good", price: 100, listingType: "buy_now", publicLocation: generalLocation, meetupLocationId: null };
const protectedCalls = ["createFixedListingDraft", "publishFixedListing", "updateFixedListing", "removeFixedListing", "createAuctionListing", "publishAuctionListing", "updateAuctionListing", "cancelAuction", "openListingConversation", "openTransactionConversation", "sendConversationMessage", "markConversationSeen", "submitOffer", "respondToOffer", "placeBid", "setSellerFollow", "requestUploadPermits", "saveSearch", "deleteSavedSearch", "markNotificationRead", "openNotification", "markAllNotificationsRead", "setNotificationPreference", "submitMarketplaceReport", "submitTransactionReview", "reportPublicReview", "confirmTransactionCompletion", "requestTransactionCancellation", "declineTransactionCancellation", "disputeTransaction", "trackMarketplaceEvent", "trackPromotionEngagement", "createPromotionRequest", "cancelPromotionRequest", "updateAdminReport"];
async function publicReads(person, seller) {
  assert.equal((await person.call("getPublicListingDetail", { listingId: fixedId })).listing.title, draft.title);
  assert.equal((await person.call("getPublicListingPage", { filters: { sellerId: seller.uid, pageSize: 2 } })).listings.some(item => item.id === fixedId), true);
  assert.equal((await person.call("getPublicSellerSummaries", { sellerIds: [seller.uid] })).sellers.length, 1);
  assert.equal((await getDoc(doc(person.firestore, "users", seller.uid))).exists(), true);
  assert.equal((await getDoc(doc(person.firestore, "listings", fixedId))).exists(), true);
}
try {
  await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy });
  await control.delete();
  const seller = await client("seller"), buyer = await client("buyer"), outdated = await client("outdated"), guest = await client("guest", false);
  for (const person of [seller, buyer, outdated]) await acceptDemoPolicies(person.app, person.functions);
  await put(`listings/${fixedId}`, { sellerId: seller.uid, ...draft, status: "active", imageUrls: [], privacyVersion: 2, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  const saved = doc(buyer.firestore, "users", buyer.uid, "saved", fixedId);
  const save = () => setDoc(saved, { listingId: fixedId, savedAt: serverTimestamp() });
  await check("missing control explicitly preserves normal protected behavior", async () => {
    assert.deepEqual(await buyer.call("getProtectedWriteStatus"), { protectedWritesPaused: false });
    await save(); await deleteDoc(saved);
    const created = await buyer.call("createFixedListingDraft", draft);
    paths.add(`listings/${created.listingId}`);
    assert.equal((await db.doc(`listings/${created.listingId}`).get()).data().status, "draft");
  });
  await control.set(normalControl);
  let conversationId, offerId;
  await check("explicit OFF allows confirmed follow, Chat, message, Offer, Save and profile update", async () => {
    await save();
    await updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Synthetic updated account", updatedAt: serverTimestamp() });
    assert.equal((await buyer.call("setSellerFollow", { sellerId: seller.uid, following: true })).following, true);
    ({ conversationId } = await buyer.call("openListingConversation", { listingId: fixedId }));
    paths.add(`conversations/${conversationId}`);
    await buyer.call("sendConversationMessage", { conversationId, body: "Synthetic existing message before maintenance.", idempotencyKey: randomUUID() });
    ({ offerId } = await buyer.call("submitOffer", { listingId: fixedId, type: "offer", amountSen: 9000, paymentMethod: "cod" }));
    paths.add(`offers/${offerId}`); paths.add(`offerLocks/${fixedId}_${buyer.uid}`);
  });
  await control.set({ ...normalControl, protectedWritesPaused: true });
  await check("ON rejects all protected callables with the same safe typed failure before argument validation", async () => {
    assert.deepEqual(await guest.call("getProtectedWriteStatus"), { protectedWritesPaused: true });
    for (const name of protectedCalls) await assert.rejects(buyer.call(name), error => { assert.deepEqual(error.details, { reason: "protected-writes-paused" }); return maintenance(error); }, name);
  });
  await check("ON denies direct Save/profile/meet-up/private-address writes and keeps control server-owned", async () => {
    await assert.rejects(deleteDoc(saved), denied);
    await assert.rejects(updateDoc(doc(buyer.firestore, "users", buyer.uid), { displayName: "Forbidden maintenance edit", updatedAt: serverTimestamp() }), denied);
    await assert.rejects(setDoc(doc(buyer.firestore, "users", buyer.uid, "meetupLocations", "synthetic"), { ownerId: buyer.uid, name: "Synthetic public meet-up", area: "Jitra", state: "Kedah", country: "Malaysia", isDefault: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), denied);
    await assert.rejects(setDoc(doc(buyer.firestore, "privateUserAddresses", buyer.uid), { uid: buyer.uid, addressLine1: "Synthetic test value", addressLine2: "", postcode: "00000", city: "Jitra", state: "Kedah", country: "Malaysia", updatedAt: serverTimestamp() }), denied);
    await assert.rejects(getDoc(doc(guest.firestore, "releaseControls", "current")), denied);
    assert.deepEqual(await guest.call("getProtectedWriteStatus"), { protectedWritesPaused: true });
    await assert.rejects(setDoc(doc(buyer.firestore, "releaseControls", "current"), normalControl), denied);
    await assert.rejects(getDocs(collection(buyer.firestore, "releaseControls")), denied);
    const bootstrap = await client("bootstrap");
    await db.doc(`users/${bootstrap.uid}`).delete();
    await setDoc(doc(bootstrap.firestore, "users", bootstrap.uid), { uid: bootstrap.uid, displayName: "Synthetic bootstrap account", photoURL: null, location: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    assert.equal((await getDoc(doc(bootstrap.firestore, "users", bootstrap.uid))).exists(), true);
  });
  await check("ON preserves signed-out/signed-in public browsing and existing private marketplace reads", async () => {
    for (const person of [guest, buyer, outdated]) await publicReads(person, seller);
    assert.equal((await buyer.call("getConversation", { conversationId })).conversation.id, conversationId);
    assert.equal((await buyer.call("getConversationMessages", { conversationId })).items.length, 1);
    assert.equal((await getDoc(saved)).exists(), true);
    assert.equal((await buyer.call("getFollowState", { sellerId: seller.uid })).following, true);
    assert.equal((await db.doc(`offers/${offerId}`).get()).data().status, "submitted");
  });
  await check("malformed, extra/missing fields and mismatched control identities fail closed", async () => {
    const malformed = [{ ...normalControl, protectedWritesPaused: "false" }, { ...normalControl, protectedWritesPaused: null }, { ...normalControl, protectedWritesPaused: 0 }, { ...normalControl, extraApproval: true }, { ...normalControl, releaseTarget: "production" }, { ...normalControl, projectId: "takeme-52b80" }];
    for (const key of Object.keys(normalControl)) { const value = { ...normalControl }; delete value[key]; malformed.push(value); }
    for (const value of malformed) {
      await control.set(value);
      assert.deepEqual(await buyer.call("getProtectedWriteStatus"), { protectedWritesPaused: true });
      await assert.rejects(buyer.call("createFixedListingDraft", draft), maintenance);
      await assert.rejects(deleteDoc(saved), denied);
      await publicReads(guest, seller);
    }
    await control.set({ ...normalControl, protectedWritesPaused: true });
  });
  await check("maintenance takes precedence over inactive policy and outdated acceptance; OFF restores normal guards", async () => {
    const original = (await setup(outdated).get()).data();
    await setup(outdated).update({ termsVersion: "synthetic-old-policy" });
    await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy, publicationApproved: false });
    for (const person of [buyer, outdated]) await assert.rejects(person.call("requestUploadPermits"), maintenance);
    await publicReads(outdated, seller);
    await control.set(normalControl);
    await assert.rejects(buyer.call("requestUploadPermits"), policyUnavailable);
    await mirror.set({ releaseTarget: "demo", projectId, ...demoReleasePolicy });
    await assert.rejects(outdated.call("requestUploadPermits"), policyRequired);
    await setup(outdated).set(original);
  });
  await check("reopening does not execute any attempted action without another confirmation", async () => {
    assert.deepEqual(await buyer.call("getProtectedWriteStatus"), { protectedWritesPaused: false });
    assert.equal((await db.collection("listings").where("sellerId", "==", buyer.uid).get()).size, 1);
    assert.equal((await db.collection("offers").where("buyerId", "==", buyer.uid).get()).size, 1);
    assert.equal((await db.collection(`conversations/${conversationId}/messages`).get()).size, 1);
    assert.equal((await getDoc(saved)).exists(), true);
    assert.equal((await db.doc(`users/${buyer.uid}`).get()).data().displayName, "Synthetic updated account");
    await buyer.call("setSellerFollow", { sellerId: seller.uid, following: false });
    assert.equal((await buyer.call("getFollowState", { sellerId: seller.uid })).following, false);
  });
  await check("new permits stop while existing leases remain bounded and owner cleanup remains allowed", async () => {
    assert.equal(UPLOAD_PERMIT_TTL_MS, 120000);
    const mediaPath = `users/${buyer.uid}/profile/${prefix}-lease.png`;
    const metadata = await permitDemoUpload(buyer.app, mediaPath, "image/png", 3, buyer.functions);
    const permitId = metadata.customMetadata.takemeUploadPermit;
    const permit = (await setup(buyer).get()).data().uploadPermits[permitId];
    assert.ok(permit.expiresAt.toMillis() > Date.now());
    assert.ok(permit.expiresAt.toMillis() - Date.now() <= UPLOAD_PERMIT_TTL_MS);
    await control.set({ ...normalControl, protectedWritesPaused: true });
    await assert.rejects(buyer.call("requestUploadPermits", { uploads: [{ path: mediaPath, contentType: "image/png", sizeBytes: 3 }] }), maintenance);
    objects.add(mediaPath);
    await uploadBytes(ref(buyer.storage, mediaPath), new Uint8Array([1, 2, 3]), metadata);
    assert.equal((await getMetadata(ref(guest.storage, mediaPath))).size, 3);
    await deleteObject(ref(buyer.storage, mediaPath));
    await setup(buyer).update({ [`uploadPermits.${permitId}.expiresAt`]: Timestamp.fromMillis(Date.now() - 1) });
    await assert.rejects(uploadBytes(ref(buyer.storage, mediaPath), new Uint8Array([1, 2, 3]), metadata), denied);
  });
  await check("auction lifecycle continues to original clocks and keeps the existing highest bidder", async () => {
    const now = Timestamp.now();
    const expired = Timestamp.fromMillis(now.toMillis() - 1000), later = Timestamp.fromMillis(now.toMillis() + 3600000);
    const base = { sellerId: seller.uid, ...draft, listingType: "auction", status: "active", startingBid: 10000, minimumBidIncrement: 100, privacyVersion: 2, location: "Jitra, Kedah", auctionStartAt: Timestamp.fromMillis(now.toMillis() - 3600000) };
    await put(`listings/${endingId}`, { ...base, auctionStatus: "active", auctionEndAt: expired, bidCount: 1, currentBid: 10500, currentBidderId: buyer.uid });
    await put(`listings/${startingId}`, { ...base, auctionStatus: "scheduled", auctionEndAt: later, bidCount: 0, currentBid: null, currentBidderId: null });
    const { _test } = require("../functions/lib/index.js");
    await _test.advanceDueAuctions(now);
    const ended = (await db.doc(`listings/${endingId}`).get()).data();
    assert.equal(ended.auctionStatus, "ended"); assert.equal(ended.winnerId, buyer.uid); assert.equal(ended.finalBid, 10500); assert.equal(ended.auctionEndAt.toMillis(), expired.toMillis());
    const started = (await db.doc(`listings/${startingId}`).get()).data();
    assert.equal(started.auctionStatus, "active"); assert.equal(started.auctionEndAt.toMillis(), later.toMillis());
    await assert.rejects(buyer.call("placeBid", { listingId: startingId, amount: 10100 }), maintenance);
    paths.add(`transactions/auction-${endingId}`); paths.add(`listingDeals/${endingId}`);
  });
} finally {
  if (previousControl.exists) await control.set(previousControl.data()); else await control.delete();
  if (previousMirror.exists) await mirror.set(previousMirror.data()); else await mirror.delete();
  for (const mediaPath of objects) await bucket.file(mediaPath).delete({ ignoreNotFound: true });
  for (const target of paths) await db.recursiveDelete(db.doc(target));
  for (const person of people) {
    if (person.uid) {
      for (const target of [`sellerFollowers/${person.uid}`, `sellerFollowSummaries/${person.uid}`, `notificationSummaries/${person.uid}`, `notificationPreferences/${person.uid}`, `accountLifecycles/${person.uid}`, `userInterests/${person.uid}`]) await db.recursiveDelete(db.doc(target));
      await db.recursiveDelete(db.doc(`users/${person.uid}`));
      await identities.deleteUser(person.uid);
    }
    await deleteApp(person.app);
  }
  for (const app of getApps()) await deleteAdmin(app);
}
console.log(`Demo protected-write maintenance: ${groups} groups passed. Release records restored; owned fixtures removed.`);
