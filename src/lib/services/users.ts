import { Timestamp, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/marketplace";
import { formatPublicLocation, parseLegacyGeneralLocation } from "@/lib/general-location";

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error("Firebase is not configured. Add the required environment variables first.");
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { uid: snapshot.id, displayName: data.displayName || "TAKEME member", photoURL: data.photoURL || null, location: data.location || "", createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
}

export async function updatePublicProfile(input: { displayName: string; location: string; photo?: File | null }): Promise<UserProfile> {
  if (!db || !auth?.currentUser) throw new Error("Sign in to edit your profile.");
  const uid = auth.currentUser.uid;
  const displayName = input.displayName.trim();
  const normalizedLocation = input.location.trim() ? parseLegacyGeneralLocation(input.location) : null;
  if (input.location.trim() && !normalizedLocation) throw new Error("Choose a district or city and Malaysian state, not a street address.");
  const location = normalizedLocation ? formatPublicLocation(normalizedLocation) : "";
  if (displayName.length < 2 || displayName.length > 80) throw new Error("Display name must be 2–80 characters.");
  if (input.photo && (!storage || !["image/jpeg", "image/png", "image/webp"].includes(input.photo.type) || input.photo.size > 8 * 1024 * 1024)) throw new Error("Choose a JPG, PNG or WebP photo under 8 MB.");
  const update: { displayName: string; location: string; photoURL?: string; updatedAt: ReturnType<typeof serverTimestamp> } = { displayName, location, updatedAt: serverTimestamp() };
  if (input.photo) {
    const photoRef = ref(storage!, `users/${uid}/profile/avatar`);
    await uploadBytes(photoRef, input.photo, { contentType: input.photo.type });
    update.photoURL = await getDownloadURL(photoRef);
  }
  await updateDoc(doc(db, "users", uid), update);
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error("Profile could not be loaded after saving.");
  return profile;
}
