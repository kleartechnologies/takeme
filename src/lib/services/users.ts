import { withEligibilityHandling } from "@/lib/services/marketplace-call";
import { Timestamp, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { photoUploadMetadata } from "@/lib/services/upload-permits";
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
  const uid = auth.currentUser.uid, database = db;
  const displayName = input.displayName.trim();
  const normalizedLocation = input.location.trim() ? parseLegacyGeneralLocation(input.location) : null;
  if (input.location.trim() && !normalizedLocation) throw new Error("Choose a district or city and Malaysian state, not a street address.");
  const location = normalizedLocation ? formatPublicLocation(normalizedLocation) : "";
  if (displayName.length < 2 || displayName.length > 80) throw new Error("Display name must be 2–80 characters.");
  if (input.photo && (!storage || !["image/jpeg", "image/png", "image/webp"].includes(input.photo.type) || input.photo.size < 1 || input.photo.size > 8 * 1024 * 1024)) throw new Error("Choose a JPG, PNG or WebP photo under 8 MB.");
  const update: { displayName: string; location: string; photoURL?: string; updatedAt: ReturnType<typeof serverTimestamp> } = { displayName, location, updatedAt: serverTimestamp() };
  const photo = input.photo;
  let uploadedPhoto: ReturnType<typeof ref> | undefined;
  let previousPhotoURL: string | null = null;
  if (photo) {
    previousPhotoURL = (await getUserProfile(uid))?.photoURL ?? null;
    const photoRef = ref(storage!, `users/${uid}/profile/${crypto.randomUUID()}`);
    const metadata = await photoUploadMetadata(photoRef.fullPath, photo.type, photo.size);
    await withEligibilityHandling(() => uploadBytes(photoRef, photo, metadata));
    uploadedPhoto = photoRef;
    try { update.photoURL = await getDownloadURL(photoRef); }
    catch (error) { await deleteObject(photoRef).catch(() => undefined); throw error; }
  }
  try { await withEligibilityHandling(() => updateDoc(doc(database, "users", uid), update)); }
  catch (error) { if (uploadedPhoto) await deleteObject(uploadedPhoto).catch(() => undefined); throw error; }
  if (uploadedPhoto && previousPhotoURL) {
    try {
      const previous = ref(storage!, previousPhotoURL);
      if (previous.bucket === uploadedPhoto.bucket && previous.fullPath.startsWith(`users/${uid}/profile/`) && previous.fullPath !== uploadedPhoto.fullPath) {
        await deleteObject(previous).catch(() => undefined);
      }
    } catch { /* External provider photos are not TAKEME Storage objects. */ }
  }
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error("Profile could not be loaded after saving.");
  return profile;
}
