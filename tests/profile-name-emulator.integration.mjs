import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { newPublicProfileFields } from "../src/lib/firebase/profile-name.ts";

const projectId = "demo-takeme";
const app = initializeApp({ apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, appId: "1:123456789:web:demo" }, `profile-name-${Date.now()}`);
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "127.0.0.1", 8080);

try {
  const credential = await createUserWithEmailAndPassword(auth, `provider-profile-${Date.now()}@example.test`, "TestPass123!");
  const profileRef = doc(db, "users", credential.user.uid);
  await setDoc(profileRef, {
    ...newPublicProfileFields({ uid: credential.user.uid, displayName: " X ", photoURL: null }),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  assert.equal((await getDoc(profileRef)).data()?.displayName, "TAKEME member");
  await assert.rejects(() => updateDoc(profileRef, { displayName: "X" }), /permission/i);
  const longName = await createUserWithEmailAndPassword(auth, `long-provider-profile-${Date.now()}@example.test`, "TestPass123!");
  const longRef = doc(db, "users", longName.user.uid);
  await setDoc(longRef, {
    ...newPublicProfileFields({ uid: longName.user.uid, displayName: "A".repeat(81), photoURL: null }),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  assert.equal((await getDoc(longRef)).data()?.displayName, "A".repeat(80));
  console.log("Fallback and truncated provider profiles accepted; one-character profile update denied by hardened rules.");
} finally {
  await deleteApp(app);
}
