import { acceptDemoPolicies } from "./helpers/demo-eligibility.mjs";
// Demo-only tests. Credentials are generated in memory and never logged or saved.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp as clientApp, deleteApp as deleteClientApp } from "firebase/app";
import { getAuth as clientAuth, connectAuthEmulator, createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider, GoogleAuthProvider, linkWithCredential } from "firebase/auth";
import { getStorage as clientStorage, connectStorageEmulator, ref as storageRef, uploadBytes, getBytes } from "firebase/storage";
import { createProfileIfMissing } from "../src/lib/firebase/profile-bootstrap.ts";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getFirestore as clientFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

process.env.GCLOUD_PROJECT = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const admin = initializeApp({ projectId: "demo-takeme", storageBucket: "demo-takeme.firebasestorage.app" });
const db = getFirestore(); const auth = getAuth(); const bucket = getStorage().bucket();
const { processAccountDeletion, enforceDeletionRetention, DELETION_POLICY_VERSION } = require("../functions/lib/account-deletion.js");
const { recordMarketplaceSignal } = require("../functions/lib/intelligence.js");
const suffix = randomUUID().replaceAll("-", "");
const aliases = new Set(); const users = []; const tracked = new Set(); const storagePaths = new Set(); const clients = [];
const hash = (v) => createHash("sha256").update(v).digest("hex");
const now = () => Timestamp.now();
const past = () => Timestamp.fromMillis(Date.now() - 10_000);
const put = async (path, data) => { tracked.add(path); await db.doc(path).set(data); };
const read = async (path) => (await db.doc(path).get()).data();
const exists = async (path) => (await db.doc(path).get()).exists;
async function user(label) {
  const app = clientApp({ apiKey: "demo-api-key", projectId: "demo-takeme", authDomain: "demo-takeme.firebaseapp.com", appId: "demo", storageBucket: "demo-takeme.firebasestorage.app" }, `${label}-${suffix}`);
  clients.push(app); const a = clientAuth(app); connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
  const f = getFunctions(app, "asia-southeast1"); connectFunctionsEmulator(f, "127.0.0.1", 5001);
  const firestore = clientFirestore(app); connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  const storage = clientStorage(app); connectStorageEmulator(storage, "127.0.0.1", 9199);
  const email = `${label}-${suffix}@example.test`, password = randomUUID() + "!Aa1";
  const credential = await createUserWithEmailAndPassword(a, email, password);
  await acceptDemoPolicies(app);
  const u = { uid: credential.user.uid, a, f, firestore, storage, email, password, call: async (name, data = {}) => (await httpsCallable(f, name)(data)).data };
  users.push(u); await put(`users/${u.uid}`, { uid: u.uid, displayName: "Demo account", photoURL: null, location: "", createdAt: now(), updatedAt: now() }); return u;
}
async function request(u) { const status = await u.call("requestAccountDeletion", { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION, expectedOwnerUid: u.uid }); assert.equal(await exists(`users/${u.uid}/private/onboarding`), false, "Deletion initiation erases acceptance immediately"); const op = await read(`accountDeletionOperations/${u.uid}`); if (op?.alias) aliases.add(op.alias); return status; }
async function deleted(u) { assert.equal((await read(`accountDeletionOperations/${u.uid}`)).state, "completed"); await assert.rejects(() => auth.getUser(u.uid), { code: "auth/user-not-found" }); assert.equal(await exists(`users/${u.uid}`), false); }
async function seedOperation(u) {
  const alias = `deleted-${suffix}-${u.uid}`; aliases.add(alias);
  const lifecycle = db.doc(`accountLifecycles/${u.uid}`), operation = db.doc(`accountDeletionOperations/${u.uid}`);
  tracked.add(lifecycle.path); tracked.add(operation.path);
  await db.runTransaction(async tx => {
    tx.set(lifecycle, { state: "deletion_pending", alias });
    tx.delete(db.doc(`users/${u.uid}/private/onboarding`));
    tx.set(operation, { uid: u.uid, alias, state: "pending", requestedAt: now(), attempts: 0, policyVersion: DELETION_POLICY_VERSION });
  });
}
async function upload(path) { storagePaths.add(path); await bucket.file(path).save(Buffer.from("emulator-test-object"), { resumable: false, metadata: { contentType: "image/png" } }); }
function listing(owner, extra = {}) { return { id: "demo", sellerId: owner.uid, title: "Demo camera", description: "Synthetic emulator listing only", categoryId: "electronics", condition: "Good", price: 100, listingType: "buy_now", status: "active", imageUrls: [], privacyVersion: 2, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, location: "Jitra, Kedah", createdAt: now(), updatedAt: now(), ...extra }; }
function auction(owner, bidder, count) { return listing(owner, { listingType: "auction", auctionStatus: "active", startingBid: 10000, currentBid: count ? 12000 : 0, minimumBidIncrement: 500, currentBidderId: count ? bidder.uid : null, winnerId: null, bidCount: count, auctionStartAt: Timestamp.fromMillis(Date.now() - 60000), auctionEndAt: Timestamp.fromMillis(Date.now() + 3600000) }); }
function deal(buyer, seller, lid, extra = {}) { return { buyerId: buyer.uid, sellerId: seller.uid, listingId: lid, listingTitle: "Personal copied title", categoryId: "electronics", type: "offer", sourceId: lid, status: "in_progress", amountSen: 10000, currency: "MYR", paymentMethod: "cod", settlementMode: "standard", paymentProvider: "none", reviewCount: 0, buyerConfirmedAt: null, sellerConfirmedAt: null, cancellationRequestedBy: null, createdAt: now(), updatedAt: now(), ...extra }; }
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log(`PASS ${passed}: ${label}`); }
try {
  const control = await user("isolation");
  await put(`users/${control.uid}/saved/isolation-item`, { listingId: "isolation-item", savedAt: now() });
  await upload(`users/${control.uid}/profile/control.png`);
  const controlBefore = JSON.stringify(await read(`users/${control.uid}`));
  await check("unauthenticated, recent-auth, owner-only input and policy validation", async () => {
    const u = await user("auth-safety");
    const response = await fetch("http://127.0.0.1:5001/demo-takeme/asia-southeast1/requestAccountDeletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION, expectedOwnerUid: u.uid } }) });
    assert.equal(response.status, 401);
    for (const name of ["requestAccountDeletion", "retryAccountDeletion"]) {
      const data = name === "requestAccountDeletion" ? { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION } : {};
      for (const expectedOwnerUid of [undefined, control.uid]) {
        await assert.rejects(() => u.call(name, { ...data, ...(expectedOwnerUid ? { expectedOwnerUid } : {}) }), error => error.details?.reason === "account-changed");
        assert.equal(await exists(`accountLifecycles/${u.uid}`), false);
        assert.equal(await exists(`accountDeletionOperations/${u.uid}`), false);
        assert.ok(await auth.getUser(u.uid));
        assert.equal(await exists(`users/${u.uid}/private/onboarding`), true);
      }
    }
    await assert.rejects(() => u.call("requestAccountDeletion", { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION, expectedOwnerUid: u.uid, uid: control.uid }));
    const token = await u.a.currentUser.getIdToken(); const parts = token.split("."); const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()); claims.auth_time = Math.floor(Date.now() / 1000) - 600;
    const stale = `${parts[0]}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.`;
    const staleResponse = await fetch("http://127.0.0.1:5001/demo-takeme/asia-southeast1/requestAccountDeletion", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${stale}` }, body: JSON.stringify({ data: { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION, expectedOwnerUid: u.uid } }) });
    assert.equal(staleResponse.status, 400); assert.equal((await staleResponse.json()).error.details.reason, "recent-auth-required");
    await reauthenticateWithCredential(u.a.currentUser, EmailAuthProvider.credential(u.email, u.password)); await u.a.currentUser.getIdToken(true);
    assert.equal((await request(u)).state, "completed"); await deleted(u);
  });
  await check("clean account Auth removal", async () => { const u = await user("clean"); assert.equal((await request(u)).state, "completed"); await deleted(u); });
  await check("recursive nested subcollections including unknown profile children", async () => { const u = await user("nested"); await put(`users/${u.uid}/extra/one/deep/two`, { ownerId: u.uid }); await request(u); assert.equal(await exists(`users/${u.uid}/extra/one/deep/two`), false); await deleted(u); });
  await check("Storage profile, listing and orphan object removal", async () => { const u = await user("storage"); for (const path of [`users/${u.uid}/profile/a.png`, `users/${u.uid}/listings/orphan/a.png`, `users/${u.uid}/uploads/orphan.png`]) await upload(path); await request(u); assert.equal((await bucket.getFiles({ prefix: `users/${u.uid}/` }))[0].length, 0); await deleted(u); });
  await check("draft withdrawal and removal", async () => { const u = await user("draft"); const id = `draft-${suffix}`; await put(`listings/${id}`, listing(u, { status: "draft" })); await request(u); assert.equal(await exists(`listings/${id}`), false); });
  await check("ordinary unsold listing and media removal", async () => { const u = await user("unsold"); const id = `unsold-${suffix}`; await put(`listings/${id}`, listing(u)); await upload(`users/${u.uid}/listings/${id}/one.png`); await request(u); assert.equal(await exists(`listings/${id}`), false); });
  await check("saved items and watcher mirrors", async () => { const u = await user("saved"); await put(`users/${u.uid}/saved/item`, { listingId: "item", savedAt: now() }); await put(`listingWatchers/item/users/${u.uid}`, { userId: u.uid, listingId: "item" }); await request(u); assert.equal(await exists(`listingWatchers/item/users/${u.uid}`), false); });
  await check("both follow directions and exact-once surviving count", async () => { const u = await user("follow"); await put(`sellerFollowers/${control.uid}/members/${u.uid}`, { sellerId: control.uid, userId: u.uid }); await put(`sellerFollowSummaries/${control.uid}`, { followerCount: 1 }); await put(`sellerFollowers/${u.uid}/members/${control.uid}`, { sellerId: u.uid, userId: control.uid }); await put(`users/${control.uid}/following/${u.uid}`, { sellerId: u.uid }); await request(u); assert.equal((await read(`sellerFollowSummaries/${control.uid}`)).followerCount, 0); assert.equal(await exists(`users/${control.uid}/following/${u.uid}`), false); await processAccountDeletion(u.uid); assert.equal((await read(`sellerFollowSummaries/${control.uid}`)).followerCount, 0); });
  await check("saved searches, fingerprints and quotas", async () => { const u = await user("searches"); await put(`savedSearches/${u.uid}`, { userId: u.uid, criteria: { query: "private" } }); await put(`savedSearchFingerprints/${u.uid}`, { userId: u.uid, searchId: u.uid }); await put(`savedSearchQuotas/${u.uid}`, { count: 1 }); await request(u); for (const c of ["savedSearches", "savedSearchFingerprints", "savedSearchQuotas"]) assert.equal(await exists(`${c}/${u.uid}`), false); });
  await check("notifications, preferences and summaries", async () => { const u = await user("notices"); await put(`users/${u.uid}/notifications/notice`, { recipientUserId: u.uid }); for (const c of ["notificationPreferences", "notificationSummaries"]) await put(`${c}/${u.uid}`, { unreadCount: 1 }); await request(u); for (const c of ["notificationPreferences", "notificationSummaries"]) assert.equal(await exists(`${c}/${u.uid}`), false); });
  await check("discovery/interests/events and legacy profile fields", async () => { const u = await user("interests"); await db.doc(`users/${u.uid}`).update({ email: u.email }); for (const c of ["userInterests", "discoverySessions", "discoveryAttributions", "intelligenceQuotas", "marketplaceEvents"]) await put(`${c}/${u.uid}`, { userId: u.uid, recentQueries: ["private"] }); await request(u); for (const c of ["userInterests", "discoverySessions", "discoveryAttributions", "intelligenceQuotas", "marketplaceEvents"]) assert.equal(await exists(`${c}/${u.uid}`), false); });
  await check("messages, previews, copied images, opaque conversation ID and counterparty history", async () => {
    const u = await user("messages"); const cid = `message-${suffix}_${u.uid}`;
    await put(`conversations/${cid}`, { buyerId: u.uid, sellerId: control.uid, participants: [u.uid, control.uid], listingId: "gone", latestMessage: "private text", listingImage: "private-photo", updatedAt: now() });
    await put(`conversations/${cid}/messages/own`, { senderId: u.uid, body: "private text", attachments: ["private-photo"], createdAt: now() });
    await put(`conversations/${cid}/messages/other`, { senderId: control.uid, body: "counterparty history", createdAt: now() });
    await put(`users/${control.uid}/notifications/deleted-conversation`, { href: `/messages/${cid}`, body: "private text", title: "Demo account", dedupeKey: cid });
    await request(u); assert.equal(await exists(`conversations/${cid}`), false);
    const page = await db.collection("conversations").where("participants", "array-contains", control.uid).get(); const conversation = page.docs.find((d) => d.data().listingId === "gone");
    assert.ok(conversation); tracked.add(conversation.ref.path); assert.ok(!conversation.id.includes(u.uid)); assert.equal(conversation.data().latestMessage, null); assert.equal(conversation.data().listingImage, null); assert.equal(conversation.data().status, "closed"); assert.ok(conversation.data().retentionExpiresAt);
    const own = await read(`${conversation.ref.path}/messages/own`); assert.equal(own.body, ""); assert.equal(own.attachments, undefined); assert.equal((await read(`${conversation.ref.path}/messages/other`)).body, "counterparty history");
    const notice = await read(`users/${control.uid}/notifications/deleted-conversation`); assert.equal(notice.href, `/messages/${conversation.id}`); assert.ok(!JSON.stringify(notice).includes(u.uid));
    const deadline = conversation.data().retentionExpiresAt.toMillis(); await processAccountDeletion(u.uid); assert.equal((await read(conversation.ref.path)).retentionExpiresAt.toMillis(), deadline);
    const output = await control.call("getConversation", { conversationId: conversation.id }); assert.equal(output.conversation.otherName, "Deleted user");
  });
  await check("published reviews preserve authentic ratings/tags without identity/comments", async () => {
    const u = await user("reviews"); const tid = `review-${suffix}`;
    await put(`transactions/${tid}`, deal(u, control, "review-listing", { status: "completed", completedAt: past(), reviewsVisibleAt: now() }));
    await put(`transactions/${tid}/reviews/${u.uid}`, { buyerId: u.uid, sellerId: control.uid, reviewerId: u.uid, reviewedUserId: control.uid, rating: 5, tags: ["friendly"], comment: "private commentary", reviewerRole: "buyer", createdAt: now() });
    const rid = hash(`${tid}|${u.uid}`); await put(`publicReviews/${rid}`, { reviewedUserId: control.uid, rating: 5, tags: ["friendly"], comment: "private commentary", reviewerRole: "buyer", createdAt: now(), publishedAt: now() });
    await put(`publicReviews/about-${suffix}`, { reviewedUserId: u.uid, rating: 4, comment: "about removed account" });
    await request(u); const r = await read(`publicReviews/${rid}`); assert.equal(r.rating, 5); assert.deepEqual(r.tags, ["friendly"]); assert.equal(r.comment, ""); assert.ok(r.retentionExpiresAt); assert.equal(await exists(`publicReviews/about-${suffix}`), false); assert.equal(await exists(`transactions/${tid}/reviews/${u.uid}`), false); const deadline=(await read(`transactions/${tid}`)).retentionExpiresAt.toMillis(); assert.equal(r.retentionExpiresAt.toMillis(),deadline); const alias=(await read(`accountDeletionOperations/${u.uid}`)).alias; assert.equal((await read(`transactions/${tid}/reviews/${alias}`)).retentionExpiresAt.toMillis(),deadline);
  });
  await check("bidder live auction: pseudonym preserves order/amount, pending, then valid cancellation resolves", async () => {
    const u = await user("bidder"); const id = `bidder-${suffix}`;
    await put(`listings/${id}`, auction(control, u, 1)); await put(`listings/${id}/bids/bid`, { bidderId: u.uid, outbidUserId: null, amount: 12000, createdAt: now() });
    const result = await request(u); assert.equal(result.state, "pending"); assert.ok(result.blockers.includes("live_auction")); const a = await read(`listings/${id}`); assert.equal(a.currentBid, 12000); assert.equal(a.minimumBidIncrement, 500); assert.equal(a.bidCount, 1); assert.ok(a.currentBidderId.startsWith("deleted-")); assert.equal((await read(`listings/${id}/bids/bid`)).bidderId, a.currentBidderId);
    await assert.rejects(() => u.call("placeBid", { listingId: id, amount: 12500 }));
    // Test setup simulates an externally approved terminal resolution; cleanup itself never cancels.
    await db.doc(`listings/${id}`).update({ auctionStatus: "cancelled", status: "ended" }); await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("seller auction without bids is withdrawn", async () => { const u = await user("no-bid"); const id = `no-bid-${suffix}`; await put(`listings/${id}`, auction(u, control, 0)); await request(u); assert.equal(await exists(`listings/${id}`), false); await deleted(u); });
  await check("seller live auction with bids continues normally and creates the true winner deal", async () => {
    const u = await user("seller-bids"); const id = `seller-bids-${suffix}`; await put(`listings/${id}`, auction(u, control, 1)); await put(`listings/${id}/bids/bid`, { bidderId: control.uid, amount: 12000, createdAt: now() });
    assert.equal((await request(u)).state, "pending"); const a = await read(`listings/${id}`); assert.equal(a.auctionStatus, "active"); assert.equal(a.currentBidderId, control.uid); assert.equal(a.currentBid, 12000);
    await control.call("placeBid", { listingId: id, amount: 12500 }); assert.equal((await read(`listings/${id}`)).currentBid, 12500);
    await db.doc(`listings/${id}`).update({ auctionStatus: "ended", status: "ended", winnerId: control.uid, finalBid: 12500, endedAt: now() });
    for (let i = 0; i < 20 && !(await exists(`transactions/auction-${id}`)); i++) await new Promise((resolve) => setTimeout(resolve, 200));
    const won = await read(`transactions/auction-${id}`); assert.equal(won.buyerId, control.uid); assert.equal(won.amountSen, 12500); tracked.add(`transactions/auction-${id}`); tracked.add(`listingDeals/${id}`);
    await processAccountDeletion(u.uid); assert.equal((await read(`accountDeletionOperations/${u.uid}`)).state, "pending");
    await u.call("requestTransactionCancellation", { transactionId: `auction-${id}`, reason: "Demo mutual resolution" }); await control.call("requestTransactionCancellation", { transactionId: `auction-${id}`, reason: "Demo mutual resolution" }); await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("accepted unfinished deal waits; existing two-party completion remains usable", async () => {
    const u = await user("deal"); const id = `deal-${suffix}`; const lid = `deal-listing-${suffix}`; await put(`listings/${lid}`, listing(control, { status: "ended" })); await put(`transactions/${id}`, deal(u, control, lid)); await put(`listingDeals/${lid}`, { transactionId: id, status: "in_progress" });
    assert.equal((await request(u)).state, "pending"); await assert.rejects(() => u.call("createFixedListingDraft", {})); await assert.rejects(() => u.call("submitOffer", {}));
    await assert.rejects(() => uploadBytes(storageRef(u.storage, `users/${u.uid}/profile/stale-token.png`), new Uint8Array([1]), { contentType: "image/png" }), /unauthorized|permission/i);
    assert.ok((await u.call("getReputationPolicy")).thresholds); await assert.rejects(() => control.call("openTransactionConversation", { transactionId: id }));
    const view = await u.call("getTransactionDetail", { transactionId: id }); assert.equal(view.transaction.buyerId, u.uid);
    await u.call("confirmTransactionCompletion", { transactionId: id }); await control.call("confirmTransactionCompletion", { transactionId: id }); assert.equal((await read(`transactions/${id}`)).status, "completed"); await processAccountDeletion(u.uid); await deleted(u); assert.equal(await exists(`trustSummaries/${u.uid}`), false);
  });
  await check("report/dispute evidence restricted, case resolution + 180 days", async () => {
    const u = await user("case"); const cid = `case-conversation-${suffix}_${u.uid}`; const rid = `case-report-${suffix}`;
    const mediaPath = `users/${u.uid}/uploads/case.png`; await upload(mediaPath);
    const mediaUrl = `http://127.0.0.1:9199/v0/b/demo-takeme.firebasestorage.app/o/${encodeURIComponent(mediaPath)}`;
    await put(`conversations/${cid}`, { buyerId: u.uid, sellerId: control.uid, participants: [u.uid, control.uid], listingId: "case-listing", updatedAt: now() }); await put(`conversations/${cid}/messages/original`, { senderId: u.uid, body: "minimum original evidence", attachments: [mediaUrl], createdAt: now() });
    await put(`reports/${rid}`, { reporterId: control.uid, userId: u.uid, targetType: "message", targetId: "original", conversationId: cid, reason: "harassment", details: "case details", status: "submitted", createdAt: now(), updatedAt: now() });
    assert.equal((await request(u)).state, "pending"); const report = await read(`reports/${rid}`); const hold = await read(`accountDeletionEvidence/${report.deletionEvidenceId}`); assert.ok(hold.snapshotComplete); assert.equal(hold.expiresAt, null); tracked.add(`accountDeletionEvidence/${report.deletionEvidenceId}`);
    const records = await db.collection(`accountDeletionEvidence/${report.deletionEvidenceId}/records`).get(); assert.ok(records.docs.some((d) => d.data().body === "minimum original evidence")); await assert.rejects(() => getDoc(doc(control.firestore, "accountDeletionEvidence", report.deletionEvidenceId)));
    const evidenceMedia = records.docs.flatMap((d) => d.data().media ?? []); assert.equal(evidenceMedia.length, 1); assert.ok((await bucket.file(evidenceMedia[0]).exists())[0]); await assert.rejects(() => getBytes(storageRef(control.storage, evidenceMedia[0])));
    await db.doc(`reports/${rid}`).update({ status: "resolved", resolvedAt: now(), updatedAt: now() }); await processAccountDeletion(u.uid); await deleted(u); assert.equal((await bucket.file(mediaPath).exists())[0], false); assert.ok((await bucket.file(evidenceMedia[0]).exists())[0]); await enforceDeletionRetention(); assert.ok((await read(`accountDeletionEvidence/${report.deletionEvidenceId}`)).expiresAt);
  });
  await check("retry after partial failure and after Auth deletion", async () => { const u = await user("retry"); await seedOperation(u); await processAccountDeletion(u.uid, (phase) => { if (phase === "personal_data") throw new Error("injected local failure"); }); assert.equal((await read(`accountDeletionOperations/${u.uid}`)).state, "failed"); assert.ok(await auth.getUser(u.uid)); await processAccountDeletion(u.uid, (phase) => { if (phase === "after_auth") throw new Error("injected after Auth"); }); assert.equal((await read(`accountDeletionOperations/${u.uid}`)).state, "failed"); await assert.rejects(() => auth.getUser(u.uid)); await processAccountDeletion(u.uid); await deleted(u); });
  await check("direct-write, callable and delayed-trigger recreation attempts", async () => {
    const u = await user("guards"); await seedOperation(u); await assert.rejects(() => setDoc(doc(u.firestore, "users", u.uid, "saved", "blocked"), { listingId: "blocked", savedAt: serverTimestamp() })); await assert.rejects(() => u.call("setNotificationPreference", { type: "saved_price_drop", frequency: "instant" }));
    const signal = await recordMarketplaceSignal(u.uid, { type: "SAVE_LISTING", listingId: "blocked" }, "local-delayed-event", { source: "saved" }); assert.equal(signal.accepted, false);
    await put(`users/${u.uid}/saved/admin-stale`, { listingId: "admin-stale", savedAt: now() }); await db.doc(`users/${u.uid}/saved/admin-stale`).delete(); await new Promise((resolve) => setTimeout(resolve, 500)); assert.equal(await exists(`userInterests/${u.uid}`), false); assert.equal(await exists(`listingWatchers/admin-stale/users/${u.uid}`), false); await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("repeated and concurrent requests/worker calls are idempotent", async () => { const u = await user("idempotent"); await seedOperation(u); await Promise.all([processAccountDeletion(u.uid), processAccountDeletion(u.uid)]); const before = await read(`accountDeletionOperations/${u.uid}`); await processAccountDeletion(u.uid); assert.equal((await read(`accountDeletionOperations/${u.uid}`)).attempts, before.attempts); await deleted(u); });
  await check("Google credential reauthentication uses the same authenticated deletion backend", async () => {
    const u = await user("google-reauth"); const issued = Math.floor(Date.now()/1000);
    const token = `${Buffer.from(JSON.stringify({alg:"none",typ:"JWT"})).toString("base64url")}.${Buffer.from(JSON.stringify({iss:"https://accounts.google.com",aud:"demo-client",sub:randomUUID(),email:u.email,email_verified:true,name:"Demo Google",iat:issued,exp:issued+3600})).toString("base64url")}.`;
    const credential = GoogleAuthProvider.credential(token);
    await linkWithCredential(u.a.currentUser, credential); await reauthenticateWithCredential(u.a.currentUser, credential); await u.a.currentUser.getIdToken(true);
    assert.equal((await u.a.currentUser.getIdTokenResult()).signInProvider, "google.com"); await request(u); await deleted(u);
  });
  await check("standard dispute preserves evidence until an externally valid case resolution", async () => {
    const u = await user("standard-dispute"); const tid = `standard-dispute-${suffix}`;
    await put(`transactions/${tid}`, deal(u, control, `standard-listing-${suffix}`, {status:"disputed",disputeReason:"minimum dispute evidence",disputeOpenedBy:u.uid,disputedAt:now()}));
    const cid = `standard-conversation-${suffix}`; await put(`conversations/${cid}`, { buyerId: u.uid, sellerId: control.uid, participants: [u.uid, control.uid], transactionId: tid }); await put(`conversations/${cid}/messages/original`, { senderId: u.uid, body: "standard dispute message", createdAt: now() });
    const result = await request(u); assert.equal(result.state,"pending"); assert.ok(result.blockers.includes("unresolved_dispute"));
    const alias = (await read(`accountDeletionOperations/${u.uid}`)).alias; const hid=hash(`${alias}|transactions/${tid}`); tracked.add(`accountDeletionEvidence/${hid}`); assert.equal((await read(`accountDeletionEvidence/${hid}/records/case`)).disputeReason,"minimum dispute evidence"); assert.equal((await read(`transactions/${tid}`)).disputeReason,undefined); const scoped = await db.collection(`accountDeletionEvidence/${hid}/records`).get(); assert.ok(scoped.docs.some((d) => d.data().body === "standard dispute message"));
    await db.doc(`transactions/${tid}`).update({status:"cancelled",cancelledAt:now(),updatedAt:now()}); await processAccountDeletion(u.uid); await deleted(u); await enforceDeletionRetention(); assert.ok((await read(`accountDeletionEvidence/${hid}`)).expiresAt);
  });
  await check("protected dispute evidence children are isolated and ordinary access is denied", async () => {
    const u = await user("protected-dispute"); const tid=`protected-dispute-${suffix}`;
    await put(`transactions/${tid}`,deal(u,control,`protected-listing-${suffix}`,{status:"disputed"}));
    await put(`transactionDisputes/${tid}`,{transactionId:tid,buyerId:u.uid,sellerId:control.uid,openedBy:u.uid,status:"awaiting_seller",description:"scoped case description",openedAt:now(),updatedAt:now()});
    await put(`transactionDisputes/${tid}/evidence/note`,{actorId:u.uid,role:"buyer",note:"minimum evidence",createdAt:now()});
    assert.equal((await request(u)).state,"pending"); const dispute=await read(`transactionDisputes/${tid}`); const hid=dispute.deletionEvidenceId; tracked.add(`accountDeletionEvidence/${hid}`); assert.equal(await exists(`transactionDisputes/${tid}/evidence/note`),false);
    const records=await db.collection(`accountDeletionEvidence/${hid}/records`).get(); assert.ok(records.docs.some((d)=>d.data().note==="minimum evidence")); await assert.rejects(()=>getDoc(doc(control.firestore,"accountDeletionEvidence",hid)));
    await control.call("respondToProtectedDispute",{transactionId:tid,response:"Restricted seller response"});
    assert.equal((await control.call("respondToProtectedDispute",{transactionId:tid,response:"Restricted seller response"})).alreadyRecorded,true);
    await u.call("addProtectedDisputeEvidence",{transactionId:tid,note:"Restricted pending-owner follow-up",idempotencyKey:"pending-follow-up"});
    await processAccountDeletion(u.uid); const updated=await db.collection(`accountDeletionEvidence/${hid}/records`).get(); assert.ok(updated.docs.some(d=>d.data().note==="Restricted pending-owner follow-up")); assert.equal((await read(`accountDeletionEvidence/${hid}/records/case`)).sellerResponse,"Restricted seller response"); assert.equal((await db.collection(`transactionDisputes/${tid}/evidence`).get()).size,0);
    await db.doc(`transactionDisputes/${tid}`).update({status:"resolved",resolvedAt:now(),updatedAt:now()}); await db.doc(`transactions/${tid}`).update({status:"cancelled",cancelledAt:now(),updatedAt:now()}); await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("two departing dispute participants share one restricted evidence hold", async () => {
    const buyer=await user("shared-case-buyer"),seller=await user("shared-case-seller"),tid=`shared-case-${suffix}`;
    await put(`transactions/${tid}`,deal(buyer,seller,`shared-case-listing-${suffix}`,{status:"disputed"}));
    await put(`transactionDisputes/${tid}`,{transactionId:tid,buyerId:buyer.uid,sellerId:seller.uid,openedBy:buyer.uid,status:"awaiting_seller",description:"Shared original case evidence",openedAt:now(),updatedAt:now()});
    assert.equal((await request(buyer)).state,"pending"); const hid=(await read(`transactionDisputes/${tid}`)).deletionEvidenceId;tracked.add(`accountDeletionEvidence/${hid}`);
    assert.equal((await request(seller)).state,"pending");assert.equal((await read(`transactionDisputes/${tid}`)).deletionEvidenceId,hid);assert.equal((await read(`accountDeletionEvidence/${hid}/records/case`)).description,"Shared original case evidence");
    assert.ok((await read(`accountDeletionOperations/${seller.uid}`)).evidenceIds.includes(hid));
    await db.doc(`transactionDisputes/${tid}`).update({status:"resolved",resolvedAt:now(),updatedAt:now()});await db.doc(`transactions/${tid}`).update({status:"cancelled",cancelledAt:now(),updatedAt:now()});await processAccountDeletion(buyer.uid);await processAccountDeletion(seller.uid);await deleted(buyer);await deleted(seller);
  });
  await check("paginated cleanup removes more than one page and the last nested record", async () => {
    const u = await user("pagination"); const batch=db.batch(); for(let i=0;i<105;i++) {const path=`savedSearches/${suffix}-${i}`;tracked.add(path);batch.set(db.doc(path),{userId:u.uid,criteria:{query:"demo"}});} await batch.commit(); await request(u); assert.equal((await db.collection("savedSearches").where("userId","==",u.uid).get()).size,0); await deleted(u);
  });
  await check("unsupported financial records stop classification without losing provider data", async () => {
    const u=await user("financial-unknown"); await put(`sellerPaymentProfiles/${u.uid}`,{providerAccountReference:"emulator-only-placeholder",status:"unexpected"}); const result=await request(u);assert.equal(result.state,"blocked");assert.ok(result.blockers.includes("financial_data_classification"));assert.equal((await read(`sellerPaymentProfiles/${u.uid}`)).status,"unexpected"); await db.doc(`sellerPaymentProfiles/${u.uid}`).delete();await processAccountDeletion(u.uid);await deleted(u);
  });
  await check("unknown legacy branch stops without blind deletion", async () => { const u = await user("legacy"); await put(`favorites/unknown-${suffix}`, { unexpectedHistoricalOwner: u.uid, unknownPayload: "do not guess" }); const result = await request(u); assert.equal(result.state, "blocked"); assert.ok(await auth.getUser(u.uid)); assert.equal(await exists(`favorites/unknown-${suffix}`), true); await db.doc(`favorites/unknown-${suffix}`).delete(); await processAccountDeletion(u.uid); await deleted(u); });
  await check("reports about a removed public review retain only restricted original evidence", async () => {
    const u = await user("review-case"); const reviewId=`review-case-${suffix}`, reportId=`review-case-report-${suffix}`;
    await put(`publicReviews/${reviewId}`,{reviewedUserId:u.uid,reviewerRole:"buyer",rating:2,tags:["friendly"],comment:"review original case evidence",createdAt:now()});
    await put(`reports/${reportId}`,{reporterId:control.uid,targetType:"review",targetId:reviewId,reason:"inappropriate",status:"submitted",createdAt:now(),updatedAt:now()});
    assert.equal((await request(u)).state,"pending"); assert.equal(await exists(`publicReviews/${reviewId}`),false);
    const report=await read(`reports/${reportId}`); const hold=`accountDeletionEvidence/${report.deletionEvidenceId}`; tracked.add(hold);
    assert.equal((await read(`${hold}/records/review`)).comment,"review original case evidence"); await assert.rejects(()=>getDoc(doc(control.firestore,"accountDeletionEvidence",report.deletionEvidenceId)));
    await db.doc(`reports/${reportId}`).update({status:"resolved",resolvedAt:now(),updatedAt:now()}); await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("pending profile bootstrap and Storage uploads are denied", async () => {
    const u = await user("bootstrap"); await seedOperation(u); await db.doc(`users/${u.uid}`).delete();
    assert.equal(await createProfileIfMissing(u.firestore, { uid: u.uid, displayName: "Should not return", photoURL: null }), false);
    await assert.rejects(() => uploadBytes(storageRef(u.storage, `users/${u.uid}/profile/blocked.png`), new Uint8Array([1]), {contentType:"image/png"}));
    await processAccountDeletion(u.uid); await deleted(u);
  });
  await check("scheduler pagination cursors no longer retain the deleted user or removed listing", async () => {
    const u = await user("cursors"); const lid=`cursor-listing-${suffix}`, job=`cursor-job-${suffix}`, cursor=`cursor-scheduler-${suffix}`;
    await put(`listings/${lid}`,listing(u)); await put(`engagementSchedulerCursors/${cursor}`,{listingId:lid}); await put(`engagementJobs/${job}`,{listingId:"other-control-listing",cursor:u.uid});
    await request(u); assert.equal(await exists(`engagementSchedulerCursors/${cursor}`),false); assert.equal((await read(`engagementJobs/${job}`)).cursor,null);
  });
  await check("retention expiry removes shared history/evidence/audit without deleting unrelated accounts", async () => {
    const ownTransactions = [...tracked].filter((path) => path.startsWith("transactions/"));
    for (const path of ownTransactions) if (await exists(path)) await db.doc(path).update({ retentionExpiresAt: past() });
    const ownEvidence = [...tracked].filter((path) => path.startsWith("accountDeletionEvidence/")); for (const path of ownEvidence) if (await exists(path)) await db.doc(path).update({ expiresAt: past() });
    for (const u of users) { const op = await read(`accountDeletionOperations/${u.uid}`); if (op?.state === "completed") await db.doc(`accountDeletionOperations/${u.uid}`).update({ expiresAt: past() }); }
    await enforceDeletionRetention(); for (const path of [...ownTransactions, ...ownEvidence]) assert.equal(await exists(path), false);
    assert.equal(JSON.stringify(await read(`users/${control.uid}`)), controlBefore); assert.ok(await auth.getUser(control.uid)); assert.equal(await exists(`users/${control.uid}/saved/isolation-item`), true); assert.equal((await bucket.file(`users/${control.uid}/profile/control.png`).exists())[0], true);
  });
  console.log(`Account deletion emulator validation: ${passed} checks passed; account isolation preserved.`);
} finally {
  for (const identity of [...users.map(u=>u.uid), ...aliases]) {
    const conversations=await db.collection("conversations").where("participants","array-contains",identity).get(); for(const item of conversations.docs) await db.recursiveDelete(item.ref);
    for(const [name,fields] of Object.entries({marketplaceEvents:["userId","sellerId"],offers:["buyerId","sellerId"],transactions:["buyerId","sellerId"],reports:["reporterId","userId"],promotions:["sellerId"],discoverySessions:["userId"]})) for(const field of fields) {const page=await db.collection(name).where(field,"==",identity).get();for(const item of page.docs)await db.recursiveDelete(item.ref);}
  }
  const holds=await db.collection("accountDeletionEvidence").get();for(const hold of holds.docs)if([...aliases].some(alias=>hash(`${alias}|${hold.data().casePath}`)===hold.id)){await db.recursiveDelete(hold.ref);for(const b of ["demo-takeme.firebasestorage.app","demo-takeme.appspot.com"]){const [files]=await getStorage().bucket(b).getFiles({prefix:`accountDeletionEvidence/${hold.id}/`});for(const f of files)await f.delete({ignoreNotFound:true});}}
  for (const path of [...tracked].sort((a,b) => b.length-a.length)) await db.recursiveDelete(db.doc(path));
  for (const u of users) {
    for (const c of ["users", "accountLifecycles", "accountDeletionOperations", "trustSummaries", "sellerFollowSummaries", "notificationSummaries", "userInterests"]) await db.recursiveDelete(db.doc(`${c}/${u.uid}`));
    await auth.deleteUser(u.uid).catch((e) => { if (e.code !== "auth/user-not-found") throw e; });
    for (const b of ["demo-takeme.firebasestorage.app", "demo-takeme.appspot.com"]) { const [files] = await getStorage().bucket(b).getFiles({ prefix: `users/${u.uid}/` }); for (const file of files) await file.delete({ ignoreNotFound: true }); }
  }
  await Promise.all(clients.map(deleteClientApp)); await deleteApp(admin);
}
