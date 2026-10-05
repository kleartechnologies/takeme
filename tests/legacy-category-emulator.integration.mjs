// Demo-only, bounded legacy trigger checks. No production credentials or requests.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { deleteApp: deleteAdminApp, getApp } = require("firebase-admin/app");
const functionsModule = require("../functions/lib/index.js"), db = getFirestore();
const prefix = randomUUID(), people = [], listings = [], eventIds = [];
const hash = value => createHash("sha256").update(value).digest("hex");
let passed = 0;
const check = async (label, test) => { await test(); console.log(`PASS ${++passed}: ${label}`); };
async function client(label) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com` }, randomUUID());
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const person = { app, uid: null }; people.push(person);
  person.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  await acceptDemoPolicies(app, functions);
  return person;
}
try {
  const seller = await client("legacy-seller"), buyer = await client("legacy-buyer");
  const base = { sellerId: seller.uid, title: "Synthetic legacy camera", description: "No real goods or exchange", status: "active", listingType: "buy_now", condition: "Good", price: 25, searchTokens: ["camera"], privacyVersion: 2, publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  for (const [label, category] of [["valid", "electronics"], ["missing", undefined], ["malformed", { unexpected: "category" }]]) {
    await check(`${label} category trigger preserves generic jobs without fabricated category analytics`, async () => {
      const listingId = `legacy-category-${prefix}-${label}`, ref = db.doc(`listings/${listingId}`);
      listings.push(listingId);
      const after = { ...base, ...(category === undefined ? {} : { categoryId: category }) };
      await ref.set(after);
      const eventKey = `bounded-category-event-${prefix}-${label}`;
      const event = { id: eventKey, params: { listingId }, data: { before: { data: () => ({ ...after, status: "draft" }) }, after: { data: () => after, updateTime: Timestamp.now() } } };
      await functionsModule.onListingEngagementChanged.run(event);
      const jobs = (await db.collection("engagementJobs").where("eventKey", "==", eventKey).get()).docs.map(doc => doc.data());
      assert.equal(jobs.filter(job => job.kind === "followers").length, 1);
      assert.deepEqual(jobs.filter(job => job.kind === "searches").map(job => job.categoryKey).sort(), label === "valid" ? ["*", "electronics"] : ["*"]);
      if (label !== "valid") assert.ok(jobs.every(job => !job.listingSnapshot || !("categoryId" in job.listingSnapshot)));
      // Exercise the same trusted event-to-analytics path without creating chat data.
      const conversationId = `legacy-category-conversation-${prefix}-${label}`;
      await functionsModule.onConversationStarted.run({ params: { conversationId }, data: { data: () => ({ buyerId: buyer.uid, sellerId: seller.uid, listingId }) } });
      const eventId = hash(`${buyer.uid}|MESSAGE_STARTED|conversation|${conversationId}`); eventIds.push(eventId);
      const record = (await db.doc(`marketplaceEvents/${eventId}`).get()).data();
      assert.ok(record);
      assert.equal(record.categoryId, label === "valid" ? "electronics" : undefined);
      const interests = (await db.doc(`userInterests/${buyer.uid}`).get()).data();
      assert.deepEqual(Object.keys(interests.category), ["electronics"]);
    });
  }
  await check("deleted listing produces no engagement jobs", async () => {
    const listingId = `legacy-category-deleted-${prefix}`, eventKey = `bounded-category-deleted-${prefix}`;
    await functionsModule.onListingEngagementChanged.run({ id: eventKey, params: { listingId }, data: { before: { data: () => base }, after: { data: () => undefined } } });
    assert.equal((await db.collection("engagementJobs").where("eventKey", "==", eventKey).get()).size, 0);
  });
  await check("normal price-drop engagement continues for valid listings", async () => {
    const listingId = listings[0], eventKey = `bounded-category-price-${prefix}`;
    const before = { ...base, categoryId: "electronics" }, after = { ...before, price: 20 };
    await db.doc(`listings/${listingId}`).update({ price: 20 });
    await functionsModule.onListingEngagementChanged.run({ id: eventKey, params: { listingId }, data: { before: { data: () => before }, after: { data: () => after, updateTime: Timestamp.now() } } });
    const jobs = (await db.collection("engagementJobs").where("eventKey", "==", eventKey).get()).docs.map(doc => doc.data());
    assert.equal(jobs.filter(job => job.kind === "watchers" && job.eventType === "saved_price_drop").length, 1);
  });
  console.log(`Legacy category emulator validation: ${passed} groups passed; demo only.`);
} finally {
  for (const listingId of listings) {
    await db.recursiveDelete(db.doc(`listings/${listingId}`));
    await db.recursiveDelete(db.doc(`listingPriceHistory/${listingId}`));
    for (const doc of (await db.collection("engagementJobs").where("listingId", "==", listingId).get()).docs) await db.recursiveDelete(doc.ref);
  }
  for (const eventId of eventIds) await db.doc(`marketplaceEvents/${eventId}`).delete();
  for (const person of people) {
    if (person.uid) { await db.recursiveDelete(db.doc(`users/${person.uid}`)); await db.recursiveDelete(db.doc(`userInterests/${person.uid}`)); await adminAuth().deleteUser(person.uid).catch(error => { if (error.code !== "auth/user-not-found") throw error; }); }
    await deleteApp(person.app);
  }
  await deleteAdminApp(getApp());
}
