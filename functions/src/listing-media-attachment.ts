import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { runtimePolicyContext } from "./account-eligibility";
import { mediaId, orderedReadyMedia, storageMediaUrl, listingMediaBucket } from "./listing-media-domain";

/** Attaches only server-created derivatives, in the listing transaction. Legacy URLs are still accepted separately. */
export async function attachListingMedia(tx: Transaction, uid: string, listingId: string, urls: string[]) {
  const db = getFirestore();
  const context = runtimePolicyContext();
  if (!context) throw new HttpsError("failed-precondition", "Photo configuration is unavailable.");
  const bucket = listingMediaBucket(context.projectId), ids: string[] = [];
  for (const url of urls) {
    const parsed = new URL(url); let path: string;
    try { path = decodeURIComponent(parsed.pathname.split("/o/")[1] ?? ""); } catch { throw new HttpsError("invalid-argument", "Invalid photo."); }
    if (!path.startsWith(`users/${uid}/listing-media/`)) continue;
    const id = path.split("/")[3]; if (!mediaId(id) || parsed.origin !== "https://firebasestorage.googleapis.com" || url !== storageMediaUrl(bucket, path)) throw new HttpsError("invalid-argument", "Invalid photo.");
    ids.push(id);
  }
  if (!ids.length) return [];
  const snapshots = await Promise.all(ids.map(id => tx.get(db.doc(`mediaOperations/${id}`))));
  const operations = Object.fromEntries(snapshots.map(s => [s.id, s.data()]));
  for (const s of snapshots) if (s.data()?.uid !== uid || s.data()?.listingId && s.data()?.listingId !== listingId) throw new HttpsError("permission-denied", "This photo belongs to another listing.");
  let media; try { media = orderedReadyMedia(ids, operations, uid); } catch (e) { throw new HttpsError("failed-precondition", (e as Error).message); }
  if (media.some(m => !urls.includes(storageMediaUrl(bucket, m.detailPath)))) throw new HttpsError("invalid-argument", "Use the ready listing photo.");
  // All transaction reads must precede writes. Caller invokes this after its own reads.
  for (const s of snapshots) tx.update(s.ref, { listingId, updatedAt: Timestamp.now() });
  return media.map(m => ({ ...m, coverOrder: urls.indexOf(storageMediaUrl(bucket, m.detailPath)) }));
}
