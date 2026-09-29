import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme-location";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:18080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:19099";
process.env.GCLOUD_PROJECT = projectId;
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions("firebase-admin/app");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
initializeAdminApp({ projectId });
const admin = getAdminFirestore();
const suffix = String(Date.now());
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, appId: "1:123456789:web:demo" };

async function client(label, authenticated = true) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app), db = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:19099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 18080);
  connectFunctionsEmulator(functions, "127.0.0.1", 15001);
  if (authenticated) await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, db, functions, uid: auth.currentUser?.uid };
}

const [seller, other, guest] = await Promise.all([client("seller"), client("other"), client("guest", false)]);
try {
  const privateRef = doc(seller.db, "privateUserAddresses", seller.uid);
  await setDoc(privateRef, { uid: seller.uid, addressLine1: "Private residential address", addressLine2: "", postcode: "06000", city: "Jitra", state: "Kedah", country: "Malaysia", updatedAt: serverTimestamp() });
  assert.equal((await getDoc(privateRef)).data()?.addressLine1, "Private residential address");
  await assert.rejects(() => getDoc(doc(other.db, "privateUserAddresses", seller.uid)), /permission/i);
  await assert.rejects(() => getDoc(doc(guest.db, "privateUserAddresses", seller.uid)), /permission/i);

  const meetupId = `place-${suffix}`;
  const meetupRef = doc(seller.db, "users", seller.uid, "meetupLocations", meetupId);
  await setDoc(meetupRef, { ownerId: seller.uid, name: "Seller-chosen café", area: "Jitra", state: "Kedah", country: "Malaysia", isDefault: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await updateDoc(meetupRef, { isDefault: true, updatedAt: serverTimestamp() });
  assert.equal((await getDoc(meetupRef)).data()?.isDefault, true);
  await assert.rejects(() => getDoc(doc(other.db, "users", seller.uid, "meetupLocations", meetupId)), /permission/i);
  await assert.rejects(() => updateDoc(doc(other.db, "users", seller.uid, "meetupLocations", meetupId), { name: "Hijacked" }), /permission/i);

  const safeId = `safe-${suffix}`, unsafeId = `unsafe-${suffix}`, legacyId = `legacy-${suffix}`;
  const publicLocation = { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" };
  const base = { sellerId: seller.uid, status: "active", publicLocation, location: "Jitra, Kedah", privacyVersion: 2, title: "Safe camera kit", description: "A complete working camera kit with charger.", categoryId: "electronics", condition: "Good", listingType: "buy_now", price: 100, imageUrls: [], facetKeys: ["*|*|*|*"], searchTokens: ["sa"], createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  await admin.doc(`listings/${safeId}`).set(base);
  await admin.doc(`listings/${unsafeId}`).set({ ...base, createdAt: Timestamp.fromMillis(base.createdAt.toMillis() + 1000), address: "No 40 Jalan Example", coordinates: { latitude: 6.27, longitude: 100.43 }, preciseLocation: "Private residence" });
  await admin.doc(`listings/${legacyId}`).set({ ...base, privacyVersion: 1, location: "Private residential address", latitude: 6.27 });
  const publicDocument = (await getDoc(doc(guest.db, "listings", safeId))).data();
  assert.equal(publicDocument.location, "Jitra, Kedah");
  assert.equal(JSON.stringify(publicDocument).includes("Private residential address"), false);
  await assert.rejects(() => getDoc(doc(guest.db, "listings", unsafeId)), /permission/i);
  await assert.rejects(() => getDoc(doc(guest.db, "listings", legacyId)), /permission/i);
  // This is the actual public browse query shape. Firestore cannot prove the
  // absence of forbidden fields, so direct collection listing is denied.
  await assert.rejects(() => getDocs(query(collection(guest.db, "listings"), where("status", "==", "active"), where("privacyVersion", "==", 2), where("facetKeys", "array-contains", "*|*|*|*"), orderBy("createdAt", "desc"), limit(10))), /permission/i);
  await assert.rejects(() => getDocs(query(collection(seller.db, "listings"), where("sellerId", "==", seller.uid), orderBy("createdAt", "desc"), limit(10))), /permission/i);
  const ownerListings = (await httpsCallable(seller.functions, "getMyListingHistory")({})).data;
  assert.deepEqual(new Set(ownerListings.listings.map((item) => item.id)), new Set([safeId, unsafeId, legacyId]));
  const publicPage = (await httpsCallable(guest.functions, "getPublicListingPage")({ filters: { pageSize: 10 }, cursor: null })).data;
  assert.deepEqual(publicPage.listings.map((item) => item.id), [safeId]);
  assert.equal(publicPage.listings[0].location, "Jitra, Kedah");
  assert.equal(JSON.stringify(publicPage).includes("No 40 Jalan Example"), false);
  assert.equal(JSON.stringify(publicPage).includes("Private residence"), false);
  const smallPage = (await httpsCallable(guest.functions, "getPublicListingPage")({ filters: { pageSize: 1 }, cursor: null })).data;
  assert.deepEqual(smallPage.listings.map((item) => item.id), [safeId], "An unsafe first candidate must not starve a safe later listing.");
  const sellerPage = (await httpsCallable(guest.functions, "getPublicListingPage")({ filters: { sellerId: seller.uid, pageSize: 10 }, cursor: null })).data;
  assert.deepEqual(sellerPage.listings.map((item) => item.id), [safeId]);
  await assert.rejects(() => setDoc(doc(other.db, "listings", `injected-${suffix}`), { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), address: "private" }), /permission/i);

  await deleteDoc(meetupRef);
  assert.equal((await getDoc(meetupRef)).exists(), false);
  console.log("Location privacy emulator checks passed: direct public list denied; safe callable projection excludes unsafe version-2 and legacy documents.");
} finally {
  await Promise.all([deleteApp(seller.app), deleteApp(other.app), deleteApp(guest.app)]);
}
