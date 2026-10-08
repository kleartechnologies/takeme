import { getApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminIdentity } from "./admin-auth";
import { approvedFixtureRequest, fixtureMatches, fixtureRuntimeMatches, approvedMediaMetadata,
  SYNTHETIC_FIXTURE as fixture, SYNTHETIC_AUDIT_ID, SYNTHETIC_MEDIA_PREFIX } from "./synthetic-fixture-domain";

function stop(message: string): never { throw new HttpsError("failed-precondition", message); }

function auditMatches(data: DocumentData | undefined): boolean {
  return !!data && data.action === "synthetic_fixture_cleanup" && data.resourceType === "listing"
    && data.resourceId === fixture.listingId && typeof data.adminUid === "string"
    && data.summary?.reason === fixture.reason && data.summary?.historicalReferencesPreserved === true;
}

/** One approved operational withdrawal. No owner consent, arbitrary IDs or history erasure. */
export const cleanupApprovedSyntheticFixture = onCall(async (request) => {
  const admin = await verifyAdminIdentity(request);
  if (!approvedFixtureRequest(request.data)) throw new HttpsError("permission-denied", "This fixture is not approved for cleanup.");
  if (!fixtureRuntimeMatches(process.env, getApp().options.projectId, getApp().options.storageBucket))
    stop("Synthetic cleanup resources are not configured.");
  const db = getFirestore(), bucket = getStorage().bucket(fixture.bucket);
  const listing = db.doc(`listings/${fixture.listingId}`), audit = db.doc(`adminAuditEvents/${SYNTHETIC_AUDIT_ID}`);

  async function mediaInventory() {
    const [files, next] = await bucket.getFiles({ prefix: SYNTHETIC_MEDIA_PREFIX, autoPaginate: false, maxResults: 2 });
    if (next || files.length > 1 || files.some(file => file.name !== fixture.objectPath || !approvedMediaMetadata(file.metadata)))
      stop("Fixture media changed; review is required.");
    return files;
  }
  // Inspect every possible deletion before withdrawing; a new/foreign object aborts.
  await mediaInventory();
  const result = await db.runTransaction(async tx => {
    await verifyAdminIdentity(request); // Current authority on transaction retry, too.
    const [record, event, lifecycle, ...references] = await Promise.all([
      tx.get(listing), tx.get(audit), tx.get(db.doc(`accountLifecycles/${admin.uid}`)),
      ...["offers", "transactions", "conversations", "publicReviews", "reports"].map(collection =>
        tx.get(db.collection(collection).where("listingId", "==", fixture.listingId)
          .select("sellerId", "buyerId", "status").limit(50))),
      tx.get(listing.collection("bids").select("bidderId").limit(50)),
      tx.get(db.collection("listingWatchers").doc(fixture.listingId).collection("users").select("userId").limit(50)),
      tx.get(db.collection("users").doc(fixture.ownerUid).collection("notifications")
        .where("listingId", "==", fixture.listingId).select("recipientUserId").limit(50)),
    ]);
    if (lifecycle.exists) throw new HttpsError("permission-denied", "Admin access is no longer available.");
    if (!fixtureMatches(record.data())) stop("Fixture identity changed; review is required.");
    if (event.exists && !auditMatches(event.data())) stop("Cleanup audit state requires review.");
    const alreadyRemoved = record.data()!.status === "removed";
    if (event.exists && !alreadyRemoved) stop("Previously withdrawn fixture became active; review is required.");
    // All historical relationships are retained, even when participants look synthetic.
    // Unknown/real-user interactions can never enter a destructive history branch.
    const participants = new Set<string>();
    for (const page of references) for (const doc of page.docs) for (const field of ["sellerId", "buyerId", "bidderId", "userId"] as const) {
      const uid: unknown = doc.data()[field];
      if (typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid) && uid !== fixture.ownerUid) participants.add(uid);
    }
    // Inspect only fixture-linked notification metadata, never unrelated history.
    // More participants than this bound are still all preserved, not deleted.
    const participantNotifications = await Promise.all([...participants].slice(0, 10).map(uid =>
      tx.get(db.collection("users").doc(uid).collection("notifications").where("listingId", "==", fixture.listingId)
        .select("recipientUserId").limit(50))));
    const historyPresent = [...references, ...participantNotifications].some(page => !page.empty);
    if (!alreadyRemoved) tx.update(listing, { status: "removed", updatedAt: Timestamp.now() });
    if (!event.exists) tx.create(audit, {
      adminUid: admin.uid, action: "synthetic_fixture_cleanup", resourceType: "listing",
      resourceId: fixture.listingId, timestamp: Timestamp.now(),
      summary: { reason: fixture.reason, historicalReferencesPreserved: true, historyPresent, mediaComplete: false },
    });
    return { alreadyRemoved, historyPresent };
  });
  await verifyAdminIdentity(request);
  // Generation precondition prevents deleting a replacement object during a race.
  const files = await mediaInventory();
  for (const file of files) await file.delete({ ignoreNotFound: true, ifGenerationMatch: fixture.objectGeneration });
  if ((await mediaInventory()).length !== 0) stop("Fixture media cleanup is incomplete; retry after review.");
  await db.runTransaction(async tx => {
    await verifyAdminIdentity(request);
    const [record, event, lifecycle] = await Promise.all([tx.get(listing), tx.get(audit), tx.get(db.doc(`accountLifecycles/${admin.uid}`))]);
    if (lifecycle.exists) throw new HttpsError("permission-denied", "Admin access is no longer available.");
    if (!fixtureMatches(record.data()) || record.data()!.status !== "removed" || !auditMatches(event.data()))
      stop("Cleanup completion state requires review.");
    if (event.data()!.summary.mediaComplete !== true) tx.update(audit, { "summary.mediaComplete": true });
  });
  return { listingId: fixture.listingId, status: "removed", mediaComplete: true,
    historicalReferencesPreserved: true, alreadyRemoved: result.alreadyRemoved, historyPresent: result.historyPresent };
});
