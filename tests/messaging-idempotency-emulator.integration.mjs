// Demo-only, bounded integration. Synthetic credentials and keys stay in memory.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, getDoc, doc } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
// This assertion selector does not enable the server path. The private emulator
// launcher must independently provide its explicit demo target/window settings.
const legacyWindowEnabled = process.env.TAKEME_TEST_LEGACY_MESSAGE_WINDOW === "enabled";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: adminApp, deleteApp: deleteAdminApp, getApp } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { messageRequestIdentity, MESSAGE_REQUEST_RETENTION_MS } = require("../functions/lib/message-request.js");
const { CADENCE_POLICIES } = require("../functions/lib/action-cadence-policy.js");
const admin = adminApp({ projectId }, `message-idempotency-${randomUUID()}`), db = adminFirestore(admin);
const people = [], paths = new Set(), prefix = randomUUID();
const hash = value => createHash("sha256").update(value).digest("hex");
const put = async (path, data) => { paths.add(path); await db.doc(path).set(data); };
let passed = 0, triggerApp;
const check = async (label, test) => { await test(); console.log(`PASS ${++passed}: ${label}`); };
const call = async (person, name, data = {}) => (await httpsCallable(person.functions, name)(data)).data;
async function client(label) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.firebasestorage.app` }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const person = { app, auth, firestore, functions, uid: null }; people.push(person);
  person.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  await acceptDemoPolicies(app);
  await put(`users/${person.uid}`, { uid: person.uid, displayName: "Synthetic messaging test", photoURL: null, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  return person;
}
async function eventually(test, label) {
  for (let i = 0; i < 80; i++) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out waiting for ${label}`);
}
try {
  const seller = await client("seller"), buyer = await client("buyer"), outsider = await client("outsider");
  const conversations = [];
  for (let i = 0; i < 2; i++) {
    const listingId = `message-idempotency-${prefix}-${i}`;
    await put(`listings/${listingId}`, { sellerId: seller.uid, title: "Synthetic local camera", description: "No real goods or exchange", listingType: "buy_now", status: "active", categoryId: "electronics", condition: "Good", price: 25, privacyVersion: 2, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    const { conversationId } = await call(buyer, "openListingConversation", { listingId });
    conversations.push(conversationId); paths.add(`conversations/${conversationId}`);
  }
  const conversationId = conversations[0], key = randomUUID(), body = "Synthetic staging-safe message. No real exchange.";
  const send = (person, conversationId, body, idempotencyKey) => call(person, "sendConversationMessage", { conversationId, body, idempotencyKey });
  const messages = id => db.collection(`conversations/${id}/messages`);
  const cadence = () => db.doc(`users/${buyer.uid}/private/cadence-message`).get();
  const unread = async id => (await db.doc(`conversations/${id}`).get()).data().unreadBy[seller.uid];
  const eventId = messageId => hash(`${buyer.uid}|MESSAGE_SENT|message|${messageId}`);
  const notice = (recipient, conversation, message) => db.doc(`users/${recipient}/notifications/${hash(`${recipient}|message:${conversation}:${message}`)}`);
  let first, concurrent, changed, second, reply;
  await check("normal send stores canonical server identity and one private expiring receipt", async () => {
    first = await send(buyer, conversationId, `  ${body}  `, key);
    const identity = messageRequestIdentity(buyer.uid, conversationId, key, body);
    assert.equal(first.messageId, identity.messageId);
    assert.equal((await messages(conversationId).doc(first.messageId).get()).data().senderId, buyer.uid);
    assert.equal((await messages(conversationId).doc(first.messageId).get()).data().body, body);
    const receipt = (await db.doc(`users/${buyer.uid}/private/messageRequests/messageSendReceipts/${identity.requestId}`).get()).data();
    assert.equal(receipt.expiresAt.toMillis() - receipt.createdAt.toMillis(), MESSAGE_REQUEST_RETENTION_MS);
    assert.equal(JSON.stringify(receipt).includes(key), false);
    assert.equal(JSON.stringify(receipt).includes(body), false);
  });
  await check("identical retries and concurrent duplicates create one message and one unread increment", async () => {
    assert.equal((await send(buyer, conversationId, body, key)).messageId, first.messageId);
    const concurrentKey = randomUUID();
    const results = await Promise.all(Array.from({ length: 3 }, () => send(buyer, conversationId, body, concurrentKey)));
    assert.equal(new Set(results.map(value => value.messageId)).size, 1); concurrent = results[0];
    assert.notEqual(concurrent.messageId, first.messageId);
    assert.equal((await messages(conversationId).get()).size, 2);
    assert.equal(await unread(conversationId), 2);
    assert.equal((await cadence()).data().events.length, 2);
  });
  await check("conflicting content on an existing key fails without changing state", async () => {
    await assert.rejects(() => send(buyer, conversationId, "Changed content", key), error => error.code === "functions/failed-precondition" && error.details?.reason === "message-request-conflict");
    assert.equal((await messages(conversationId).get()).size, 2); assert.equal(await unread(conversationId), 2);
    assert.equal((await cadence()).data().events.length, 2);
  });
  await check("different message, conversation and sender are independently scoped", async () => {
    changed = await send(buyer, conversationId, "A different synthetic question", randomUUID());
    second = await send(buyer, conversations[1], body, key);
    reply = await send(seller, conversationId, body, key);
    assert.equal(new Set([first, concurrent, changed, second, reply].map(value => value.messageId)).size, 5);
    assert.equal((await messages(conversationId).get()).size, 4);
    assert.equal((await messages(conversations[1]).get()).size, 1);
    assert.equal((await cadence()).data().events.length, 4);
  });
  await check("one logical message emits one notification and one buyer engagement event even after trigger retries", async () => {
    for (const [id, message] of [[conversationId, first], [conversationId, concurrent], [conversationId, changed], [conversations[1], second]]) {
      await eventually(async () => (await notice(seller.uid, id, message.messageId).get()).exists && (await db.doc(`marketplaceEvents/${eventId(message.messageId)}`).get()).exists, "message side effects");
      paths.add(`marketplaceEvents/${eventId(message.messageId)}`);
    }
    await eventually(async () => (await notice(buyer.uid, conversationId, reply.messageId).get()).exists, "seller reply notice");
    const functionsModule = require("../functions/lib/index.js");
    triggerApp = getApp();
    const snapshot = await messages(conversationId).doc(first.messageId).get();
    const event = { data: snapshot, params: { conversationId, messageId: first.messageId } };
    await Promise.all([functionsModule.onMessageEngagementCreated.run(event), functionsModule.onMessageEngagementCreated.run(event), functionsModule.onConversationMessageCreated.run(event)]);
    const sellerNotices = await db.collection(`users/${seller.uid}/notifications`).get();
    assert.equal(sellerNotices.docs.filter(doc => doc.data().type === "message_received").length, 4);
    assert.equal((await db.doc(`notificationSummaries/${seller.uid}`).get()).data().unreadCount, 4);
    assert.equal((await db.collection("marketplaceEvents").where("userId", "==", buyer.uid).where("eventType", "==", "MESSAGE_SENT").get()).size, 4);
    assert.equal((await db.collection("marketplaceEvents").where("userId", "==", seller.uid).where("eventType", "==", "MESSAGE_SENT").get()).size, 0);
    assert.equal(await unread(conversationId), 3);
  });
  await check("expired/removed receipt and an exhausted cadence budget cannot duplicate a delivered message", async () => {
    const identity = messageRequestIdentity(buyer.uid, conversationId, key, body);
    const ref = db.doc(`users/${buyer.uid}/private/messageRequests/messageSendReceipts/${identity.requestId}`);
    await ref.update({ expiresAt: Timestamp.fromMillis(0) });
    assert.equal((await send(buyer, conversationId, body, key)).messageId, first.messageId);
    await ref.delete();
    await put(`users/${buyer.uid}/private/cadence-message`, { version: 1, action: "message", events: Array.from({ length: CADENCE_POLICIES.message.limit }, () => ({ at: Timestamp.now() })), updatedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000) });
    assert.equal((await send(buyer, conversationId, body, key)).messageId, first.messageId);
    await assert.rejects(() => send(buyer, conversationId, body, randomUUID()), error => error.code === "functions/resource-exhausted" && error.details?.reason === "cadence-limit" && error.details?.retryAfterMs > 0);
    assert.equal((await messages(conversationId).get()).size, 4); assert.equal(await unread(conversationId), 3);
  });
  await check("invalid explicit keys, cross-user access and private receipt reads fail closed", async () => {
    if (!legacyWindowEnabled) await assert.rejects(() => call(buyer, "sendConversationMessage", { conversationId, body }), error => error.code === "functions/invalid-argument");
    for (const idempotencyKey of [null, "", "short"]) await assert.rejects(() => send(buyer, conversationId, body, idempotencyKey), error => error.code === "functions/invalid-argument");
    await assert.rejects(() => send(outsider, conversationId, body, key), error => error.code === "functions/permission-denied");
    const identity = messageRequestIdentity(buyer.uid, conversationId, "another-private-key-0001", body);
    await put(`users/${buyer.uid}/private/messageRequests/messageSendReceipts/${identity.requestId}`, { messageId: identity.messageId, bodyHash: identity.bodyHash, expiresAt: Timestamp.now() });
    for (const person of [buyer, outsider]) await assert.rejects(() => getDoc(doc(person.firestore, `users/${buyer.uid}/private/messageRequests/messageSendReceipts/${identity.requestId}`)), /permission/i);
  });
  await check("pending deletion still blocks a matching retry without activating deletion", async () => {
    await put(`accountLifecycles/${buyer.uid}`, { state: "deletion_pending", alias: "deleted-synthetic-idempotency" });
    await db.doc(`users/${buyer.uid}/private/onboarding`).delete();
    await assert.rejects(() => send(buyer, conversationId, body, key), error => error.code === "functions/failed-precondition");
    assert.equal((await messages(conversationId).get()).size, 4);
  });
  await check("old-client missing-key sends are bounded by server configuration and retain all owner guards", async () => {
    const legacyBuyer = await client("legacy-buyer");
    const { conversationId: legacyConversation } = await call(legacyBuyer, "openListingConversation", { listingId: `message-idempotency-${prefix}-0` });
    paths.add(`conversations/${legacyConversation}`);
    const oldPayload = { conversationId: legacyConversation, body };
    if (!legacyWindowEnabled) {
      // Request data cannot opt into a server-only transition, even when it
      // copies configuration names or supplies a client-chosen deadline.
      await assert.rejects(() => call(legacyBuyer, "sendConversationMessage", { ...oldPayload,
        TAKEME_ENABLE_LEGACY_MESSAGE_SEND: "true", TAKEME_LEGACY_MESSAGE_SEND_UNTIL: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }), error => error.code === "functions/invalid-argument");
      assert.equal((await messages(legacyConversation).get()).size, 0);
      return;
    }
    const firstLegacy = await call(legacyBuyer, "sendConversationMessage", oldPayload);
    const secondLegacy = await call(legacyBuyer, "sendConversationMessage", oldPayload);
    assert.notEqual(firstLegacy.messageId, secondLegacy.messageId); // Identical intentional sends are not collapsed.
    for (const legacy of [firstLegacy, secondLegacy]) {
      assert.match(legacy.messageId, /^m_[a-f0-9]{64}$/);
      const receipt = (await db.doc(`users/${legacyBuyer.uid}/private/messageRequests/messageSendReceipts/${legacy.messageId.slice(2)}`).get()).data();
      assert.equal(receipt.messageId, legacy.messageId);
      assert.equal(receipt.expiresAt.toMillis() - receipt.createdAt.toMillis(), MESSAGE_REQUEST_RETENTION_MS);
      assert.equal(JSON.stringify(receipt).includes(body), false);
    }
    const newKey = randomUUID();
    const newResults = await Promise.all(Array.from({ length: 3 }, () => send(legacyBuyer, legacyConversation, body, newKey)));
    assert.equal(new Set(newResults.map(value => value.messageId)).size, 1);
    assert.equal((await messages(legacyConversation).get()).size, 3);
    assert.equal(await unread(legacyConversation), 3);
    assert.equal((await db.doc(`users/${legacyBuyer.uid}/private/cadence-message`).get()).data().events.length, 3);
    for (const message of [firstLegacy, secondLegacy, newResults[0]]) {
      const event = hash(`${legacyBuyer.uid}|MESSAGE_SENT|message|${message.messageId}`);
      await eventually(async () => (await notice(seller.uid, legacyConversation, message.messageId).get()).exists
        && (await db.doc(`marketplaceEvents/${event}`).get()).exists, "legacy and keyed message side effects");
      paths.add(`marketplaceEvents/${event}`);
    }
    assert.equal((await db.collection(`users/${seller.uid}/notifications`).get()).docs.filter(snapshot => snapshot.data().href === `/messages/${legacyConversation}`).length, 3);
    for (const idempotencyKey of [null, "", "short"]) await assert.rejects(() => send(legacyBuyer, legacyConversation, body, idempotencyKey), error => error.code === "functions/invalid-argument");
    await assert.rejects(() => call(outsider, "sendConversationMessage", oldPayload), error => error.code === "functions/permission-denied");
    await db.doc(`users/${legacyBuyer.uid}/private/onboarding`).delete();
    await assert.rejects(() => call(legacyBuyer, "sendConversationMessage", oldPayload), error => error.code === "functions/failed-precondition");
    await put(`accountLifecycles/${legacyBuyer.uid}`, { state: "deletion_pending", alias: "deleted-synthetic-legacy" });
    await assert.rejects(() => call(legacyBuyer, "sendConversationMessage", oldPayload), error => error.code === "functions/failed-precondition");
    await signOut(legacyBuyer.auth);
    await assert.rejects(() => call(legacyBuyer, "sendConversationMessage", oldPayload), error => error.code === "functions/unauthenticated");
    assert.equal((await messages(legacyConversation).get()).size, 3);
    assert.equal(await unread(legacyConversation), 3);
  });
  console.log(`Messaging idempotency emulator validation: ${passed} groups passed; demo only.`);
} finally {
  for (const path of paths) await db.recursiveDelete(db.doc(path));
  for (const person of people) {
    if (person.uid) {
      for (const collection of ["users", "accountLifecycles", "notificationSummaries", "userInterests", "trustSummaries"]) await db.recursiveDelete(db.doc(`${collection}/${person.uid}`));
      for (const collection of ["marketplaceEvents", "engagementJobs"]) { const query = collection === "marketplaceEvents" ? db.collection(collection).where("userId", "==", person.uid) : db.collection(collection).where("listingId", "in", [0, 1].map(i => `message-idempotency-${prefix}-${i}`)); for (const document of (await query.get()).docs) await db.recursiveDelete(document.ref); }
      await adminAuth(admin).deleteUser(person.uid).catch(error => { if (error.code !== "auth/user-not-found") throw error; });
    }
    await deleteApp(person.app);
  }
  await deleteAdminApp(admin);
  if (triggerApp) await deleteAdminApp(triggerApp);
}
