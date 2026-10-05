import { acceptDemoPolicies, permitDemoUpload, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-takeme";
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFunctions("firebase-admin/app");
const { getStorage: getAdminStorage } = requireFunctions("firebase-admin/storage");
const adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` }, `removal-${Date.now()}`);
const bucket = getAdminStorage(adminApp).bucket();
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
const suffix = Date.now();

async function client(label, authenticated = true) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1"), storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  if (authenticated) { await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword()); await acceptDemoPolicies(app); }
  return { app, auth, firestore, functions, storage, uid: auth.currentUser?.uid };
}

const [seller, other, guest] = await Promise.all([client("removal-seller"), client("removal-other"), client("removal-guest", false)]);
const call = (user, name, data) => httpsCallable(user.functions, name)(data).then((result) => result.data);
const input = { title: "Fixed-price removal test", description: "A complete test item with two associated images.", categoryId: "electronics", condition: "Good", price: 29.9, listingType: "buy_now", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" } };
const fixture = readFileSync(new URL("../public/brand/takeme-app-icon.png", import.meta.url));

async function upload(user, listingId, name) {
  const path = `users/${user.uid}/listings/${listingId}/${name}`;
  const object = ref(user.storage, path);
  await uploadBytes(object, fixture, await permitDemoUpload(user.app, path, "image/png", fixture.length, user.functions));
  return { path, url: await getDownloadURL(object) };
}

try {
  const listingId = (await call(seller, "createFixedListingDraft", input)).listingId;
  const otherId = (await call(other, "createFixedListingDraft", input)).listingId;
  const first = await upload(seller, listingId, "first.png");
  const missing = await upload(seller, listingId, "missing.png");
  const foreign = await upload(other, otherId, "foreign.png");
  await call(seller, "publishFixedListing", { listingId, imageUrls: [first.url, missing.url] });

  await assert.rejects(() => call(guest, "removeFixedListing", { listingId }), /sign in|unauthenticated/i);
  await assert.rejects(() => call(other, "removeFixedListing", { listingId }), /yours|permission/i);
  assert.equal((await bucket.file(first.path).exists())[0], true, "failed cross-seller removal must not delete media");

  await deleteObject(ref(seller.storage, missing.path));
  await call(seller, "removeFixedListing", { listingId });
  assert.equal((await getDoc(doc(seller.firestore, "listings", listingId))).data()?.status, "removed");
  assert.equal((await bucket.file(first.path).exists())[0], false, "associated media is deleted server-side");
  assert.equal((await bucket.file(missing.path).exists())[0], false, "already-missing media stays harmless");
  assert.equal((await bucket.file(foreign.path).exists())[0], true, "another seller's media is untouched");

  await call(seller, "removeFixedListing", { listingId });
  const emptyId = (await call(seller, "createFixedListingDraft", input)).listingId;
  await call(seller, "removeFixedListing", { listingId: emptyId });
  assert.equal((await getDoc(doc(seller.firestore, "listings", emptyId))).data()?.status, "removed", "media-free draft removal still succeeds");
} finally {
  await Promise.all([deleteApp(seller.app), deleteApp(other.app), deleteApp(guest.app), deleteAdminApp(adminApp)]);
}

console.log("Authenticated fixed-price removal, scoped media cleanup, missing media, retry, and cross-seller protections verified.");
