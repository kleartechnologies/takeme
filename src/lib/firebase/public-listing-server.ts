import { getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import type { PublicListingMetadata } from "../listing-metadata";

const appName = "takeme-public-listing-metadata";
let emulatorConnected = false;

export async function getPublicListingForMetadata(id: string): Promise<PublicListingMetadata | null> {
  if (!id || id.includes("/")) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!projectId || !apiKey || !appId) return null;

  try {
    const app = getApps().find((item) => item.name === appName) ?? initializeApp({ projectId, apiKey, appId }, appName);
    const database = getFirestore(app);
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && !emulatorConnected) {
      connectFirestoreEmulator(database, "127.0.0.1", 8080);
      emulatorConnected = true;
    }
    // This unauthenticated Web SDK read obeys Firestore's public listing rule.
    const snapshot = await getDoc(doc(database, "listings", id));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (!["active", "ended", "sold"].includes(data.status)) return null;
    return {
      status: data.status,
      title: typeof data.title === "string" ? data.title : "",
      description: typeof data.description === "string" ? data.description : "",
      price: typeof data.price === "number" ? data.price : undefined,
      listingType: typeof data.listingType === "string" ? data.listingType : undefined,
      startingBid: typeof data.startingBid === "number" ? data.startingBid : undefined,
      currentBid: typeof data.currentBid === "number" ? data.currentBid : undefined,
      bidCount: typeof data.bidCount === "number" ? data.bidCount : undefined,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter((url: unknown): url is string => typeof url === "string") : [],
    };
  } catch {
    // Missing, private, and temporarily unavailable listings get neutral metadata.
    return null;
  }
}
