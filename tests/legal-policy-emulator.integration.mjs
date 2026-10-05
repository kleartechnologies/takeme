// Bounded local integration: demo-takeme only, runtime credentials stay in memory.
// Preserves the existing policy mirror and all unrelated seeded emulator records.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { createDemoPassword } from "./helpers/demo-eligibility.mjs";

const projectId = "demo-takeme";
for (const [key, value] of Object.entries({ GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" })) {
  if (process.env[key] !== undefined) assert.equal(process.env[key], value, `Refuse mismatched ${key}.`);
  process.env[key] = value;
}
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { demoReleasePolicy, productionReleasePolicy } = require("../functions/lib/release-policy.js");
const admin = initializeAdmin({ projectId, storageBucket: "demo-takeme.firebasestorage.app" }, `legal-policy-${randomUUID()}`);
const db = getFirestore(admin), identities = adminAuth(admin), mirror = db.doc("releasePolicies/current");
const previousMirror = await mirror.get();
const prefix = randomUUID(), people = [], fixturePaths = new Set();
let checks = 0;
const acceptance = { acceptTerms: true, acceptPrivacy: true, confirmAge18: true,
  termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion };
const canonicalMirror = { releaseTarget: "demo", projectId, ...demoReleasePolicy };
const unavailable = error => error.code === "functions/failed-precondition" && error.details?.reason === "policy-release-unavailable";
const check = async (label, action) => { await action(); console.log(`PASS ${++checks}: ${label}`); };
async function person(label) {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com` }, randomUUID());
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const value = { app, auth, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(value);
  value.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  return value;
}
const setupRef = person => db.doc(`users/${person.uid}/private/onboarding`);
const uploads = owner => ({ uploads: [{ path: `users/${owner.uid}/profile/synthetic-${prefix}.png`, contentType: "image/png", sizeBytes: 3 }] });
try {
  await mirror.set(canonicalMirror);
  const fresh = await person("fresh"), outsider = await person("outsider");
  await check("fresh account requires each confirmation and exact current versions", async () => {
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "acceptance");
    for (const field of ["acceptTerms", "acceptPrivacy", "confirmAge18"]) {
      for (const invalid of [false, undefined, "true"]) await assert.rejects(fresh.call("acceptWebPolicies", { ...acceptance, [field]: invalid }), { code: "functions/invalid-argument" });
    }
    for (const field of ["termsVersion", "privacyVersion"]) await assert.rejects(fresh.call("acceptWebPolicies", { ...acceptance, [field]: "older-policy" }), { code: "functions/failed-precondition" });
    assert.equal((await setupRef(fresh).get()).exists, false);
  });
  await check("profile, welcome, upload and marketplace mutation reject before eligibility", async () => {
    for (const name of ["completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits", "createFixedListingDraft"]) {
      await assert.rejects(fresh.call(name, name === "requestUploadPermits" ? uploads(fresh) : {}), { code: "functions/failed-precondition" });
    }
    assert.equal((await setupRef(fresh).get()).exists, false);
  });
  await check("acceptance is owner-bound, server-timestamped and idempotent", async () => {
    await fresh.call("acceptWebPolicies", { ...acceptance, uid: outsider.uid, acceptedAt: "forged", acceptanceSource: "ios" });
    const saved = (await setupRef(fresh).get()).data();
    for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "age18ConfirmedAt"]) assert.ok(saved[field] instanceof Timestamp);
    assert.equal(saved.termsVersion, demoReleasePolicy.termsVersion); assert.equal(saved.privacyVersion, demoReleasePolicy.privacyVersion);
    assert.equal(saved.acceptanceSource, "web"); assert.equal("acceptedAt" in saved, false); assert.equal("uid" in saved, false);
    assert.equal((await setupRef(outsider).get()).exists, false);
    await fresh.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await setupRef(fresh).get()).data(), saved);
  });
  await check("valid demo policy enforces profile then welcome and returns compliant status", async () => {
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "profile");
    await assert.rejects(fresh.call("completeFirstTimeProfile"), { code: "functions/failed-precondition" });
    await assert.rejects(fresh.call("finishAccountWelcome"), { code: "functions/failed-precondition" });
    await db.doc(`users/${fresh.uid}`).set({ uid: fresh.uid, displayName: "Synthetic local policy owner", photoURL: null,
      location: "", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await fresh.call("completeFirstTimeProfile"); assert.equal((await fresh.call("getAccountSetupStatus")).step, "welcome");
    await fresh.call("finishAccountWelcome"); assert.equal((await fresh.call("getAccountSetupStatus")).step, "ready");
    const saved = (await setupRef(fresh).get()).data();
    await fresh.call("completeFirstTimeProfile"); await fresh.call("finishAccountWelcome");
    assert.deepEqual((await setupRef(fresh).get()).data(), saved);
    assert.equal((await db.collection("listings").where("sellerId", "==", fresh.uid).get()).size, 0, "Account setup must not create a marketplace action.");
  });
  await check("eligible upload permits use exact owner path and refuse another owner's path", async () => {
    await assert.rejects(fresh.call("requestUploadPermits", { uploads: [{ ...uploads(fresh).uploads[0], path: `users/${outsider.uid}/profile/no.png` }] }), { code: "functions/invalid-argument" });
    const issued = await fresh.call("requestUploadPermits", uploads(fresh));
    assert.equal(issued.permits.length, 1); assert.equal(issued.permits[0].path, uploads(fresh).uploads[0].path);
    assert.ok((await setupRef(fresh).get()).data().uploadPermits[issued.permits[0].permitId].expiresAt instanceof Timestamp);
  });
  await check("marketplace mutations share current acceptance and restored acceptance resumes eligibility", async () => {
    const evidence = (await setupRef(fresh).get()).data();
    await setupRef(fresh).update({ termsVersion: "older-policy" });
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "acceptance");
    await assert.rejects(fresh.call("createFixedListingDraft"), error => error.details?.reason === "account-policy-required");
    await assert.rejects(fresh.call("requestUploadPermits", uploads(fresh)), error => error.details?.reason === "account-policy-required");
    await setupRef(fresh).set(evidence);
    // Reaching argument validation establishes eligibility without creating an item.
    await assert.rejects(fresh.call("createFixedListingDraft"), { code: "functions/invalid-argument" });
  });
  await check("existing malformed or revoked demo mirrors fail closed without accepting or writing", async () => {
    const before = (await setupRef(fresh).get()).data();
    const cases = [
      { ...canonicalMirror, publicationApproved: false }, { ...canonicalMirror, publicationApproved: "true" },
      { ...canonicalMirror, termsVersion: null }, { ...canonicalMirror, privacyVersion: null },
      { ...canonicalMirror, minimumAge: "18" }, { ...canonicalMirror, minimumAge: null }, { ...canonicalMirror, minimumAge: 17 },
      { ...canonicalMirror, projectId: "demo-other" }, { ...canonicalMirror, releaseTarget: "production" },
    ];
    for (const field of ["termsVersion", "privacyVersion", "minimumAge"]) { const value = { ...canonicalMirror }; delete value[field]; cases.push(value); }
    for (const value of cases) {
      await mirror.set(value);
      const status = await fresh.call("getAccountSetupStatus");
      assert.equal(status.policyAvailable, false); assert.equal(status.step, "acceptance"); assert.equal(status.termsVersion, null); assert.equal(status.privacyVersion, null);
      for (const name of ["acceptWebPolicies", "completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits", "createFixedListingDraft"]) {
        await assert.rejects(fresh.call(name, name === "acceptWebPolicies" ? acceptance : name === "requestUploadPermits" ? uploads(fresh) : {}), unavailable);
      }
      assert.deepEqual((await setupRef(fresh).get()).data(), before);
    }
    await mirror.set(canonicalMirror);
  });
  await check("deletion_pending wins over valid acceptance and all preparation writes", async () => {
    const path = `accountLifecycles/${fresh.uid}`; fixturePaths.add(path);
    await db.doc(path).set({ state: "deletion_pending", alias: `deleted-synthetic-${prefix}` });
    assert.equal((await fresh.call("getAccountSetupStatus")).step, "deletion");
    for (const name of ["acceptWebPolicies", "completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits", "createFixedListingDraft"]) {
      await assert.rejects(fresh.call(name, name === "acceptWebPolicies" ? acceptance : name === "requestUploadPermits" ? uploads(fresh) : {}), { code: "functions/failed-precondition" });
    }
  });
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, null); assert.equal(productionReleasePolicy.privacyVersion, null);
} finally {
  if (previousMirror.exists) await mirror.set(previousMirror.data()); else await mirror.delete();
  for (const path of fixturePaths) await db.recursiveDelete(db.doc(path));
  for (const person of people) {
    if (person.uid) { await db.recursiveDelete(db.doc(`users/${person.uid}`)); await identities.deleteUser(person.uid); }
    await deleteApp(person.app);
  }
  await deleteAdmin(admin);
}
console.log(`Demo legal-policy integration: ${checks} groups passed. Existing mirror restored; disposable users removed; no production access.`);
