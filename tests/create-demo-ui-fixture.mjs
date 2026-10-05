// Local visual fixtures only. Every SDK is explicitly attached to demo emulators.
// Run with demo-takeme emulators: node tests/create-demo-ui-fixture.mjs [private-output.json].
// Never print or commit the generated output; it contains disposable emulator credentials.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, dirname, relative } from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { acceptDemoPolicies, permitDemoUpload } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
const functionsRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore: getAdminFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const { _test } = functionsRequire("./lib/index.js");
const adminDb = getAdminFirestore();
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const outputPath = resolve(process.argv[2] || ".local-verification/ui-fixture.json");
const repoPath = resolve(new URL("..", import.meta.url).pathname);
const relativeOutput = relative(repoPath, outputPath);
if (!relativeOutput.startsWith("..") && !relativeOutput.startsWith(".local-verification/")) throw new Error("Store credential output outside Git or in .local-verification only.");
const apps = [];
async function person(role) {
  const password = randomUUID();
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
  await acceptDemoPolicies(app, functions);
  await httpsCallable(functions, "completeFirstTimeProfile")({});
  await httpsCallable(functions, "finishAccountWelcome")({});
  return { app, uid, email, password, db, functions, storage };
}
const call = async (user, name, data = {}) => (await httpsCallable(user.functions, name)(data)).data;
try {
  const seller = await person("seller"), buyer = await person("buyer"), secondBidder = await person("bidder");
  const fixtureImageBytes = readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url));
  const input = { title: "Synthetic camera for local UI verification", description: "Synthetic local test product. No real sale or personal information.", categoryId: "electronics", condition: "Good", price: 25, listingType: "buy_now", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" } };
  async function listing(title) {
    const id = (await call(seller, "createFixedListingDraft", { ...input, title })).listingId;
    const image = ref(seller.storage, `users/${seller.uid}/listings/${id}/synthetic.png`);
    await uploadBytes(image, fixtureImageBytes, await permitDemoUpload(seller.app, image.fullPath, "image/png", fixtureImageBytes.length, seller.functions));
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
  await call(buyer, "sendConversationMessage", { conversationId: conversation.conversationId, body: "Synthetic local UI test message. No real exchange.", idempotencyKey: randomUUID() });
  const draft = await call(seller, "createFixedListingDraft", { ...input, title: "Local unpublished draft" });
  const criteria = { query: "synthetic", category: "electronics", condition: "Good", type: "buy_now", auction: "", price: 100, location: "Jitra", sort: "newest" };
  await call(buyer, "saveSearch", { criteria, frequency: "instant", requestId: `active-${suffix}` });
  await call(buyer, "saveSearch", { criteria: { ...criteria, query: "paused synthetic" }, frequency: "instant", active: false, requestId: `paused-${suffix}` });
  const start = Date.now() + 60_000;
  const auction = await call(seller, "createAuctionListing", { title: "Synthetic local auction-sheet fixture", description: input.description, categoryId: input.categoryId, condition: input.condition, publicLocation: input.publicLocation, listingType: "auction", startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(start + 600_000).toISOString() });
  const auctionImage = ref(seller.storage, `users/${seller.uid}/listings/${auction.listingId}/synthetic.png`);
  await uploadBytes(auctionImage, fixtureImageBytes, await permitDemoUpload(seller.app, auctionImage.fullPath, "image/png", fixtureImageBytes.length, seller.functions));
  await call(seller, "publishAuctionListing", { listingId: auction.listingId, imageUrls: [await getDownloadURL(auctionImage)] });
  // Deterministic emulator clock fixtures, following the auction integration suite.
  // Creation, bids and finalization still use the authoritative handlers.
  // This bounded visual matrix exceeds normal manual cadence; demo-only fixture setup resets its private counter.
  await adminDb.doc(`users/${seller.uid}/private/cadence-listing`).delete();
  const matrix = {};
  for (const state of ["scheduled", "active", "highest", "outbid", "endingSoon", "ended", "winner", "lost", "draft"]) {
    const future = Date.now() + 4 * 3600_000;
    const created = await call(seller, "createAuctionListing", { title: `Local matrix ${state}`, description: input.description, categoryId: input.categoryId, condition: input.condition, publicLocation: input.publicLocation, listingType: "auction", startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: new Date(future).toISOString(), auctionEndAt: new Date(future + 4 * 3600_000).toISOString() });
    matrix[state] = created.listingId;
    const object = ref(seller.storage, `users/${seller.uid}/listings/${created.listingId}/synthetic.png`);
    await uploadBytes(object, fixtureImageBytes, await permitDemoUpload(seller.app, object.fullPath, "image/png", fixtureImageBytes.length, seller.functions));
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
  const fixture = { projectId, matrix, seller: { uid: seller.uid, email: seller.email, password: seller.password }, buyer: { uid: buyer.uid, email: buyer.email, password: buyer.password }, listingId, availableListingId, auctionId: auction.listingId, auctionStartAt: new Date(start).toISOString(), draftId: draft.listingId, offerId: offer.offerId, transactionId: accepted.transactionId, conversationId: conversation.conversationId };
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: "wx" });
  console.log("Demo UI fixtures created. Credentials are stored only in the private local output file.");
} finally { await Promise.all(apps.map(deleteApp)); }
