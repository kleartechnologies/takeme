import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
requireFunctions("./lib/index.js");
const { getFirestore: getAdminFirestore } = requireFunctions("firebase-admin/firestore");
const admin = getAdminFirestore();
const suffix = String(Date.now());
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, appId: "1:123456789:web:demo" };

async function client(label) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app), db = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword());
  await acceptDemoPolicies(app);
  return { app, auth, db, functions, uid: auth.currentUser.uid };
}

const [seller, other] = await Promise.all([client("seller"), client("other")]);
const call = (person, name, data) => httpsCallable(person.functions, name)(data).then((result) => result.data);
try {
  const meetupId = `place-${suffix}`;
  await setDoc(doc(seller.db, "users", seller.uid, "meetupLocations", meetupId), { ownerId: seller.uid, name: "Seller-selected café", area: "Jitra", state: "Kedah", country: "Malaysia", isDefault: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const publicLocation = { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" };
  const fixed = { title: "Working camera kit", description: "A complete camera kit with charger and batteries.", categoryId: "electronics", condition: "Good", price: 250, listingType: "buy_now", publicLocation, meetupLocationId: meetupId };
  await assert.rejects(() => call(other, "createFixedListingDraft", fixed), /own|meet-up|permission/i);
  await assert.rejects(() => call(seller, "createFixedListingDraft", { ...fixed, location: "No 40 Jalan Halban" }), /invalid/i);
  await assert.rejects(() => call(seller, "createFixedListingDraft", { ...fixed, latitude: 6.27 }), /invalid/i);
  await assert.rejects(() => call(seller, "createFixedListingDraft", { ...fixed, publicLocation: { ...publicLocation, districtOrCity: "No 40 Jalan Halban" } }), /general location/i);
  const fixedId = (await call(seller, "createFixedListingDraft", fixed)).listingId;
  const savedFixed = (await admin.doc(`listings/${fixedId}`).get()).data();
  assert.deepEqual(savedFixed.publicLocation, publicLocation);
  assert.equal(savedFixed.location, "Jitra, Kedah");
  assert.equal(savedFixed.privacyVersion, 2);
  assert.equal(savedFixed.meetupLocation.name, "Seller-selected café");
  for (const field of ["latitude", "longitude", "fullAddress", "privateAddress"]) assert.equal(field in savedFixed, false);

  const start = new Date(Date.now() + 10 * 60_000);
  const auction = { title: "Vintage camera auction", description: "A vintage camera kit with a lens and protective case.", categoryId: "electronics", condition: "Good", listingType: "auction", publicLocation, startingBid: 10000, minimumBidIncrement: 1000, auctionStartAt: start.toISOString(), auctionEndAt: new Date(start.getTime() + 60 * 60_000).toISOString() };
  const auctionId = (await call(seller, "createAuctionListing", auction)).listingId;
  const savedAuction = (await admin.doc(`listings/${auctionId}`).get()).data();
  assert.deepEqual(savedAuction.publicLocation, publicLocation);
  assert.equal(savedAuction.location, "Jitra, Kedah");
  assert.equal(savedAuction.privacyVersion, 2);
  console.log("Location callables emulator checks passed: seller-owned meet-up, safe fixed and auction drafts, malicious fields rejected.");
} finally {
  await Promise.all([deleteApp(seller.app), deleteApp(other.app)]);
}
