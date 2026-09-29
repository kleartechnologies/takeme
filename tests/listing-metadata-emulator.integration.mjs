import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp as deleteWebApp, getApps } from "firebase/app";
import { getFirestore as getWebFirestore, terminate } from "firebase/firestore";

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.GCLOUD_PROJECT !== "demo-takeme") {
  throw new Error("This test requires the local demo-takeme Firestore emulator.");
}

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-takeme";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456789:web:demo";
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";

const requireFromFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = requireFromFunctions("firebase-admin/app");
const { getFirestore } = requireFromFunctions("firebase-admin/firestore");
const { getPublicListingForMetadata } = await import("../src/lib/firebase/public-listing-server.ts");
const { buildListingMetadata } = await import("../src/lib/listing-metadata.ts");

const adminApp = initializeApp({ projectId: "demo-takeme" }, `metadata-test-${Date.now()}`);
const database = getFirestore(adminApp);
const suffix = Date.now();
const activeId = `metadata-active-${suffix}`;
const draftId = `metadata-draft-${suffix}`;

try {
  await database.doc(`listings/${activeId}`).set({
    status: "active", title: "Public camera", description: "A working camera",
    location: "Jitra, Kedah", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, privacyVersion: 2,
    listingType: "buy_now", price: 250, imageUrls: ["https://firebasestorage.googleapis.com/public-image"],
    sellerId: "private-seller-id", buyerId: "private-buyer-id", internalNotes: "private notes",
  });
  await database.doc(`listings/${draftId}`).set({ status: "draft", title: "Private draft", description: "Not public", listingType: "buy_now", price: 50 });

  const publicListing = await getPublicListingForMetadata(activeId);
  assert.equal(publicListing?.title, "Public camera");
  assert.ok(!JSON.stringify(publicListing).includes("private-seller-id"));
  assert.ok(!JSON.stringify(publicListing).includes("private-buyer-id"));
  assert.ok(!JSON.stringify(publicListing).includes("private notes"));
  assert.deepEqual(buildListingMetadata(activeId, publicListing, "https://takeme.my").title, { absolute: "Public camera — RM250 | TAKEME" });
  assert.equal(await getPublicListingForMetadata(draftId), null);
  assert.equal(await getPublicListingForMetadata(`missing-${suffix}`), null);
  console.log("Unauthenticated server metadata reads public listings, hides drafts and private fields.");
} finally {
  const metadataApp = getApps().find((app) => app.name === "takeme-public-listing-metadata");
  if (metadataApp) {
    await terminate(getWebFirestore(metadataApp));
    await deleteWebApp(metadataApp);
  }
  await deleteApp(adminApp);
}
