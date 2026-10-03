// Local demo only. Random test credentials/tokens stay in memory and are never printed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { createProfileIfMissing } from "../src/lib/firebase/profile-bootstrap.ts";

const projectId = "demo-takeme";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const admin = initializeAdmin({ projectId }); const db = getAdminFirestore();
const { demoReleasePolicy } = require("../functions/lib/release-policy.js");
const clients = [], policy = { acceptTerms: true, acceptPrivacy: true, confirmAge18: true, termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion };
let passed = 0;
async function check(label, fn) { await fn(); console.log(`PASS ${++passed}: ${label}`); }
async function client(provider = "password") {
  const app = initializeApp({ projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com` }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectFirestoreEmulator(firestore, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const person = { app, auth, firestore, email: `auth-${randomUUID()}@example.test`, password: randomUUID(), uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  clients.push(person);
  if (provider === "password") person.uid = (await createUserWithEmailAndPassword(auth, person.email, person.password)).user.uid;
  if (provider === "google") {
    person.google = GoogleAuthProvider.credential(JSON.stringify({ sub: randomUUID(), email: person.email, email_verified: true, name: "Google demo" }));
    person.uid = (await signInWithCredential(auth, person.google)).user.uid;
  }
  return person;
}
const setupRef = person => db.doc(`users/${person.uid}/private/onboarding`);
async function complete(person) {
  await person.call("acceptWebPolicies", policy);
  await createProfileIfMissing(person.firestore, person.auth.currentUser, "Auth demo");
  await person.call("completeFirstTimeProfile"); await person.call("finishAccountWelcome");
}
try {
  const owner = await client(), other = await client(), google = await client("google"), guest = await client("guest");
  await check("new email and mock Google identities both require acceptance", async () => {
    for (const person of [owner, google]) assert.equal((await person.call("getAccountSetupStatus")).step, "acceptance");
    assert.deepEqual(google.auth.currentUser.providerData.map(p => p.providerId), ["google.com"]);
    await assert.rejects(() => guest.call("getAccountSetupStatus"), error => error.code === "functions/unauthenticated");
  });
  await check("unchecked Terms, Privacy and 18+ plus wrong versions are rejected", async () => {
    for (const key of ["acceptTerms", "acceptPrivacy", "confirmAge18"]) await assert.rejects(() => owner.call("acceptWebPolicies", { ...policy, [key]: false }), error => error.code === "functions/invalid-argument");
    for (const key of ["termsVersion", "privacyVersion"]) await assert.rejects(() => owner.call("acceptWebPolicies", { ...policy, [key]: "unapproved" }), error => error.code === "functions/failed-precondition");
    assert.equal((await setupRef(owner).get()).exists, false);
    await assert.rejects(() => owner.call("completeFirstTimeProfile"), error => error.code === "functions/failed-precondition");
    await assert.rejects(() => owner.call("finishAccountWelcome"), error => error.code === "functions/failed-precondition");
  });
  await check("server timestamps and stable versions persist privately and retries are idempotent", async () => {
    await owner.call("acceptWebPolicies", { ...policy, uid: other.uid, acceptanceSource: "ios", termsAcceptedAt: "forged" });
    const before = (await setupRef(owner).get()).data();
    for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "age18ConfirmedAt"]) assert.ok(before[field] instanceof Timestamp);
    assert.equal(before.termsVersion, "1.0-draft"); assert.equal(before.privacyVersion, "1.0-draft"); assert.equal(before.acceptanceSource, "web");
    assert.equal((await setupRef(other).get()).exists, false);
    await owner.call("acceptWebPolicies", policy);
    const after = (await setupRef(owner).get()).data();
    assert.equal(before.termsAcceptedAt.toMillis(), after.termsAcceptedAt.toMillis());
    assert.equal((await owner.call("getAccountSetupStatus")).step, "profile");
  });
  await check("acceptance cannot be read or forged directly, even by the owner", async () => {
    for (const person of [owner, other, guest]) {
      await assert.rejects(() => getDoc(doc(person.firestore, "users", owner.uid, "private", "onboarding")), /permission/i);
      await assert.rejects(() => setDoc(doc(person.firestore, "users", owner.uid, "private", "onboarding"), policy), /permission/i);
    }
  });
  await check("display name is separate; avatar and area can be omitted", async () => {
    await assert.rejects(() => owner.call("completeFirstTimeProfile"), error => error.code === "functions/failed-precondition");
    await createProfileIfMissing(owner.firestore, owner.auth.currentUser);
    await updateDoc(doc(owner.firestore, "users", owner.uid), { displayName: "Chosen name", location: "", updatedAt: serverTimestamp() });
    await owner.call("completeFirstTimeProfile"); assert.equal((await owner.call("getAccountSetupStatus")).step, "welcome");
    await owner.call("finishAccountWelcome"); assert.equal((await owner.call("getAccountSetupStatus")).step, "ready");
    const profile = (await getDoc(doc(guest.firestore, "users", owner.uid))).data();
    assert.equal(profile.photoURL, null); assert.equal(profile.location, ""); assert.equal("termsVersion" in profile, false); assert.equal("email" in profile, false);
  });
  await check("returning email and Google users bypass setup across logout/login", async () => {
    await complete(google); await signOut(owner.auth); await signOut(google.auth);
    await signInWithEmailAndPassword(owner.auth, owner.email, owner.password); await signInWithCredential(google.auth, google.google);
    for (const person of [owner, google]) assert.equal((await person.call("getAccountSetupStatus")).step, "ready");
    assert.equal((await other.call("getAccountSetupStatus")).step, "acceptance");
  });
  await check("wrong passwords and duplicate email fail; six-character demo password is accepted", async () => {
    await assert.rejects(() => signInWithEmailAndPassword(guest.auth, owner.email, randomUUID()), /invalid|password/i);
    await assert.rejects(() => createUserWithEmailAndPassword(guest.auth, owner.email, randomUUID()), /already/i);
    const shortEmail = `short-${randomUUID()}@example.test`;
    await assert.rejects(() => createUserWithEmailAndPassword(guest.auth, shortEmail, randomUUID().slice(0, 5)), /weak/i);
    guest.email = shortEmail; guest.password = randomUUID().slice(0, 6);
    guest.uid = (await createUserWithEmailAndPassword(guest.auth, shortEmail, guest.password)).user.uid;
    await signOut(guest.auth); await signInWithEmailAndPassword(guest.auth, shortEmail, guest.password);
  });
  await check("password reset and deletion reauthentication remain local", async () => {
    await sendPasswordResetEmail(owner.auth, owner.email);
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
    assert.ok((await response.json()).oobCodes.some(code => code.email === owner.email && code.requestType === "PASSWORD_RESET"));
    await reauthenticateWithCredential(owner.auth.currentUser, EmailAuthProvider.credential(owner.email, owner.password));
    assert.equal((await owner.call("getAccountDeletionStatus")).state, "not_requested");
  });
  await check("pending deletion wins, cannot recreate a profile or acceptance, and stale deleted tokens fail", async () => {
    await db.doc(`accountLifecycles/${other.uid}`).set({ state: "deletion_pending", alias: `deleted-${randomUUID()}` });
    assert.equal((await other.call("getAccountSetupStatus")).step, "deletion");
    assert.equal(await createProfileIfMissing(other.firestore, other.auth.currentUser), false);
    for (const name of ["acceptWebPolicies", "completeFirstTimeProfile", "finishAccountWelcome"]) await assert.rejects(() => other.call(name, policy), error => error.code === "functions/failed-precondition");
    assert.equal((await setupRef(other).get()).exists, false);
    await getAdminAuth().deleteUser(other.uid);
    await assert.rejects(() => other.call("getAccountSetupStatus"), error => error.code === "functions/unauthenticated");
  });
  await check("real account deletion removes the private acceptance record and Auth identity", async () => {
    assert.equal((await setupRef(google).get()).exists, true);
    assert.equal((await google.call("requestAccountDeletion", { confirmation: "DELETE", policyVersion: "v1-2026-10-03", expectedOwnerUid: google.uid })).state, "completed");
    assert.equal((await setupRef(google).get()).exists, false);
    await assert.rejects(() => getAdminAuth().getUser(google.uid), { code: "auth/user-not-found" });
  });
  await check("an unavailable local Auth endpoint reports a network error without creating an account", async () => {
    const app = initializeApp({ projectId, apiKey: "demo-api-key" }, randomUUID());
    const offline = getAuth(app); connectAuthEmulator(offline, "http://127.0.0.1:19099", { disableWarnings: true });
    try { await assert.rejects(() => signInWithEmailAndPassword(offline, owner.email, owner.password), error => error.code === "auth/network-request-failed"); assert.equal(offline.currentUser, null); }
    finally { await deleteApp(app); }
  });
  console.log(`Auth onboarding emulator validation: ${passed} groups passed. No production access.`);
} finally {
  for (const person of clients) {
    if (person.uid) { await db.recursiveDelete(db.doc(`users/${person.uid}`)); await db.doc(`accountLifecycles/${person.uid}`).delete(); await db.doc(`accountDeletionOperations/${person.uid}`).delete(); await getAdminAuth().deleteUser(person.uid).catch(() => {}); }
    await signOut(person.auth).catch(() => {}); await deleteApp(person.app);
  }
  await deleteAdmin(admin);
}
