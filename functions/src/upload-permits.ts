import { randomUUID } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { marketplaceMutationCall, runGuardedTransaction } from "./account-lifecycle";
import { consumeActionCadence } from "./action-cadence";
import { CADENCE_MESSAGE } from "./action-cadence-policy";
import { MAX_ACTIVE_UPLOAD_PERMITS, UPLOAD_PERMIT_TTL_MS, mayUploadListing, parseUploadRequests } from "./upload-permit-domain";

const db = getFirestore();
/** Exact paths and sizes, owner authentication, short expiry and create-only Storage rules. */
export const requestUploadPermits = marketplaceMutationCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to upload photos.");
  let uploads;
  try { uploads = parseUploadRequests(uid, request.data?.uploads); }
  catch (error) { throw new HttpsError("invalid-argument", (error as Error).message); }
  const acceptanceRef = db.doc(`users/${uid}/private/onboarding`);
  return runGuardedTransaction(db, async (tx) => {
    const now = Timestamp.now();
    const acceptance = await tx.get(acceptanceRef);
    if (!acceptance.exists) throw new HttpsError("failed-precondition", "Confirm your current account eligibility before uploading.");
    const listingIds = [...new Set(uploads.flatMap((upload) => upload.listingId ? [upload.listingId] : []))];
    const listings = await Promise.all(listingIds.map((id) => tx.get(db.doc(`listings/${id}`))));
    for (const listing of listings) {
      const data = listing.data();
      if (!mayUploadListing(data ? { ...data, auctionStartAt: data.auctionStartAt instanceof Timestamp ? data.auctionStartAt.toMillis() : null } : undefined, uid, now.toMillis())) {
        throw new HttpsError("permission-denied", "Photos can only be uploaded to your own editable listing.");
      }
    }
    const previous = acceptance.data()?.uploadPermits;
    if (previous !== undefined && (!previous || typeof previous !== "object" || Array.isArray(previous) || Object.keys(previous).length > MAX_ACTIVE_UPLOAD_PERMITS)) {
      throw new HttpsError("resource-exhausted", CADENCE_MESSAGE, { reason: "cadence-limit", retryAfterMs: UPLOAD_PERMIT_TTL_MS });
    }
    const permits: Record<string, { path: string; contentType: string; sizeBytes: number; expiresAt: Timestamp }> = {};
    for (const [key, value] of Object.entries(previous ?? {})) {
      const permit = value as { path?: unknown; contentType?: unknown; sizeBytes?: unknown; expiresAt?: unknown };
      if (permit?.expiresAt instanceof Timestamp && permit.expiresAt.toMillis() > now.toMillis()) {
        permits[key] = permit as typeof permits[string];
      }
    }
    if (Object.keys(permits).length + uploads.length > MAX_ACTIVE_UPLOAD_PERMITS) {
      throw new HttpsError("resource-exhausted", CADENCE_MESSAGE, { reason: "cadence-limit", retryAfterMs: UPLOAD_PERMIT_TTL_MS });
    }
    const expiresAt = Timestamp.fromMillis(now.toMillis() + UPLOAD_PERMIT_TTL_MS);
    const issued = uploads.map((upload) => {
      const permitId = randomUUID();
      permits[permitId] = { path: upload.path, contentType: upload.contentType, sizeBytes: upload.sizeBytes, expiresAt };
      return { path: upload.path, permitId, expiresAt: expiresAt.toDate().toISOString() };
    });
    await consumeActionCadence(tx, uid, "upload", now, { amount: uploads.length });
    tx.update(acceptanceRef, { uploadPermits: permits });
    return { permits: issued };
  });
});
