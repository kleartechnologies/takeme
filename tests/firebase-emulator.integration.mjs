import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
async function client(label) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app), firestore = getFirestore(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, firestore, functions };
}
const owner = await client("rules-owner");
const other = await client("rules-other");
const input = { title: "A working camera kit", description: "A complete camera kit with charger and two working batteries.", categoryId: "electronics", condition: "Good", price: 250, listingType: "buy_now", publicLocation: { districtOrCity: "Kuala Lumpur", state: "W.P. Kuala Lumpur", country: "Malaysia" } };
const listingId = (await httpsCallable(owner.functions, "createFixedListingDraft")(input)).data.listingId;
const ownerRef = doc(owner.firestore, "listings", listingId);
await assert.rejects(() => updateDoc(doc(other.firestore, "listings", listingId), { title: "Unauthorized edit" }), /permission/i);
await assert.rejects(() => updateDoc(ownerRef, { title: "Direct owner edit" }), /permission/i);
await assert.rejects(() => setDoc(doc(owner.firestore, "listings", `fake-${suffix}`), { ...input, sellerId: owner.auth.currentUser.uid, status: "draft" }), /permission/i);
await Promise.all([deleteApp(owner.app), deleteApp(other.app)]);
console.log("Direct listing writes denied to owner and cross-seller clients; fixed-price callable creates the draft.");
