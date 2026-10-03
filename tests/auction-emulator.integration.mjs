import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, updateDoc, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
const functionsRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore: getAdminFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const { getAuth: getAdminAuth } = functionsRequire("firebase-admin/auth");
const { _test } = functionsRequire("./lib/index.js");
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminDb = getAdminFirestore();

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
  if (authenticated) { await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword()); await acceptDemoPolicies(app); }
  return { app, auth, firestore, functions, storage };
}

async function uploadFixture(owner, listingId, filename) {
  const object = ref(owner.storage, `users/${owner.auth.currentUser.uid}/listings/${listingId}/${filename}`);
  await uploadBytes(object, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" });
  return getDownloadURL(object);
}

const [owner, bidderOne, bidderTwo, observer, adminUser, guest] = await Promise.all([client("auction-owner"), client("auction-bidder-one"), client("auction-bidder-two"), client("auction-observer"), client("auction-admin"), client("auction-guest", false)]);
await getAdminAuth().setCustomUserClaims(adminUser.auth.currentUser.uid, { admin: true });
await adminUser.auth.currentUser.getIdToken(true);
const call = (target, name, data) => httpsCallable(target.functions, name)(data).then((result) => result.data);

const fixedInput = {
  title: "Buy now camera kit",
  description: "A complete and working camera kit with two batteries included.",
  categoryId: "electronics",
  condition: "Good",
  price: 250,
  listingType: "buy_now",
  publicLocation: { districtOrCity: "Shah Alam", state: "Selangor", country: "Malaysia" },
};
await assert.rejects(() => call(guest, "createFixedListingDraft", fixedInput), /sign in|unauthenticated/i);
await assert.rejects(() => call(owner, "createFixedListingDraft", { ...fixedInput, sellerId: bidderOne.auth.currentUser.uid }), /invalid fixed-price listing fields/i);
const fixedDraft = await call(owner, "createFixedListingDraft", fixedInput);
await assert.rejects(() => call(guest, "removeFixedListing", { listingId: fixedDraft.listingId }), /sign in|unauthenticated/i);
const buyNowRef = doc(owner.firestore, "listings", fixedDraft.listingId);
await assert.rejects(() => setDoc(doc(collection(owner.firestore, "listings")), { ...fixedInput, sellerId: owner.auth.currentUser.uid, status: "draft" }), /permission/i);
const buyNowImage = await uploadFixture(owner, buyNowRef.id, "buy-now.png");
const buyNowMedia = ref(owner.storage, `users/${owner.auth.currentUser.uid}/listings/${buyNowRef.id}/buy-now.png`);
await assert.rejects(() => getDownloadURL(ref(guest.storage, buyNowMedia.fullPath)), /unauthorized|permission/i, "draft media stays private");
await assert.rejects(() => getDownloadURL(ref(bidderOne.storage, buyNowMedia.fullPath)), /unauthorized|permission/i, "another user cannot read private draft media");
assert.ok(await getDownloadURL(buyNowMedia), "owner can read draft media");
const foreignImage = ref(bidderOne.storage, `users/${owner.auth.currentUser.uid}/listings/${buyNowRef.id}/foreign.png`);
await assert.rejects(() => uploadBytes(foreignImage, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" }), /unauthorized|permission/i);
await assert.rejects(() => deleteObject(ref(bidderOne.storage, `users/${owner.auth.currentUser.uid}/listings/${buyNowRef.id}/buy-now.png`)), /unauthorized|permission/i);
await assert.rejects(() => call(owner, "publishFixedListing", { listingId: buyNowRef.id, imageUrls: ["https://example.com/fake.png"] }), /storage|image/i);
await call(owner, "publishFixedListing", { listingId: buyNowRef.id, imageUrls: [buyNowImage] });
assert.ok(await getDownloadURL(ref(guest.storage, buyNowMedia.fullPath)), "active media is public");
await assert.rejects(() => updateDoc(buyNowRef, { categoryId: "invented" }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { price: 0.001 }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { searchTokens: ["unrelated"] }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { facetKeys: ["*|*|*|*"] }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { imageUrls: ["https://example.com/fake.png"] }), /permission/i);
await assert.rejects(() => call(owner, "updateFixedListing", { ...fixedInput, listingId: buyNowRef.id, categoryId: "invented", imageUrls: [buyNowImage] }), /category/i);
await assert.rejects(() => call(owner, "updateFixedListing", { ...fixedInput, listingId: buyNowRef.id, price: 0.001, imageUrls: [buyNowImage] }), /price/i);
await assert.rejects(() => call(bidderOne, "updateFixedListing", { ...fixedInput, listingId: buyNowRef.id, imageUrls: [buyNowImage] }), /yours|permission/i);
await assert.rejects(() => call(bidderOne, "removeFixedListing", { listingId: buyNowRef.id }), /yours|permission/i);
await assert.rejects(() => call(owner, "publishFixedListing", { listingId: buyNowRef.id, imageUrls: [buyNowImage] }), /cannot be published/i);
await call(owner, "updateFixedListing", { ...fixedInput, listingId: buyNowRef.id, title: "Updated camera kit", imageUrls: [buyNowImage] });
const securedFixed = (await getDoc(buyNowRef)).data();
assert.equal(securedFixed.title, "Updated camera kit");
assert.ok(securedFixed.searchTokens.includes("updated"));
assert.ok(securedFixed.facetKeys.includes("electronics|*|*|*"));
await adminDb.doc(`listings/${buyNowRef.id}`).update({ status: "sold" });
assert.ok(await getDownloadURL(ref(guest.storage, buyNowMedia.fullPath)), "sold fixed-price media remains public");
const wrongSellerMedia = ref(owner.storage, `users/${bidderOne.auth.currentUser.uid}/listings/${buyNowRef.id}/private.png`);
await assert.rejects(() => uploadBytes(wrongSellerMedia, readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url)), { contentType: "image/png" }), /unauthorized|permission/i, "unrelated account cannot write listing media");
await assert.rejects(() => getDownloadURL(ref(bidderOne.storage, wrongSellerMedia.fullPath)), /unauthorized|permission|not-found/i, "unrelated account has no listing-media read path");
await assert.rejects(() => updateDoc(doc(bidderOne.firestore, "listings", buyNowRef.id), { title: "Cross seller edit" }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { sellerId: bidderOne.auth.currentUser.uid }), /permission/i);
await assert.rejects(() => updateDoc(buyNowRef, { listingType: "auction" }), /permission/i);
const base = {
  title: "Vintage camera auction",
  description: "A complete vintage camera kit with lens, strap, and protective case.",
  categoryId: "electronics",
  condition: "Good",
  listingType: "auction",
  publicLocation: { districtOrCity: "Shah Alam", state: "Selangor", country: "Malaysia" },
  startingBid: 10_000,
  minimumBidIncrement: 1_000,
};
await assert.rejects(() => call(owner, "createAuctionListing", { ...base, categoryId: "invented", auctionStartAt: new Date(Date.now() + 60_000).toISOString(), auctionEndAt: new Date(Date.now() + 11 * 60_000).toISOString() }), /category/i);

const draftStart = new Date(Date.now() + 60_000);
const resumable = await call(owner, "createAuctionListing", { ...base, title: "Resumable draft auction", auctionStartAt: draftStart.toISOString(), auctionEndAt: new Date(draftStart.getTime() + 10 * 60_000).toISOString() });
const resumableRef = adminDb.collection("listings").doc(resumable.listingId);
await resumableRef.update({ auctionStartAt: Timestamp.fromMillis(Date.now() - 20 * 60_000), auctionEndAt: Timestamp.fromMillis(Date.now() - 10 * 60_000) });
const rescheduledStart = new Date(Date.now() + 5 * 60_000);
const resumeInput = { ...base, title: "Resumed draft auction", auctionStartAt: rescheduledStart.toISOString(), auctionEndAt: new Date(rescheduledStart.getTime() + 11 * 60_000).toISOString() };
const resumeImage = await uploadFixture(owner, resumable.listingId, "resumed.png");
await assert.rejects(() => call(guest, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /sign in|unauthenticated/i);
await assert.rejects(() => call(bidderOne, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /seller|permission|images must belong/i);
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [] }), /image/i);
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, publicLocation: { districtOrCity: "123 Main Street", state: "Kedah", country: "Malaysia" }, listingId: resumable.listingId, imageUrls: [resumeImage] }), /location|district|city/i);
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, auctionStartAt: new Date(Date.now() - 5 * 60_000).toISOString(), listingId: resumable.listingId, imageUrls: [resumeImage] }), /past/i);
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, auctionEndAt: new Date(Date.now() - 1_000).toISOString(), listingId: resumable.listingId, imageUrls: [resumeImage] }), /end|duration/i);
await assert.rejects(() => call(owner, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [resumeImage] }), /expired/i);
await resumableRef.update({ bidCount: 1 });
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /locked/i);
await resumableRef.update({ bidCount: 0, auctionStatus: "active" });
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /locked/i);
await resumableRef.update({ auctionStatus: "scheduled" });
await call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] });
assert.equal((await resumableRef.get()).data().status, "draft");
assert.equal((await resumableRef.get()).data().auctionStartAt.toMillis(), rescheduledStart.getTime());
await assert.rejects(() => call(guest, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [resumeImage] }), /sign in|unauthenticated/i);
await assert.rejects(() => call(bidderOne, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [resumeImage] }), /seller|permission|images must belong/i);
await assert.rejects(() => call(owner, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [] }), /image/i);
await assert.rejects(() => call(owner, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: ["https://example.com/foreign.webp"] }), /storage|image/i);
await assert.rejects(() => updateDoc(doc(owner.firestore, "listings", resumable.listingId), { auctionStartAt: new Date(Date.now() + 60_000) }), /permission/i);
await call(owner, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [resumeImage] });
assert.equal((await resumableRef.get()).data().status, "active");
assert.equal((await resumableRef.get()).data().imageUrls.length, 1);
assert.equal((await adminDb.collection("listings").where("title", "==", "Resumed draft auction").where("sellerId", "==", owner.auth.currentUser.uid).get()).size, 1, "Resume must not create a second listing");
await assert.rejects(() => call(owner, "publishAuctionListing", { listingId: resumable.listingId, imageUrls: [resumeImage] }), /cannot be published/i);
await resumableRef.update({ auctionStatus: "active", auctionStartAt: Timestamp.fromMillis(Date.now() - 1_000) });
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /locked/i);
await resumableRef.update({ bidCount: 1, auctionStatus: "active" });
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /locked/i);
await resumableRef.update({ status: "ended", auctionStatus: "ended" });
await assert.rejects(() => call(owner, "updateAuctionListing", { ...resumeInput, listingId: resumable.listingId, imageUrls: [resumeImage] }), /locked/i);

const start = new Date(Date.now() + 60_000);
const created = await call(owner, "createAuctionListing", { ...base, auctionStartAt: start.toISOString(), auctionEndAt: new Date(start.getTime() + 10 * 60_000).toISOString() });
const imageUrl = await uploadFixture(owner, created.listingId, "listing.png");
await call(owner, "publishAuctionListing", { listingId: created.listingId, imageUrls: [imageUrl] });

await assert.rejects(() => call(guest, "placeBid", { listingId: created.listingId, amount: 10_000 }), /sign in|unauthenticated/i);
await assert.rejects(() => call(bidderOne, "placeBid", { listingId: created.listingId, amount: 10_000 }), /not started/i);
await adminDb.doc(`listings/${created.listingId}`).update({ auctionStartAt: Timestamp.fromMillis(Date.now() - 200) });
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
const auctionSnapshot = await adminDb.doc(`listings/${created.listingId}`).get();
const auction = auctionSnapshot.data();
assert.equal(auction.bidCount, 2 + accepted.length, "Bid count must match committed bid records.");
const history = await adminDb.collection(`listings/${created.listingId}/bids`).get();
assert.equal(history.size, auction.bidCount, "Immutable bid history must contain every accepted bid.");
assert.equal(auction.currentBid, Math.max(...history.docs.map((entry) => entry.data().amount)), "Highest committed bid must remain authoritative.");
assert.ok([bidderOne.auth.currentUser.uid, bidderTwo.auth.currentUser.uid].includes(auction.currentBidderId));
for (const visitor of [guest, bidderOne, bidderTwo, observer]) {
  await assert.rejects(() => getDoc(doc(visitor.firestore, "listings", created.listingId)), /permission/i);
  await assert.rejects(() => getDocs(collection(visitor.firestore, "listings", created.listingId, "bids")), /permission/i);
  await assert.rejects(() => getDoc(doc(visitor.firestore, "listings", created.listingId, "bids", history.docs[0].id)), /permission/i);
  const detail = await call(visitor, "getPublicListingDetail", { listingId: created.listingId });
  assert.equal(detail.listing.bidCount, auction.bidCount);
  assert.equal(detail.bids.length, Math.min(25, auction.bidCount));
  assert.equal(detail.bids.some((bid) => bid.isOwnBid), Boolean(visitor.auth.currentUser && history.docs.some((bid) => bid.data().bidderId === visitor.auth.currentUser.uid)));
  assert.ok(!/(currentBidderId|winnerId|bidderId|outbidUserId|buyerId)/.test(JSON.stringify(detail)));
}
await assert.rejects(() => getDoc(doc(owner.firestore, "listings", created.listingId)), /permission/i);
assert.equal((await getDoc(doc(adminUser.firestore, "listings", created.listingId))).data()?.currentBidderId, auction.currentBidderId);
assert.equal((await getDoc(doc(adminUser.firestore, "listings", created.listingId, "bids", history.docs[0].id))).data()?.bidderId, history.docs[0].data().bidderId);
const ownerHistory = await call(owner, "getMyListingHistory", {});
const ownerAuction = ownerHistory.listings.find((listing) => listing.id === created.listingId);
assert.equal(ownerAuction?.bidCount, auction.bidCount);
assert.ok(!/(currentBidderId|winnerId|bidderId|outbidUserId|buyerId)/.test(JSON.stringify(ownerAuction)));
await assert.rejects(() => call(guest, "getAuctionViewerState", { listingId: created.listingId }), /sign in|unauthenticated/i);
const viewerOne = await call(bidderOne, "getAuctionViewerState", { listingId: created.listingId });
const viewerTwo = await call(bidderTwo, "getAuctionViewerState", { listingId: created.listingId });
const observerState = await call(observer, "getAuctionViewerState", { listingId: created.listingId });
assert.deepEqual(observerState, { isHighestBidder: false, isWinner: false, isOutbid: false, transactionId: null });
assert.equal(viewerOne.isHighestBidder, auction.currentBidderId === bidderOne.auth.currentUser.uid);
assert.equal(viewerTwo.isHighestBidder, auction.currentBidderId === bidderTwo.auth.currentUser.uid);
assert.equal(viewerOne.isOutbid, !viewerOne.isHighestBidder);
assert.equal(viewerTwo.isOutbid, !viewerTwo.isHighestBidder);
assert.ok(!/(currentBidderId|winnerId|bidderId|outbidUserId|buyerId)/.test(JSON.stringify(viewerOne)));
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
await assert.rejects(() => getDoc(doc(guest.firestore, "listings", created.listingId)), /permission/i);
await assert.rejects(() => getDoc(doc(bidderOne.firestore, "listings", created.listingId)), /permission/i);
const endedDetail = await call(guest, "getPublicListingDetail", { listingId: created.listingId });
assert.equal(endedDetail.listing.status, "ended");
assert.ok(await getDownloadURL(ref(guest.storage, `users/${owner.auth.currentUser.uid}/listings/${created.listingId}/listing.png`)), "ended auction media remains public");
assert.ok(!/(currentBidderId|winnerId|bidderId|outbidUserId|buyerId)/.test(JSON.stringify(endedDetail)));
const winnerClient = ended.winnerId === bidderOne.auth.currentUser.uid ? bidderOne : bidderTwo;
const loserClient = winnerClient === bidderOne ? bidderTwo : bidderOne;
const winnerState = await call(winnerClient, "getAuctionViewerState", { listingId: created.listingId });
const loserState = await call(loserClient, "getAuctionViewerState", { listingId: created.listingId });
assert.equal(winnerState.isWinner, true);
assert.equal(loserState.isWinner, false);
assert.equal(loserState.transactionId, null);
let transactionSnapshot;
for (let attempt = 0; attempt < 30; attempt += 1) {
  transactionSnapshot = await adminDb.doc(`transactions/auction-${created.listingId}`).get();
  if (transactionSnapshot.exists) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.ok(transactionSnapshot?.exists, "Auction finalization must create the winner transaction.");
assert.equal(transactionSnapshot.data().buyerId, ended.winnerId);
assert.equal(transactionSnapshot.data().sellerId, owner.auth.currentUser.uid);
const winnerAuthorized = await call(winnerClient, "getAuctionViewerState", { listingId: created.listingId });
const sellerAuthorized = await call(owner, "getAuctionViewerState", { listingId: created.listingId });
assert.equal(winnerAuthorized.transactionId, transactionSnapshot.id);
assert.equal(sellerAuthorized.transactionId, transactionSnapshot.id);
assert.ok((await getDoc(doc(winnerClient.firestore, "transactions", transactionSnapshot.id))).exists());
await assert.rejects(() => getDoc(doc(loserClient.firestore, "transactions", transactionSnapshot.id)), /permission/i);

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
await Promise.all([owner, bidderOne, bidderTwo, observer, adminUser, guest].map(({ app }) => deleteApp(app)));
