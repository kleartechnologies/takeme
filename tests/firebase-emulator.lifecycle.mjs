import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
const app = initializeApp({ apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" }, `lifecycle-${Date.now()}`);
const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
connectFunctionsEmulator(functions, "127.0.0.1", 5001);
await createUserWithEmailAndPassword(auth, `lifecycle-${Date.now()}@example.test`, createDemoPassword());
await acceptDemoPolicies(app);
const input = { title: "A working camera kit", description: "A complete camera kit with charger and two working batteries.", categoryId: "electronics", condition: "Good", price: 250, listingType: "buy_now", publicLocation: { districtOrCity: "Kuala Lumpur", state: "W.P. Kuala Lumpur", country: "Malaysia" } };
const listingId = (await httpsCallable(functions, "createFixedListingDraft")(input)).data.listingId;
const listingRef = doc(firestore, "listings", listingId);

await httpsCallable(functions, "removeFixedListing")({ listingId });
const ownerView = await getDoc(listingRef);
assert.equal(ownerView.data()?.status, "removed", "Owner should be able to read the deactivated listing.");

let reactivationDenied = false;
try {
  await updateDoc(listingRef, { status: "active" });
} catch (error) {
  reactivationDenied = String(error?.code).includes("permission-denied");
}
assert.equal(reactivationDenied, true, "Removed listings must not be reactivated through direct writes.");
await assert.rejects(() => httpsCallable(functions, "publishFixedListing")({ listingId, imageUrls: [] }), /image|invalid|cannot be published/i);
await signOut(auth);

let publicReadDenied = false;
try {
  await getDoc(listingRef);
} catch (error) {
  publicReadDenied = String(error?.code).includes("permission-denied");
}
assert.equal(publicReadDenied, true, "Removed listings must not be publicly readable.");
await deleteApp(app);
console.log("Deactivation, owner history access, no-reactivation, and public hiding verified.");
