import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, updateDoc } from "firebase/firestore";

const listingId = process.env.TEST_LISTING_ID;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
assert.ok(listingId && email && password, "TEST_LISTING_ID, TEST_USER_EMAIL, and TEST_USER_PASSWORD are required.");

const app = initializeApp({ apiKey: "demo-api-key", authDomain: "demo-takeme.firebaseapp.com", projectId: "demo-takeme", storageBucket: "demo-takeme.firebasestorage.app", appId: "1:123456789:web:demo" }, `rules-${Date.now()}`);
const auth = getAuth(app);
const firestore = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
await signInWithEmailAndPassword(auth, email, password);

let denied = false;
try {
  await updateDoc(doc(firestore, "listings", listingId), { title: "Unauthorized title change" });
} catch (error) {
  denied = String(error?.code).includes("permission-denied");
}
assert.equal(denied, true, "A different seller must not be able to update the listing.");
await signOut(auth);
console.log("Cross-seller Firestore update correctly denied.");
