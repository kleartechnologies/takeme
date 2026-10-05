// Bounded local integration: demo-takeme only, runtime credentials stay in memory.
// Preserves the existing policy mirror and all unrelated seeded emulator records.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getFirestore as clientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
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
const { policyAcceptancePath, legacyAcceptanceHistory } = require("../functions/lib/policy-acceptance-history.js");
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
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1"), firestore = clientFirestore(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  const value = { app, auth, firestore, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  people.push(value);
  value.uid = (await createUserWithEmailAndPassword(auth, `${label}-${prefix}@example.test`, createDemoPassword())).user.uid;
  return value;
}
const setupRef = person => db.doc(`users/${person.uid}/private/onboarding`);
const uploads = owner => ({ uploads: [{ path: `users/${owner.uid}/profile/synthetic-${prefix}.png`, contentType: "image/png", sizeBytes: 3 }] });
try {
  await mirror.set(canonicalMirror);
  const fresh = await person("fresh"), outsider = await person("outsider"), legacyOwner = await person("legacy");
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
    await Promise.all(Array.from({ length: 3 }, () => fresh.call("acceptWebPolicies", { ...acceptance,
      uid: outsider.uid, acceptedAt: "forged", acceptanceSource: "ios", acceptanceId: "client-chosen" })));
    const saved = (await setupRef(fresh).get()).data();
    for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "age18ConfirmedAt"]) assert.ok(saved[field] instanceof Timestamp);
    assert.equal(saved.termsVersion, demoReleasePolicy.termsVersion); assert.equal(saved.privacyVersion, demoReleasePolicy.privacyVersion);
    assert.equal(saved.acceptanceSource, "web"); assert.equal("acceptedAt" in saved, false); assert.equal("uid" in saved, false);
    assert.equal((await setupRef(outsider).get()).exists, false);
    await fresh.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await setupRef(fresh).get()).data(), saved);
    const history = await db.collection(`users/${fresh.uid}/private/policyAcceptances/events`).get();
    assert.equal(history.size, 1); assert.equal(history.docs[0].id, saved.acceptanceHistoryId);
    const event = history.docs[0].data();
    assert.equal(event.evidenceKind, "web-acceptance"); assert.equal(event.minimumAgeConfirmed, 18);
    assert.equal(event.source, "web"); assert.equal(event.projectId, projectId); assert.equal(event.releaseTarget, "demo");
    for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "ageConfirmedAt", "acceptedAt"]) assert.ok(event[field] instanceof Timestamp);
    assert.ok(event.termsAcceptedAt.isEqual(saved.termsAcceptedAt)); assert.ok(event.privacyAcceptedAt.isEqual(saved.privacyAcceptedAt));
    assert.ok(event.ageConfirmedAt.isEqual(saved.age18ConfirmedAt));
    const before = (await db.doc(policyAcceptancePath(fresh.uid, (await setupRef(fresh).get()).data().acceptanceHistoryId)).get()).data();
    await fresh.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await db.doc(policyAcceptancePath(fresh.uid, (await setupRef(fresh).get()).data().acceptanceHistoryId)).get()).data(), before);
  });
  await check("immutable history is unreadable and unwritable through owner or outsider client rules", async () => {
    const path = policyAcceptancePath(fresh.uid, (await setupRef(fresh).get()).data().acceptanceHistoryId);
    for (const person of [fresh, outsider]) {
      const ref = doc(person.firestore, path);
      for (const action of [() => getDoc(ref), () => setDoc(ref, { fabricated: true }), () => updateDoc(ref, { source: "client" }), () => deleteDoc(ref)]) {
        await assert.rejects(action(), /permission|denied/i);
      }
    }
  });
  await check("synthetic prior-version evidence is preserved while explicit reacceptance creates a new event", async () => {
    const prior = { termsVersion: "synthetic-historical-policy-1", privacyVersion: "synthetic-historical-policy-2" };
    const at = Timestamp.now();
    const existing = { acceptanceId: randomUUID(), ownerId: outsider.uid, schemaVersion: 1, evidenceKind: "web-acceptance",
      ...prior, minimumAgeConfirmed: 18, termsAcceptedAt: at, privacyAcceptedAt: at, ageConfirmedAt: at, acceptedAt: at,
      source: "web", releaseTarget: "demo", projectId };
    const oldRef = db.doc(policyAcceptancePath(outsider.uid, existing.acceptanceId));
    await oldRef.create(existing);
    await setupRef(outsider).set({ ...prior, termsAcceptedAt: at, privacyAcceptedAt: at, age18ConfirmedAt: at, acceptanceSource: "web", acceptanceHistoryId: existing.acceptanceId, revokedAt: null });
    assert.equal((await outsider.call("getAccountSetupStatus")).step, "acceptance");
    await outsider.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await oldRef.get()).data(), existing);
    assert.equal((await db.collection(`users/${outsider.uid}/private/policyAcceptances/events`).get()).size, 2);
    assert.equal((await setupRef(outsider).get()).data().termsVersion, demoReleasePolicy.termsVersion);
  });
  await check("legacy migration copies exact evidence and malformed history refuses reacceptance", async () => {
    const legacy = { termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion,
      termsAcceptedAt: Timestamp.fromMillis(1000), privacyAcceptedAt: Timestamp.fromMillis(2000),
      age18ConfirmedAt: Timestamp.fromMillis(3000), acceptanceSource: "web", revokedAt: null };
    const path = policyAcceptancePath(legacyOwner.uid, legacyAcceptanceHistory(legacyOwner.uid, legacy).acceptanceId);
    await setupRef(legacyOwner).set(legacy);
    await legacyOwner.call("getAccountSetupStatus"); assert.equal((await db.doc(path).get()).exists, false);
    await legacyOwner.call("acceptWebPolicies", acceptance);
    const migrated = (await db.doc(path).get()).data(), projected = (await setupRef(legacyOwner).get()).data();
    assert.equal(migrated.evidenceKind, "legacy-current"); assert.ok(migrated.termsAcceptedAt.isEqual(legacy.termsAcceptedAt));
    assert.ok(migrated.privacyAcceptedAt.isEqual(legacy.privacyAcceptedAt)); assert.ok(migrated.ageConfirmedAt.isEqual(legacy.age18ConfirmedAt));
    for (const field of ["acceptedAt", "projectId", "releaseTarget", "revokedAt"]) assert.equal(Object.hasOwn(migrated, field), false);
    assert.deepEqual(projected, { ...legacy, acceptanceHistoryId: migrated.acceptanceId });
    await legacyOwner.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await setupRef(legacyOwner).get()).data(), projected, "An explicit null revocation remains a valid unrevoked retry.");
    assert.equal((await db.collection(`users/${legacyOwner.uid}/private/policyAcceptances/events`).get()).size, 1);
    await db.doc(path).update({ minimumAgeConfirmed: "18" });
    await assert.rejects(legacyOwner.call("acceptWebPolicies", acceptance), error => error.details?.reason === "policy-acceptance-history-invalid");
    assert.deepEqual((await setupRef(legacyOwner).get()).data(), projected);
    // Restore only the owned fixture corruption, never a marketplace acceptance write.
    await db.doc(path).set(migrated);
  });
  await check("same-version revocation records fresh explicit consent while preserving the previous immutable event", async () => {
    const previous = (await setupRef(outsider).get()).data(), oldRef = db.doc(policyAcceptancePath(outsider.uid, previous.acceptanceHistoryId));
    const oldEvent = (await oldRef.get()).data(), revokedAt = Timestamp.now();
    await setupRef(outsider).update({ revokedAt });
    assert.equal((await outsider.call("getAccountSetupStatus")).step, "acceptance");
    await assert.rejects(outsider.call("acceptWebPolicies", { ...acceptance, confirmAge18: false }), { code: "functions/invalid-argument" });
    await outsider.call("acceptWebPolicies", acceptance);
    const current = (await setupRef(outsider).get()).data();
    assert.notEqual(current.acceptanceHistoryId, previous.acceptanceHistoryId); assert.equal(Object.hasOwn(current, "revokedAt"), false);
    assert.deepEqual((await oldRef.get()).data(), oldEvent);
    const freshEvent = (await db.doc(policyAcceptancePath(outsider.uid, current.acceptanceHistoryId)).get()).data();
    assert.ok(freshEvent.reacceptanceAfterRevokedAt.isEqual(revokedAt));
    assert.ok(freshEvent.acceptedAt.toMillis() >= revokedAt.toMillis());
    const count = (await db.collection(`users/${outsider.uid}/private/policyAcceptances/events`).get()).size;
    await outsider.call("acceptWebPolicies", acceptance);
    assert.deepEqual((await setupRef(outsider).get()).data(), current);
    assert.equal((await db.collection(`users/${outsider.uid}/private/policyAcceptances/events`).get()).size, count);
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
  assert.equal(productionReleasePolicy.termsVersion, "1.0"); assert.equal(productionReleasePolicy.privacyVersion, "1.0");
} finally {
  if (previousMirror.exists) await mirror.set(previousMirror.data()); else await mirror.delete();
  for (const path of fixturePaths) await db.recursiveDelete(db.doc(path));
  for (const person of people) {
    if (person.uid) {
      await db.recursiveDelete(db.doc(`users/${person.uid}`));
      assert.equal((await db.collection(`users/${person.uid}/private/policyAcceptances/events`).get()).size, 0, "Existing recursive private-user cleanup must remove nested acceptance history.");
      await identities.deleteUser(person.uid);
    }
    await deleteApp(person.app);
  }
  await deleteAdmin(admin);
}
console.log(`Demo legal-policy integration: ${checks} groups passed. Existing mirror restored; disposable users removed; no production access.`);
