import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, serverTimestamp, updateDoc, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = projectId;
const functionsRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore: getAdminFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const { _test } = functionsRequire("./lib/index.js");
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function client(label, authenticated = true) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, "asia-southeast1");
  const storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  if (authenticated) await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, firestore, functions, storage };
}

async function uploadFixture(owner, listingId, filename) {
  const object = ref(owner.storage, `users/${owner.auth.currentUser.uid}/listings/${listingId}/${filename}`);
  await uploadBytes(object, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { contentType: "image/png" });
  return getDownloadURL(object);
}

const [owner, bidderOne, bidderTwo, guest] = await Promise.all([client("auction-owner"), client("auction-bidder-one"), client("auction-bidder-two"), client("auction-guest", false)]);
const call = (target, name, data) => httpsCallable(target.functions, name)(data).then((result) => result.data);

const buyNowRef = doc(collection(owner.firestore, "listings"));
await setDoc(buyNowRef, {
  id: buyNowRef.id,
  sellerId: owner.auth.currentUser.uid,
  title: "Buy now camera kit",
  description: "A complete and working camera kit with two batteries included.",
  categoryId: "electronics",
  condition: "Good",
  price: 250,
  listingType: "buy_now",
  location: "Shah Alam, Selangor",
  locationKey: "shah alam selangor",
  imageUrls: [],
  searchTokens: ["camera"],
  facetKeys: ["*|*|*|*"],
  status: "draft",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
await updateDoc(buyNowRef, { status: "active", imageUrls: ["https://example.test/legacy.webp"], updatedAt: serverTimestamp() });
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", buyNowRef.id), { title: "Cross seller edit" }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { sellerId: bidderOne.auth.currentUser.uid }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { listingType: "auction" }), /permission/i);
const base = {
  title: "Vintage camera auction",
  description: "A complete vintage camera kit with lens, strap, and protective case.",
  categoryId: "electronics",
  condition: "Good",
  location: "Shah Alam, Selangor",
  startingBid: 10_000,
  minimumBidIncrement: 1_000,
};

const start = new Date(Date.now() + 5_000);
const created = await call(owner, "createAuctionListing", { ...base, auctionStartAt: start.toISOString(), auctionEndAt: new Date(start.getTime() + 10 * 60_000).toISOString() });
const imageUrl = await uploadFixture(owner, created.listingId, "listing.png");
await call(owner, "publishAuctionListing", { listingId: created.listingId, imageUrls: [imageUrl] });

await assert.rejects(() => call(guest, "placeBid", { listingId: created.listingId, amount: 10_000 }), /sign in|unauthenticated/i);
await assert.rejects(() => call(bidderOne, "placeBid", { listingId: created.listingId, amount: 10_000 }), /not started/i);
await new Promise((resolve) => setTimeout(resolve, Math.max(0, start.getTime() - Date.now() + 200)));
await assert.rejects(() => call(owner, "placeBid", { listingId: created.listingId, amount: 10_000 }), /seller|own auction/i);

await call(bidderOne, "placeBid", { listingId: created.listingId, amount: 10_000 });
await assert.rejects(() => call(bidderTwo, "placeBid", { listingId: created.listingId, amount: "11000" }), /whole number/i);
await assert.rejects(() => call(bidderTwo, "placeBid", { listingId: created.listingId, amount: Number.POSITIVE_INFINITY }), /whole number|invalid|cannot be encoded/i);
await assert.rejects(() => call(bidderTwo, "placeBid", { listingId: created.listingId, amount: 10_999 }), /at least|minimum/i);
await call(bidderTwo, "placeBid", { listingId: created.listingId, amount: 11_000 });

const competing = await Promise.allSettled([
  call(bidderOne, "placeBid", { listingId: created.listingId, amount: 12_000 }),
  call(bidderTwo, "placeBid", { listingId: created.listingId, amount: 13_000 }),
]);
const accepted = competing.filter((result) => result.status === "fulfilled");
assert.ok(accepted.length >= 1, "At least one competing bid must commit.");
const auctionSnapshot = await getDoc(doc(owner.firestore, "listings", created.listingId));
const auction = auctionSnapshot.data();
assert.equal(auction.bidCount, 2 + accepted.length, "Bid count must match committed bid records.");
const history = await getDocs(collection(owner.firestore, "listings", created.listingId, "bids"));
assert.equal(history.size, auction.bidCount, "Immutable bid history must contain every accepted bid.");
assert.equal(auction.currentBid, Math.max(...history.docs.map((entry) => entry.data().amount)), "Highest committed bid must remain authoritative.");
assert.ok([bidderOne.auth.currentUser.uid, bidderTwo.auth.currentUser.uid].includes(auction.currentBidderId));
await assert.rejects(() => uploadFixture(owner, created.listingId, "late-change.png"), /unauthorized|permission/i);

await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", created.listingId), { currentBid: 999_999 }), /permission/i);
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", created.listingId), { currentBidderId: bidderOne.auth.currentUser.uid }), /permission/i);
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", created.listingId), { bidCount: 99 }), /permission/i);
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", created.listingId), { auctionStatus: "ended" }), /permission/i);
const firstBid = history.docs[0];
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", created.listingId, "bids", firstBid.id), { amount: 1 }), /permission/i);
await assert.rejects(() => setDoc(doc(collection(bidderOne.firestore, "listings", created.listingId, "bids")), { bidderId: bidderOne.auth.currentUser.uid, amount: 999_999, createdAt: new Date() }), /permission/i);

const later = new Date(Date.now() + 60_000);
const cancellable = await call(owner, "createAuctionListing", { ...base, title: "Cancellable camera auction", auctionStartAt: later.toISOString(), auctionEndAt: new Date(later.getTime() + 10 * 60_000).toISOString() });
const secondImageUrl = await uploadFixture(owner, cancellable.listingId, "cancellable.png");
await call(owner, "publishAuctionListing", { listingId: cancellable.listingId, imageUrls: [secondImageUrl] });
const cancelled = await call(owner, "cancelAuction", { listingId: cancellable.listingId });
assert.equal(cancelled.auctionStatus, "cancelled");
await assert.rejects(() => call(bidderOne, "placeBid", { listingId: cancellable.listingId, amount: 10_000 }), /unavailable|cancelled/i);
await assert.rejects(() => call(owner, "cancelAuction", { listingId: created.listingId }), /with bids/i);

const adminDb = getAdminFirestore();
const noBidStart = new Date(Date.now() + 60_000);
const noBidAuction = await call(owner, "createAuctionListing", { ...base, title: "No bid lifecycle auction", auctionStartAt: noBidStart.toISOString(), auctionEndAt: new Date(noBidStart.getTime() + 10 * 60_000).toISOString() });
const noBidImage = await uploadFixture(owner, noBidAuction.listingId, "no-bids.png");
await call(owner, "publishAuctionListing", { listingId: noBidAuction.listingId, imageUrls: [noBidImage] });
const noBidRef = adminDb.collection("listings").doc(noBidAuction.listingId);
await adminDb.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(noBidRef);
  await _test.advanceListing(transaction, noBidRef, snapshot.data(), Timestamp.fromMillis(noBidStart.getTime() - 1));
});
assert.equal((await noBidRef.get()).data().auctionStatus, "scheduled");
await noBidRef.update({ auctionStartAt: Timestamp.fromMillis(Date.now() - 1_000) });
await adminDb.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(noBidRef);
  await _test.advanceListing(transaction, noBidRef, snapshot.data(), Timestamp.now());
});
assert.equal((await noBidRef.get()).data().auctionStatus, "active");
await noBidRef.update({ auctionEndAt: Timestamp.fromMillis(Date.now() - 1_000) });
await adminDb.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(noBidRef);
  await _test.advanceListing(transaction, noBidRef, snapshot.data(), Timestamp.now());
});
const noBidEnded = (await noBidRef.get()).data();
assert.equal(noBidEnded.auctionStatus, "ended");
assert.equal(noBidEnded.winnerId, null);
assert.equal(noBidEnded.finalBid, null);

const activeStart = new Date(Date.now());
const activeCancellation = await call(owner, "createAuctionListing", { ...base, title: "Active cancellation auction", auctionStartAt: activeStart.toISOString(), auctionEndAt: new Date(activeStart.getTime() + 10 * 60_000).toISOString() });
const activeImage = await uploadFixture(owner, activeCancellation.listingId, "active-cancel.png");
await call(owner, "publishAuctionListing", { listingId: activeCancellation.listingId, imageUrls: [activeImage] });
assert.equal((await call(owner, "cancelAuction", { listingId: activeCancellation.listingId })).auctionStatus, "cancelled");

const adminRef = adminDb.collection("listings").doc(created.listingId);
await adminRef.update({ auctionEndAt: Timestamp.fromMillis(Date.now() - 1_000) });
const [lateBid, finalization] = await Promise.allSettled([
  call(bidderOne, "placeBid", { listingId: created.listingId, amount: auction.currentBid + 1_000 }),
  adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(adminRef);
    await _test.advanceListing(transaction, adminRef, snapshot.data(), Timestamp.now());
  }),
]);
assert.equal(lateBid.status, "rejected", "A bid at or after expiry cannot outrun finalization.");
assert.match(String(lateBid.reason), /ended/i);
assert.equal(finalization.status, "fulfilled");
const ended = (await adminRef.get()).data();
assert.equal(ended.auctionStatus, "ended");
assert.equal(ended.status, "ended");
assert.equal(ended.winnerId, auction.currentBidderId);
assert.equal(ended.finalBid, auction.currentBid);
assert.ok(ended.endedAt);

// More than one scheduler page of abandoned drafts must not hide published auctions.
const floodNow = Timestamp.now();
const floodBatch = adminDb.batch();
for (let index = 0; index < 201; index += 1) {
  floodBatch.set(adminDb.collection("listings").doc(), {
    status: "draft", auctionStatus: "scheduled",
    auctionStartAt: Timestamp.fromMillis(floodNow.toMillis() - 5 * 60_000),
    auctionEndAt: Timestamp.fromMillis(floodNow.toMillis() + 10 * 60_000),
  });
  floodBatch.set(adminDb.collection("listings").doc(), {
    status: "draft", auctionStatus: "active",
    auctionStartAt: Timestamp.fromMillis(floodNow.toMillis() - 20 * 60_000),
    auctionEndAt: Timestamp.fromMillis(floodNow.toMillis() - 5 * 60_000),
  });
}
const dueStartRef = adminDb.collection("listings").doc();
floodBatch.set(dueStartRef, {
  status: "active", auctionStatus: "scheduled",
  auctionStartAt: Timestamp.fromMillis(floodNow.toMillis() - 60_000),
  auctionEndAt: Timestamp.fromMillis(floodNow.toMillis() + 10 * 60_000),
});
const dueEndRef = adminDb.collection("listings").doc();
floodBatch.set(dueEndRef, {
  status: "active", auctionStatus: "active", bidCount: 0, currentBidderId: null,
  auctionStartAt: Timestamp.fromMillis(floodNow.toMillis() - 20 * 60_000),
  auctionEndAt: Timestamp.fromMillis(floodNow.toMillis() - 60_000),
});
await floodBatch.commit();
await _test.advanceDueAuctions(floodNow);
assert.equal((await dueStartRef.get()).data().auctionStatus, "active", "A published auction starts despite more than 200 older drafts.");
const dueEnded = (await dueEndRef.get()).data();
assert.equal(dueEnded.auctionStatus, "ended", "A published auction ends despite more than 200 older drafts.");
assert.equal(dueEnded.winnerId, null);
assert.equal(dueEnded.finalBid, null);
await _test.advanceDueAuctions(floodNow);
assert.deepEqual((await dueEndRef.get()).data(), dueEnded, "Repeating the finalizer is idempotent.");

console.log("Auction callables, concurrency, lifecycle, draft-starvation, idempotence, and direct-write security verified.");
await Promise.all([owner, bidderOne, bidderTwo, guest].map(({ app }) => deleteApp(app)));
