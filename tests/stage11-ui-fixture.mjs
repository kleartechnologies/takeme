// Local visual fixtures only. Every SDK is explicitly attached to demo emulators.
// Run while `firebase emulators:start --project demo-takeme` is running.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
const functionsRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore: getAdminFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const { _test } = functionsRequire("./lib/index.js");
const adminDb = getAdminFirestore();
const suffix = Date.now();
const password = "LocalTest123!"; // Disposable emulator credential; never production.
const apps = [];
async function person(role) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" }, `${role}-${suffix}`);
  apps.push(app);
  const auth = getAuth(app), db = getFirestore(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  const email = `ui-${role}-${suffix}@example.test`;
  await createUserWithEmailAndPassword(auth, email, password);
  const uid = auth.currentUser.uid;
  await setDoc(doc(db, "users", uid), { uid, displayName: `Local ${role}`, photoURL: null, location: "Jitra, Kedah", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { app, uid, email, db, functions, storage };
}
const call = async (user, name, data = {}) => (await httpsCallable(user.functions, name)(data)).data;
try {
  const seller = await person("seller"), buyer = await person("buyer"), secondBidder = await person("bidder");
  const input = { title: "Synthetic camera for local UI verification", description: "Synthetic local test product. No real sale or personal information.", categoryId: "electronics", condition: "Good", price: 25, listingType: "buy_now", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" } };
  async function listing(title) {
    const id = (await call(seller, "createFixedListingDraft", { ...input, title })).listingId;
    const image = ref(seller.storage, `users/${seller.uid}/listings/${id}/synthetic.png`);
    await uploadBytes(image, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" });
    await call(seller, "publishFixedListing", { listingId: id, imageUrls: [await getDownloadURL(image)] });
    return id;
  }
  const listingId = await listing(input.title);
  const availableListingId = await listing("Synthetic local offer-sheet fixture");
  const dealListingId = await listing("Synthetic local agreed-deal fixture");
  const offer = await call(buyer, "submitOffer", { listingId, type: "offer", amountSen: 1000, paymentMethod: "cod" });
  const deal = await call(buyer, "submitOffer", { listingId: dealListingId, type: "buy_now", paymentMethod: "cod" });
  const accepted = await call(seller, "respondToOffer", { offerId: deal.offerId, action: "accept" });
  assert.ok(accepted.transactionId);
  await setDoc(doc(buyer.db, "users", buyer.uid, "saved", listingId), { listingId, savedAt: serverTimestamp() });
  const conversation = await call(buyer, "openListingConversation", { listingId });
  await call(buyer, "sendConversationMessage", { conversationId: conversation.conversationId, body: "Synthetic local UI test message. No real exchange." });
  const draft = await call(seller, "createFixedListingDraft", { ...input, title: "Local unpublished draft" });
  const criteria = { query: "synthetic", category: "electronics", condition: "Good", type: "buy_now", auction: "", price: 100, location: "Jitra", sort: "newest" };
  await call(buyer, "saveSearch", { criteria, frequency: "instant", requestId: `active-${suffix}` });
  await call(buyer, "saveSearch", { criteria: { ...criteria, query: "paused synthetic" }, frequency: "instant", active: false, requestId: `paused-${suffix}` });
  const start = Date.now() + 60_000;
  const auction = await call(seller, "createAuctionListing", { title: "Synthetic local auction-sheet fixture", description: input.description, categoryId: input.categoryId, condition: input.condition, publicLocation: input.publicLocation, listingType: "auction", startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(start + 600_000).toISOString() });
  const auctionImage = ref(seller.storage, `users/${seller.uid}/listings/${auction.listingId}/synthetic.png`);
  await uploadBytes(auctionImage, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" });
  await call(seller, "publishAuctionListing", { listingId: auction.listingId, imageUrls: [await getDownloadURL(auctionImage)] });
  // Deterministic emulator clock fixtures, following the auction integration suite.
  // Creation, bids and finalization still use the authoritative handlers.
  const matrix = {};
  for (const state of ["scheduled", "active", "highest", "outbid", "endingSoon", "ended", "winner", "lost", "draft"]) {
    const future = Date.now() + 4 * 3600_000;
    const created = await call(seller, "createAuctionListing", { title: `Local matrix ${state}`, description: input.description, categoryId: input.categoryId, condition: input.condition, publicLocation: input.publicLocation, listingType: "auction", startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: new Date(future).toISOString(), auctionEndAt: new Date(future + 4 * 3600_000).toISOString() });
    matrix[state] = created.listingId;
    const object = ref(seller.storage, `users/${seller.uid}/listings/${created.listingId}/synthetic.png`);
    await uploadBytes(object, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" });
    if (state === "draft") continue;
    await call(seller, "publishAuctionListing", { listingId: created.listingId, imageUrls: [await getDownloadURL(object)] });
    if (state === "scheduled") continue;
    const record = adminDb.doc(`listings/${created.listingId}`);
    await record.update({ auctionStartAt: Timestamp.fromMillis(Date.now() - 60_000), auctionEndAt: Timestamp.fromMillis(Date.now() + (state === "endingSoon" ? 30 * 60_000 : 4 * 3600_000)) });
    await adminDb.runTransaction(async (tx) => { const snap = await tx.get(record); await _test.advanceListing(tx, record, snap.data(), Timestamp.now()); });
    if (["highest", "outbid", "winner", "lost"].includes(state)) await call(buyer, "placeBid", { listingId: created.listingId, amount: 1000 });
    if (["outbid", "lost"].includes(state)) await call(secondBidder, "placeBid", { listingId: created.listingId, amount: 1100 });
    if (["ended", "winner", "lost"].includes(state)) {
      await record.update({ auctionEndAt: Timestamp.fromMillis(Date.now() - 1_000) });
      await adminDb.runTransaction(async (tx) => { const snap = await tx.get(record); await _test.advanceListing(tx, record, snap.data(), Timestamp.now()); });
    }
    const publicState = await call(buyer, "getPublicListingDetail", { listingId: created.listingId });
    assert.equal(publicState.listing.id, created.listingId);
  }
  console.log(JSON.stringify({ projectId, matrix, seller: { uid: seller.uid, email: seller.email }, buyer: { uid: buyer.uid, email: buyer.email }, listingId, availableListingId, auctionId: auction.listingId, auctionStartAt: new Date(start).toISOString(), draftId: draft.listingId, offerId: offer.offerId, transactionId: accepted.transactionId, conversationId: conversation.conversationId }, null, 2));
} finally { await Promise.all(apps.map(deleteApp)); }
