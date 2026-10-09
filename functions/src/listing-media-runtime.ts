import { randomUUID } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { marketplaceMutationCall, marketplaceCall, runGuardedTransaction } from "./account-lifecycle";
import { consumeActionCadence } from "./action-cadence";
import { runtimePolicyContext } from "./account-eligibility";
import { MAX_ACTIVE_UPLOAD_PERMITS, UPLOAD_PERMIT_TTL_MS } from "./upload-permit-domain";
import { mediaAdmission, mediaId, orderedReadyMedia, parseMediaInput, rawMediaPath } from "./listing-media-domain";


/** Disabled until the processor image, IAM, rules and staging integration are qualified. */
function enabled() { if (process.env.TAKEME_MEDIA_PIPELINE !== "v1" || !runtimePolicyContext()) throw new HttpsError("failed-precondition", "Photo processing is unavailable. Please try again later."); }
export const beginListingMedia = marketplaceMutationCall(async request => {
  const db = getFirestore();
  enabled(); const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to add photos.");
  let input; try { input = parseMediaInput(request.data); } catch (e) { throw new HttpsError("invalid-argument", (e as Error).message); }
  const ref = db.doc(`mediaOperations/${input.imageId}`), acceptance = db.doc(`users/${uid}/private/onboarding`);
  return runGuardedTransaction(db, async tx => {
    const [old, account] = await Promise.all([tx.get(ref), tx.get(acceptance)]), now = Timestamp.now();
    const existing = old.data();
    if (old.exists) {
      if (existing?.cleanupClaim || existing?.uid !== uid || existing.digest !== input.digest || existing.sizeBytes !== input.sizeBytes || existing.contentType !== input.contentType) throw new HttpsError("permission-denied", "This photo belongs to a different operation.");
      // Never reissue a permit after the raw upload has been consumed or processing failed.
      if (existing.status !== "UPLOADING") return { imageId: input.imageId, status: existing.status, path: existing.rawPath };
    }
    const previous = account.data()?.uploadPermits ?? {};
    if (!account.exists || typeof previous !== "object" || Array.isArray(previous) || Object.keys(previous).length > MAX_ACTIVE_UPLOAD_PERMITS) throw new HttpsError("failed-precondition", "Review your account before uploading.");
    const permits = Object.fromEntries(Object.entries(previous).filter(([, p]) => (p as { expiresAt?: unknown })?.expiresAt instanceof Timestamp && (p as { expiresAt: Timestamp }).expiresAt.toMillis() > now.toMillis()));
    if (existing && existing.permitExpiry instanceof Timestamp && existing.permitExpiry.toMillis() > now.toMillis() && permits[existing.permitId]) return { imageId: input.imageId, status: "UPLOADING", path: existing.rawPath, permitId: existing.permitId };
    if (Object.keys(permits).length >= MAX_ACTIVE_UPLOAD_PERMITS) throw new HttpsError("resource-exhausted", "Please wait before adding more photos.");
    const quotaRef=db.doc(`users/${uid}/private/mediaCadence`), quota=await tx.get(quotaRef);
    let events: number[];
    try { events=mediaAdmission(quota.data()?.events, now.toMillis()); }
    catch { throw new HttpsError("resource-exhausted", "Please wait before processing more photos."); }
    await consumeActionCadence(tx, uid, "upload", now);
    tx.set(quotaRef,{events,updatedAt:now});
    const permitId = randomUUID(), expiresAt = Timestamp.fromMillis(now.toMillis() + UPLOAD_PERMIT_TTL_MS), path = rawMediaPath(uid, input.imageId);
    permits[permitId] = { path, contentType: input.contentType, sizeBytes: input.sizeBytes, expiresAt };
    tx.update(acceptance, { uploadPermits: permits });
    if (!old.exists) tx.create(ref, { ...input, uid, rawPath: path, status: "UPLOADING", listingId: null, createdAt: now, updatedAt: now, permitId, permitExpiry: expiresAt, attempts: 0 });
    else tx.update(ref, { permitId, permitExpiry: expiresAt, updatedAt: now });
    return { imageId: input.imageId, status: "UPLOADING", path, permitId };
  });
});
/** Owner read; failed/paused processing can still be inspected without a protected write. */
export const getListingMedia = marketplaceCall(async request => {
  const uid = request.auth?.uid;
  if (!uid || !mediaId(request.data?.imageId)) throw new HttpsError("invalid-argument", "Choose a photo.");
  const op = (await getFirestore().doc(`mediaOperations/${request.data.imageId}`).get()).data();
  if (!op || op.uid !== uid) throw new HttpsError("not-found", "Photo not found.");
  return { imageId: request.data.imageId, status: op.status, ...(op.status === "READY" ? { media: orderedReadyMedia([request.data.imageId], { [request.data.imageId]: op }, uid)[0] } : {}) };
});

