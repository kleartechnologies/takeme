// Local-only closure assertions. Input is the JSON from stage11-ui-fixture.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, getDownloadURL } from "firebase/storage";

const fixture = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(fixture.projectId, "demo-takeme", "Only disposable demo emulator fixtures are permitted");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = fixture.projectId;
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: adminInitialize } = requireFunctions("firebase-admin/app");
const { getFirestore } = requireFunctions("firebase-admin/firestore");
adminInitialize({ projectId: fixture.projectId });
const db = getFirestore(), apps = [];
async function actor(person, name) {
  const app = initializeApp({ projectId: fixture.projectId, apiKey: "demo-api-key", storageBucket: "demo-takeme.firebasestorage.app", appId: "1:123456789:web:demo" }, name);
  apps.push(app);
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  await signInWithEmailAndPassword(auth, person.email, "LocalTest123!");
  assert.equal(auth.currentUser.uid, person.uid);
  return { functions, storage };
}
const call = async (actor, name, data) => (await httpsCallable(actor.functions, name)(data)).data;
try {
  const buyer = await actor(fixture.buyer, "closure-buyer"), seller = await actor(fixture.seller, "closure-seller");
  for (const [state, id] of Object.entries(fixture.matrix)) {
    if (state === "draft") continue;
    const { listing, bids } = await call(buyer, "getPublicListingDetail", { listingId: id });
    const viewer = await call(buyer, "getAuctionViewerState", { listingId: id });
    assert.equal(listing.id, id);
    assert.equal(listing.startingBid, 1000);
    assert.equal(listing.minimumBidIncrement, 100);
    assert.equal(listing.auctionStatus, state === "scheduled" ? "scheduled" : ["ended", "winner", "lost"].includes(state) ? "ended" : "active");
    assert.equal(viewer.isHighestBidder, state === "highest");
    assert.equal(viewer.isWinner, state === "winner");
    assert.equal(viewer.isOutbid, ["outbid", "lost"].includes(state));
    assert.equal(bids.length, ["outbid", "lost"].includes(state) ? 2 : ["highest", "winner"].includes(state) ? 1 : 0);
    assert.equal("currentBidderId" in listing, false);
    assert.equal("winnerId" in listing, false);
    assert.ok(listing.imageUrls.length);
    if (state === "endingSoon") assert.ok(new Date(listing.auctionEndAt).getTime() - Date.now() < 3600_000);
  }
  const listingId = fixture.matrix.active;
  await assert.rejects(() => call(buyer, "placeBid", { listingId, amount: 0 }), /positive|amount|whole|invalid/i);
  const rapid = await Promise.allSettled([call(buyer, "placeBid", { listingId, amount: 1000 }), call(buyer, "placeBid", { listingId, amount: 1000 })]);
  assert.equal(rapid.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.doc(`listings/${listingId}`).get()).data().bidCount, 1);
  assert.equal((await db.collection(`listings/${listingId}/bids`).get()).size, 1);
  assert.equal((await call(buyer, "getAuctionViewerState", { listingId })).isHighestBidder, true);
  // The pending-offer lock must reject rapid retries without creating records.
  const before = (await db.collection("offers").where("listingId", "==", fixture.listingId).where("buyerId", "==", fixture.buyer.uid).get()).size;
  const duplicate = await Promise.allSettled([1, 2].map(() => call(buyer, "submitOffer", { listingId: fixture.listingId, type: "offer", amountSen: 1000, paymentMethod: "cod" })));
  assert.ok(duplicate.every((r) => r.status === "rejected" && /open request/i.test(r.reason.message)));
  assert.equal((await db.collection("offers").where("listingId", "==", fixture.listingId).where("buyerId", "==", fixture.buyer.uid).get()).size, before);
  const draftId = fixture.matrix.draft, draft = (await db.doc(`listings/${draftId}`).get()).data();
  assert.equal(draft.status, "draft"); assert.equal(draft.bidCount, 0);
  const imageUrls = [await getDownloadURL(ref(seller.storage, `users/${fixture.seller.uid}/listings/${draftId}/synthetic.png`))];
  const start = Date.now() + 3600_000;
  const input = { listingId: draftId, title: draft.title, description: draft.description, categoryId: draft.categoryId, condition: draft.condition, listingType: "auction", publicLocation: draft.publicLocation, startingBid: 1000, minimumBidIncrement: 100, auctionStartAt: new Date(start).toISOString(), auctionEndAt: new Date(start + 3600_000).toISOString(), imageUrls };
  await assert.rejects(() => call(seller, "updateAuctionListing", { ...input, auctionEndAt: new Date(start - 1).toISOString() }), /end|duration/i);
  await call(seller, "updateAuctionListing", input);
  await call(seller, "publishAuctionListing", { listingId: draftId, imageUrls });
  const published = (await db.doc(`listings/${draftId}`).get()).data();
  assert.equal(published.status, "active"); assert.equal(published.auctionStatus, "scheduled");
  assert.equal(published.auctionStartAt.toMillis(), start);
  assert.equal((await db.collection("listings").where("sellerId", "==", fixture.seller.uid).where("title", "==", draft.title).get()).size, 1);
  await assert.rejects(() => call(seller, "publishAuctionListing", { listingId: draftId, imageUrls }), /cannot be published/i);
  console.log("Stage11 local closure assertions PASS: eight real auction/viewer states, invalid/rapid bid with exactly one record, duplicate offer denial, existing draft reschedule/publish with no duplicate.");
} finally { await Promise.all(apps.map(deleteApp)); }
