import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import { createProfileIfMissing } from "../src/lib/firebase/profile-bootstrap.ts";

const projectId = "demo-takeme";
const app = initializeApp({ apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, appId: "1:123456789:web:demo" }, `google-profile-${Date.now()}`);
const auth = getAuth(app);
const database = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(database, "127.0.0.1", 8080);

try {
  const credential = await createUserWithEmailAndPassword(auth, `google-profile-${Date.now()}@example.test`, "TestPass123!");
  const user = { uid: credential.user.uid, displayName: "  Aisha  ", photoURL: null };
  const reference = doc(database, "users", user.uid);
  assert.equal(await createProfileIfMissing(database, user), true);
  assert.equal((await getDoc(reference)).data()?.displayName, "Aisha");

  await updateDoc(reference, { displayName: "Chosen TAKEME Name" });
  assert.equal(await createProfileIfMissing(database, { ...user, displayName: "Different Google Name" }), false);
  assert.equal((await getDoc(reference)).data()?.displayName, "Chosen TAKEME Name");

  const second = await createUserWithEmailAndPassword(auth, `google-short-${Date.now()}@example.test`, "TestPass123!");
  assert.equal(await createProfileIfMissing(database, { uid: second.user.uid, displayName: "X", photoURL: null }), true);
  assert.equal((await getDoc(doc(database, "users", second.user.uid))).data()?.displayName, "TAKEME member");
  console.log("New and existing provider profiles obey hardened rules; existing TAKEME name stays unchanged.");
} finally {
  await deleteApp(app);
}
