import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onRequest } from "firebase-functions/v2/https";
import { runtimePolicyContext, assertMarketplaceEligibility } from "./account-eligibility";
import { assertProtectedWritesAvailable } from "./protected-write-maintenance-runtime";
import { MAX_MEDIA_BYTES, mediaId, rawMediaPath, listingMediaBucket } from "./listing-media-domain";

/** Firebase SDK raw uploads mint shareable download tokens. Use a bounded broker
 * instead: verified Auth -> exact existing permit -> create-only tokenless GCS.
 * Resource-scoped Storage IAM is separate from these document-level application guards. */
export const uploadListingMediaSource = onRequest({ region: "asia-southeast1", memory: "512MiB", timeoutSeconds: 60, maxInstances: 2 }, async (request, response) => {
  const context = runtimePolicyContext();
  const origins = context?.target === "production" ? ["https://takeme.my"] : context?.target === "staging" ? ["https://takeme-web-preview.takeme-technologies.workers.dev"] : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3400", "http://127.0.0.1:3400"];
  const origin = request.get("origin");
  if (origin && !origins.includes(origin)) { response.status(403).end(); return; }
  if (origin) { response.set("Access-Control-Allow-Origin", origin); response.set("Vary", "Origin"); }
  if (request.method === "OPTIONS") { response.set("Access-Control-Allow-Methods", "POST"); response.set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Takeme-Image,X-Takeme-Permit"); response.status(204).end(); return; }
  if (request.method !== "POST" || !context || process.env.TAKEME_MEDIA_PIPELINE !== "v1") { response.status(503).json({ message: "Photo processing is unavailable." }); return; }
  try {
    const authorization = request.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new Error("auth-required");
    const auth = await getAuth().verifyIdToken(authorization.slice(7), true), uid = auth.uid;
    const imageId = request.get("x-takeme-image"), permitId = request.get("x-takeme-permit");
    const bytes = request.rawBody;
    if (!mediaId(uid) || !mediaId(imageId) || !mediaId(permitId) || !Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_MEDIA_BYTES) throw new Error("invalid-upload");
    const path = rawMediaPath(uid, imageId), digest = createHash("sha256").update(bytes).digest("hex"), contentType = request.get("content-type");
    const db = getFirestore();
    await db.runTransaction(async tx => {
      await assertProtectedWritesAvailable(tx); await assertMarketplaceEligibility(uid, tx);
      const [op, acceptance, lifecycle] = await Promise.all([tx.get(db.doc(`mediaOperations/${imageId}`)), tx.get(db.doc(`users/${uid}/private/onboarding`)), tx.get(db.doc(`accountLifecycles/${uid}`))]);
      const data = op.data(), permit = acceptance.data()?.uploadPermits?.[permitId];
      if (lifecycle.exists || data?.cleanupClaim || data?.uid !== uid || data?.rawPath !== path || data?.digest !== digest
        || data?.status !== "UPLOADING" || data?.sizeBytes !== bytes.length || data?.contentType !== contentType
        || !permit || permit.path !== path || permit.contentType !== contentType || permit.sizeBytes !== bytes.length
        || !(permit.expiresAt instanceof Timestamp) || permit.expiresAt.toMillis() <= Date.now()) throw new Error("invalid-permit");
      // Read-only transaction still detects pause/acceptance/lifecycle changes during evaluation.
    });
    const bucket = getStorage().bucket(listingMediaBucket(context.projectId)), file = bucket.file(path);
    try { await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: "private,no-store", metadata: { takemeMediaSha256: digest } } }); }
    catch (e) {
      if ((e as { code?: number }).code !== 412) throw e;
      // Recovery verifies a previous exact create. It never overwrites that object.
      const [m] = await file.getMetadata();
      if (m.metadata?.takemeMediaSha256 !== digest || Number(m.size) !== bytes.length || m.contentType !== contentType) throw new Error("immutable-upload-conflict");
    }
    response.status(202).json({ imageId, status: "PROCESSING" });
  } catch { response.status(403).json({ message: "The photo could not be uploaded. Review your account or try again." }); }
});
