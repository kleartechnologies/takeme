// Demo only. This suite temporarily loads a tracked historical Storage ruleset,
// restores final rules in finally, and keeps all synthetic credentials in memory.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getMetadata } from "firebase/storage";
import { acceptDemoPolicies, permitDemoUpload, createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme", bucketName = "demo-takeme.firebasestorage.app";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: adminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const admin = initializeAdmin({ projectId, storageBucket: bucketName }, `rollout-${randomUUID()}`);
const db = adminFirestore(admin), identities = adminAuth(admin), bucket = adminStorage(admin).bucket();
const people = [], objects = new Set(), paths = new Set(), prefix = randomUUID();
const finalRules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
const legacyRules = await readFile(new URL("./fixtures/storage-rollout-legacy.rules", import.meta.url), "utf8");
let mirrorBefore, checks = 0;
const denied = error => /permission|unauthorized/.test(error.code ?? "");
const unavailable = error => error.code === "functions/failed-precondition" && error.details?.reason === "policy-release-unavailable";
const check = async (label, test) => { await test(); console.log(`PASS ${++checks}: ${label}`); };
async function loadStorageRules(content) {
  const endpoint = new URL("http://127.0.0.1:9199/internal/setRules");
  assert.equal(endpoint.hostname, "127.0.0.1");
  assert.equal(endpoint.port, "9199");
  const response = await fetch(endpoint, { method: "PUT", redirect: "error", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: { files: [{ name: "storage.rules", content }] } }), signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, "The demo Storage rules load must succeed.");
  await response.body?.cancel();
}
async function person(label) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, storageBucket: bucketName }, randomUUID());
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001); connectStorageEmulator(storage, "127.0.0.1", 9199);
  const value = { app, auth, functions, storage, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(value);
  value.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  await db.doc(`users/${value.uid}`).set({ uid: value.uid, displayName: "Synthetic rollout account", photoURL: null, location: "Jitra, Kedah", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  return value;
}
const putImage = (owner, path, metadata = { contentType: "image/png" }) => {
  objects.add(path); return uploadBytes(ref(owner.storage, path), new Uint8Array([1, 2, 3]), metadata);
};
try {
  const owner = await person("owner"), other = await person("other"), fresh = await person("fresh");
  await acceptDemoPolicies(owner.app, owner.functions);
  mirrorBefore = (await db.doc("releasePolicies/current").get()).data();
  const listingId = `rollout-${prefix}`;
  paths.add(`listings/${listingId}`);
  await db.doc(`listings/${listingId}`).set({ sellerId: owner.uid, title: "Synthetic rollout item", description: "No real goods or exchange", listingType: "buy_now", status: "draft", price: 10, categoryId: "electronics", condition: "Good", imageUrls: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });

  await check("phase A preserves historical owner uploads while denying another owner", async () => {
    await loadStorageRules(legacyRules);
    await putImage(owner, `users/${owner.uid}/profile/legacy-${prefix}.png`);
    await putImage(owner, `users/${owner.uid}/listings/${listingId}/legacy-${prefix}.png`);
    await assert.rejects(() => putImage(other, `users/${owner.uid}/profile/outsider-${prefix}.png`), denied);
  });
  await check("phase B permit-aware client also works before Storage tightening", async () => {
    const path = `users/${owner.uid}/profile/pre-tightening-${prefix}.png`;
    const metadata = await permitDemoUpload(owner.app, path, "image/png", 3, owner.functions);
    await putImage(owner, path, metadata);
    assert.equal((await getMetadata(ref(owner.storage, path))).customMetadata.takemeUploadPermit, metadata.customMetadata.takemeUploadPermit);
  });
  await check("phase C final rules deny permitless uploads and old-path overwrites", async () => {
    await loadStorageRules(finalRules);
    await assert.rejects(() => putImage(owner, `users/${owner.uid}/profile/no-permit-${prefix}.png`), denied);
    const path = `users/${owner.uid}/profile/legacy-${prefix}.png`;
    const metadata = await permitDemoUpload(owner.app, path, "image/png", 3, owner.functions);
    await assert.rejects(() => putImage(owner, path, metadata), denied);
  });
  await check("phase C final permit uploads and readback remain available to the eligible owner", async () => {
    for (const path of [`users/${owner.uid}/profile/final-${prefix}.png`, `users/${owner.uid}/listings/${listingId}/final-${prefix}.png`]) {
      const metadata = await permitDemoUpload(owner.app, path, "image/png", 3, owner.functions);
      await putImage(owner, path, metadata);
      assert.equal((await getMetadata(ref(owner.storage, path))).size, 3);
      await assert.rejects(() => putImage(other, path, metadata), denied);
      await assert.rejects(() => putImage(owner, path, metadata), denied);
    }
  });
  await check("inactive policy blocks acceptance, profile completion, welcome and new permits", async () => {
    await db.doc("releasePolicies/current").set({ ...mirrorBefore, publicationApproved: false });
    const status = await fresh.call("getAccountSetupStatus");
    assert.equal(status.policyAvailable, false); assert.equal(status.termsVersion, null); assert.equal(status.step, "acceptance");
    for (const name of ["acceptWebPolicies", "completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits"]) {
      await assert.rejects(() => fresh.call(name), unavailable, name);
    }
    await assert.rejects(() => owner.call("requestUploadPermits"), unavailable);
    assert.equal((await db.doc(`users/${fresh.uid}/private/onboarding`).get()).exists, false);
  });
  await check("restored demo-only policy allows the authoritative first-time onboarding sequence", async () => {
    await db.doc("releasePolicies/current").set(mirrorBefore);
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "acceptance");
    await acceptDemoPolicies(fresh.app, fresh.functions);
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "profile");
    await fresh.call("completeFirstTimeProfile");
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "welcome");
    await fresh.call("finishAccountWelcome");
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "ready");
    assert.equal((await db.collection("listings").where("sellerId", "==", fresh.uid).get()).size, 0);
  });
  await check("deletion-pending lifecycle revokes outstanding permits and blocks onboarding", async () => {
    const path = `users/${owner.uid}/profile/pending-${prefix}.png`;
    const metadata = await permitDemoUpload(owner.app, path, "image/png", 3, owner.functions);
    paths.add(`accountLifecycles/${owner.uid}`);
    const batch = db.batch(); batch.set(db.doc(`accountLifecycles/${owner.uid}`), { state: "deletion_pending" });
    batch.delete(db.doc(`users/${owner.uid}/private/onboarding`)); await batch.commit();
    assert.equal((await owner.call("getAccountSetupStatus")).step, "deletion");
    await assert.rejects(() => owner.call("requestUploadPermits"), error => error.code === "functions/failed-precondition");
    await assert.rejects(() => putImage(owner, path, metadata), denied);
  });
} finally {
  await loadStorageRules(finalRules);
  if (mirrorBefore) await db.doc("releasePolicies/current").set(mirrorBefore);
  for (const path of objects) await bucket.file(path).delete({ ignoreNotFound: true });
  for (const path of paths) await db.recursiveDelete(db.doc(path));
  for (const value of people) {
    if (value.uid) { await db.recursiveDelete(db.doc(`users/${value.uid}`)); await identities.deleteUser(value.uid).catch(() => undefined); }
    await deleteApp(value.app);
  }
  await deleteAdmin(admin);
}
console.log(`Demo rollout/onboarding checks passed: ${checks}. No production policy was activated.`);
