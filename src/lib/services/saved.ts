import { withEligibilityHandling } from "@/lib/services/marketplace-call";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { getPublicListingDetail } from "@/lib/services/listings";
import type { SavedListing } from "@/types/marketplace";
import { announceSavedChange } from "@/lib/marketplace-state-events";
import { protectedWriteMaintenanceMessage } from "@/lib/protected-write-maintenance";

export interface SavedPage {
  items: SavedListing[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function requireSavedServices() {
  if (!db || !auth?.currentUser) throw new Error("Sign in to manage saved listings.");
  return { database: db, uid: auth.currentUser.uid };
}

function savedRef(uid: string, listingId: string) {
  return doc(db!, "users", uid, "saved", listingId);
}

export async function isListingSaved(listingId: string) {
  const { uid } = requireSavedServices();
  return (await getDoc(savedRef(uid, listingId))).exists();
}

export async function saveListing(listingId: string) {
  const { uid } = requireSavedServices();
  const reference = savedRef(uid, listingId);
  try {
    await withEligibilityHandling(() => setDoc(reference, { listingId, savedAt: serverTimestamp() }));
    announceSavedChange({ uid, listingId, saved: true });
    return true;
  } catch (error) {
    if (protectedWriteMaintenanceMessage(error)) throw error;
    // Existing documents are immutable. A repeated tap is therefore a no-op,
    // while a missing/removed listing or genuine rules error still surfaces.
    if ((await getDoc(reference)).exists()) { announceSavedChange({ uid, listingId, saved: true }); return false; }
    throw error;
  }
}

export async function removeSavedListing(listingId: string) {
  const { uid } = requireSavedServices();
  await withEligibilityHandling(() => deleteDoc(savedRef(uid, listingId)));
  announceSavedChange({ uid, listingId, saved: false });
}

export async function getSavedPage(cursor?: QueryDocumentSnapshot<DocumentData> | null, requestedPageSize = 10): Promise<SavedPage> {
  const { database, uid } = requireSavedServices();
  const pageSize = Math.min(Math.max(requestedPageSize, 1), 12);
  const constraints = [orderBy("savedAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize + 1)];
  const snapshot = await getDocs(query(collection(database, "users", uid, "saved"), ...constraints));
  const visible = snapshot.docs.slice(0, pageSize);
  const items = await Promise.all(visible.map(async (saved): Promise<SavedListing> => {
    let listing: SavedListing["listing"] = null;
    try {
      const result = await getPublicListingDetail(saved.id);
      if (["active", "ended", "sold"].includes(result.listing.status)) listing = result.listing;
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && (String(error.code).includes("permission-denied") || String(error.code).includes("not-found")))) throw error;
      // The owner may have removed a listing after it was saved. Keep its saved
      // record visible so the buyer can remove it without exposing the listing.
    }
    const savedAt = saved.data().savedAt;
    return { listingId: saved.id, savedAt: savedAt instanceof Timestamp ? savedAt.toDate().toISOString() : "", listing };
  }));
  return { items, cursor: visible.at(-1) ?? null, hasMore: snapshot.size > pageSize };
}
