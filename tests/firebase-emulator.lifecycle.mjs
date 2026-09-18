import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, updateDoc } from "firebase/firestore";

const listingId = process.env.TEST_LISTING_ID;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
assert.ok(listingId && email && password, "TEST_LISTING_ID, TEST_USER_EMAIL, and TEST_USER_PASSWORD are required.");

const app = initializeApp({ apiKey: "demo-api-key", authDomain: "demo-takeme.firebaseapp.com", projectId: "demo-takeme", storageBucket: "demo-takeme.firebasestorage.app", appId: "1:123456789:web:demo" }, `lifecycle-${Date.now()}`);
const auth = getAuth(app);
const firestore = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
await signInWithEmailAndPassword(auth, email, password);
const listingRef = doc(firestore, "listings", listingId);

await updateDoc(listingRef, { status: "removed", updatedAt: serverTimestamp() });
const ownerView = await getDoc(listingRef);
assert.equal(ownerView.data()?.status, "removed", "Owner should be able to read the deactivated listing.");

let reactivationDenied = false;
try {
  await updateDoc(listingRef, { status: "active", updatedAt: serverTimestamp() });
} catch (error) {
  reactivationDenied = String(error?.code).includes("permission-denied");
}
assert.equal(reactivationDenied, true, "Removed listings must not be reactivated in Phase 2.");
await signOut(auth);

let publicReadDenied = false;
try {
  await getDoc(listingRef);
} catch (error) {
  publicReadDenied = String(error?.code).includes("permission-denied");
}
assert.equal(publicReadDenied, true, "Removed listings must not be publicly readable.");
console.log("Deactivation, owner history access, no-reactivation, and public hiding verified.");
