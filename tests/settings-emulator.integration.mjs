import { acceptDemoPolicies, permitDemoUpload } from "./helpers/demo-eligibility.mjs";
// Demo-only integration checks. Test credentials remain in memory and are never logged.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, linkWithCredential, sendPasswordResetEmail, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { createProfileIfMissing } from "../src/lib/firebase/profile-bootstrap.ts";

const projectId = "demo-takeme";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getStorage: getAdminStorage } = require("firebase-admin/storage");
const admin = initializeAdminApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
const db = getAdminFirestore();
const clients = [];
let passed = 0;
async function check(label, test) { await test(); passed++; console.log(`PASS ${passed}: ${label}`); }
async function client(label, signedIn = true) {
  const app = initializeApp({ apiKey: "demo-api-key", projectId, authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.firebasestorage.app`, appId: "demo-settings" }, randomUUID());
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  const email = `${label}-${randomUUID()}@example.test`;
  const person = { app, auth, firestore, storage, email, uid: null, call: async (name, data = {}) => (await httpsCallable(functions, name)(data)).data };
  clients.push(person);
  if (signedIn) {
    const user = (await createUserWithEmailAndPassword(auth, email, randomUUID() + "!Aa1")).user;
    await acceptDemoPolicies(app);
    person.uid = user.uid;
    await createProfileIfMissing(firestore, user, "Settings demo");
  }
  return person;
}
try {
  const owner = await client("settings-owner"), other = await client("settings-other"), guest = await client("settings-guest", false);
  const address = { uid: owner.uid, addressLine1: "Synthetic demo address", addressLine2: "", postcode: "06000", city: "Jitra", state: "Kedah", country: "Malaysia", updatedAt: serverTimestamp() };
  const ownAddress = doc(owner.firestore, "privateUserAddresses", owner.uid);
  await check("public profile saves only supported identity fields", async () => {
    await updateDoc(doc(owner.firestore, "users", owner.uid), { displayName: "Chosen demo name", location: "Jitra, Kedah", updatedAt: serverTimestamp() });
    const profile = (await getDoc(doc(other.firestore, "users", owner.uid))).data();
    assert.equal(profile.displayName, "Chosen demo name"); assert.equal(profile.location, "Jitra, Kedah");
    assert.equal("email" in profile, false); assert.equal("addressLine1" in profile, false);
    await assert.rejects(() => updateDoc(doc(other.firestore, "users", owner.uid), { displayName: "Hijacked" }), /permission/i);
    await assert.rejects(() => updateDoc(doc(owner.firestore, "users", owner.uid), { email: owner.email }), /permission/i);
  });
  await check("private address is owner-only and isolated from the public profile", async () => {
    await setDoc(ownAddress, address); assert.equal((await getDoc(ownAddress)).data().city, "Jitra");
    for (const person of [other, guest]) {
      await assert.rejects(() => getDoc(doc(person.firestore, "privateUserAddresses", owner.uid)), /permission/i);
      await assert.rejects(() => setDoc(doc(person.firestore, "privateUserAddresses", owner.uid), address), /permission/i);
    }
    assert.equal((await getDoc(doc(other.firestore, "privateUserAddresses", other.uid))).exists(), false);
    assert.equal("addressLine1" in (await getDoc(doc(guest.firestore, "users", owner.uid))).data(), false);
  });
  const first = doc(owner.firestore, "users", owner.uid, "meetupLocations", "first"), second = doc(owner.firestore, "users", owner.uid, "meetupLocations", "second");
  await check("meet-up CRUD and one default persist without changing privacy", async () => {
    const place = { ownerId: owner.uid, name: "Demo public place", area: "Jitra", state: "Kedah", country: "Malaysia", isDefault: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await setDoc(first, place); await setDoc(second, { ...place, name: "Second demo place" });
    await updateDoc(first, { name: "Edited public place", updatedAt: serverTimestamp() });
    const batch = writeBatch(owner.firestore); batch.update(first, { isDefault: false }); batch.update(second, { isDefault: true }); await batch.commit();
    assert.equal((await getDoc(first)).data().isDefault, false); assert.equal((await getDoc(second)).data().isDefault, true);
    for (const person of [other, guest]) await assert.rejects(() => getDoc(doc(person.firestore, "users", owner.uid, "meetupLocations", "first")), /permission/i);
    await assert.rejects(() => updateDoc(doc(other.firestore, "users", owner.uid, "meetupLocations", "first"), { name: "Hijacked" }), /permission/i);
    await deleteDoc(first); assert.equal((await getDoc(first)).exists(), false);
    assert.equal((await getDoc(ownAddress)).data().addressLine1, "Synthetic demo address");
  });
  await check("existing avatar path permits supported files and denies other owners", async () => {
    const bytes = await readFile(new URL("../public/brand/mascot-2d-happy.png", import.meta.url));
    const path = `users/${owner.uid}/profile/avatar`;
    await uploadBytes(ref(owner.storage, path), bytes, await permitDemoUpload(owner.app, path, "image/png", bytes.length));
    const photoURL = await getDownloadURL(ref(owner.storage, path));
    assert.equal(new URL(photoURL).hostname, "127.0.0.1");
    await updateDoc(doc(owner.firestore, "users", owner.uid), { photoURL, updatedAt: serverTimestamp() });
    assert.equal((await getDoc(doc(guest.firestore, "users", owner.uid))).data().photoURL, photoURL);
    await assert.rejects(() => uploadBytes(ref(other.storage, path), bytes, { contentType: "image/png" }), /unauthorized/i);
    await assert.rejects(() => uploadBytes(ref(owner.storage, path), bytes, { contentType: "text/plain" }), /unauthorized/i);
    await assert.rejects(() => uploadBytes(ref(owner.storage, path), new Uint8Array(8 * 1024 * 1024 + 1), { contentType: "image/png" }), /unauthorized/i);
  });
  const types = ["saved_price_drop", "saved_unavailable", "new_matching_listing", "followed_seller_listing", "auction_ending", "outbid", "auction_lost", "message_received"];
  await check("all eight optional notification categories persist through authenticated callables", async () => {
    for (const type of types) await owner.call("setNotificationPreference", { type, frequency: "off" });
    const preferences = (await owner.call("getNotificationPreferences")).preferences;
    for (const type of types) assert.equal(preferences[type], "off");
    await owner.call("setNotificationPreference", { type: "message_received", frequency: "instant" });
    assert.equal((await owner.call("getNotificationPreferences")).preferences.message_received, "instant");
  });
  await check("preferences use caller identity and deny direct reads/writes", async () => {
    assert.equal((await other.call("getNotificationPreferences")).preferences.saved_price_drop, "instant");
    await other.call("setNotificationPreference", { uid: owner.uid, type: "saved_price_drop", frequency: "instant" });
    assert.equal((await owner.call("getNotificationPreferences")).preferences.saved_price_drop, "off");
    for (const person of [owner, other, guest]) await assert.rejects(() => getDoc(doc(person.firestore, "notificationPreferences", owner.uid)), /permission/i);
    await assert.rejects(() => setDoc(doc(owner.firestore, "notificationPreferences", owner.uid), { saved_price_drop: "instant" }), /permission/i);
    await assert.rejects(() => guest.call("getNotificationPreferences"), /unauth|sign|log/i);
  });
  await check("essential alerts and unsupported delivery modes cannot be disabled or enabled", async () => {
    for (const type of ["offer_received", "transaction_update", "transaction_completed", "auction_won", "dispute_update"]) await assert.rejects(() => owner.call("setNotificationPreference", { type, frequency: "off" }), /invalid/i);
    for (const frequency of ["daily", "email", "push", "sms"]) await assert.rejects(() => owner.call("setNotificationPreference", { type: "message_received", frequency }), /invalid/i);
  });
  await check("Firebase connected providers reflect email/password and emulator Google", async () => {
    assert.deepEqual(owner.auth.currentUser.providerData.map(provider => provider.providerId), ["password"]);
    const issued = Math.floor(Date.now() / 1000);
    const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: "demo-client", sub: randomUUID(), email: owner.email, email_verified: true, iat: issued, exp: issued + 3600 })).toString("base64url")}.`;
    await linkWithCredential(owner.auth.currentUser, GoogleAuthProvider.credential(token));
    assert.deepEqual(new Set(owner.auth.currentUser.providerData.map(provider => provider.providerId)), new Set(["password", "google.com"]));
    assert.equal(other.auth.currentUser.providerData.some(provider => provider.providerId === "google.com"), false);
  });
  await check("password-reset requests stay inside the Auth emulator", async () => {
    await sendPasswordResetEmail(owner.auth, owner.email);
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
    assert.equal(response.ok, true);
    assert.ok((await response.json()).oobCodes.some(record => record.email === owner.email && record.requestType === "PASSWORD_RESET"));
  });
  await check("logout removes authenticated access to private settings data", async () => {
    await signOut(owner.auth);
    await assert.rejects(() => getDoc(ownAddress), /permission/i);
    await assert.rejects(() => owner.call("getNotificationPreferences"), /unauth|sign|log/i);
  });
  console.log(`Settings emulator validation: ${passed} groups passed; no production access.`);
} finally {
  for (const person of clients) if (person.uid) {
    for (const collection of ["users", "privateUserAddresses", "notificationPreferences", "accountLifecycles", "trustSummaries", "notificationSummaries", "sellerFollowSummaries"]) await db.recursiveDelete(db.doc(`${collection}/${person.uid}`));
    const bucket = getAdminStorage().bucket(); const [files] = await bucket.getFiles({ prefix: `users/${person.uid}/` }); for (const file of files) await file.delete({ ignoreNotFound: true });
    await getAdminAuth().deleteUser(person.uid).catch(error => { if (error.code !== "auth/user-not-found") throw error; });
  }
  await Promise.all(clients.map(person => deleteApp(person.app))); await deleteAdminApp(admin);
}
