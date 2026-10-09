import http from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { cleanupMedia } from "./cleanup.mjs";
import { processFinalized } from "./handler.mjs";
import { hash, LIMITS } from "./normalize.mjs";

const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const { listingMediaBucket } = require("./functions/lib/listing-media-domain.js");
const bucketName = process.env.TAKEME_MEDIA_BUCKET ?? process.env.TAKEME_STORAGE_BUCKETS, projectId = process.env.TAKEME_FIREBASE_PROJECT_ID;
initializeApp({ projectId, storageBucket: process.env.TAKEME_STORAGE_BUCKETS });
const { assertProtectedWritesAvailable } = require("./functions/lib/protected-write-maintenance-runtime.js");
const { assertMarketplaceEligibility, runtimePolicyContext } = require("./functions/lib/account-eligibility.js");
const context = runtimePolicyContext();
if (!context || bucketName !== listingMediaBucket(context.projectId) || process.env.TAKEME_MEDIA_PIPELINE !== "v1") throw new Error("Processor resource pins missing or invalid.");
const db = getFirestore(), bucket = getStorage().bucket(bucketName);
async function guard(tx, uid) {
  await assertProtectedWritesAvailable(tx); await assertMarketplaceEligibility(uid, tx);
  if ((await tx.get(db.doc(`accountLifecycles/${uid}`))).exists || (await getAuth().getUser(uid)).disabled) throw new Error("account-unavailable");
}
const adapter = {
  bucket: bucketName,
  claim: (uid, imageId, event) => db.runTransaction(async tx => {
    await guard(tx, uid);
    const ref = db.doc(`mediaOperations/${imageId}`), op = (await tx.get(ref)).data(), now = Timestamp.now();
    if (!op || op.cleanupClaim || op.uid !== uid || op.rawPath !== event.name || !Number.isInteger(op.sizeBytes) || op.sizeBytes < 1 || op.sizeBytes > LIMITS.bytes
      || String(event.size) !== String(op.sizeBytes) || event.contentType !== op.contentType
      || op.createdAt.toMillis() + 86400000 < now.toMillis()) throw new Error("invalid-operation");
    if (op.generation && op.generation !== String(event.generation)) throw new Error("generation-mismatch");
    if (["READY", "FAILED"].includes(op.status)) return op;
    if (op.status === "PROCESSING" && op.leaseExpiresAt?.toMillis() > now.toMillis()) return { status: "BUSY" };
    if (op.attempts >= 3) { tx.update(ref, { status: "FAILED", updatedAt: now }); return { status: "FAILED" }; }
    // Validate upload time against the originally issued permit, not callback delivery time.
    if (!Number.isFinite(Date.parse(event.timeCreated)) || Date.parse(event.timeCreated) >= op.permitExpiry.toMillis()) throw new Error("expired-upload");
    const lease = randomUUID();
    tx.update(ref, { status: "PROCESSING", generation: String(event.generation), lease, leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + 120000), attempts: op.attempts + 1, updatedAt: now });
    return { ...op, status: "CLAIMED", lease };
  }),
  async download(event, size) {
    const file = bucket.file(event.name, { generation: event.generation });
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) !== size || size > LIMITS.bytes) throw new Error("object-size-mismatch");
    const [bytes] = await file.download(); if (bytes.length !== size) throw new Error("object-size-mismatch"); return bytes;
  },
  async putImmutable(path, variant) {
    const file = bucket.file(path);
    // READY does not imply published. Public cache headers could expose an
    // authenticated draft response through a shared cache. Keep origin caching
    // private until a publication-aware cache policy is separately qualified.
    try { await file.save(variant.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "image/webp", cacheControl: "private,no-store", metadata: { takemeMediaSha256: variant.digest } } }); }
    catch (error) {
      if (error.code !== 412) throw error;
      const [metadata] = await file.getMetadata();
      const [bytes] = await file.download();
      if (metadata.contentType !== "image/webp" || metadata.metadata?.takemeMediaSha256 !== variant.digest || hash(bytes) !== variant.digest) throw new Error("immutable-output-conflict");
    }
  },
  commit: (uid, imageId, lease, media) => db.runTransaction(async tx => {
    await guard(tx, uid);
    const ref = db.doc(`mediaOperations/${imageId}`), op = (await tx.get(ref)).data();
    if (op?.cleanupClaim || op?.uid !== uid || op.lease !== lease || op.status !== "PROCESSING") throw new Error("lease-lost");
    tx.update(ref, { ...media, processedAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }),
  fail: (imageId, lease) => db.runTransaction(async tx => {
    const ref = db.doc(`mediaOperations/${imageId}`), op = (await tx.get(ref)).data();
    if (op?.lease === lease && op.status === "PROCESSING") tx.update(ref, { status: "FAILED", updatedAt: Timestamp.now() });
  }),
  removeRaw: event => bucket.file(event.name, { generation: event.generation }).delete({ ignoreNotFound: true, ifGenerationMatch: event.generation }),
};
const cleanupAdapter = {
  async candidates(cutoff, limit) {
    const state = (await db.doc("mediaCleanup/current").get()).data();
    let query = db.collection("mediaOperations").orderBy("createdAt").orderBy("__name__").where("createdAt", "<=", Timestamp.fromMillis(cutoff)).limit(limit);
    if (state?.createdAt && state?.imageId) query = query.startAfter(state.createdAt, state.imageId);
    const page = await query.get();
    cleanupAdapter.last = page.docs.at(-1);
    return page.docs.map(doc => ({ ...doc.data(), imageId: doc.id }));
  },
  claimCleanup: (imageId, now) => db.runTransaction(async tx => {
    const ref = db.doc(`mediaOperations/${imageId}`), op = (await tx.get(ref)).data();
    if (!op || op.createdAt.toMillis() + 86400000 > now || op.leaseExpiresAt?.toMillis() > now) return false;
    if (op.listingId) {
      const item = (await tx.get(db.doc(`listings/${op.listingId}`))).data();
      if (item && item.status !== "removed" && item.mediaImageIds?.includes(imageId)) return false;
    }
    tx.update(ref, { cleanupClaim: true }); return true;
  }),
  async removeOwned(op) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(op.uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(op.imageId) || !/^[a-f0-9]{64}$/.test(op.digest)) throw new Error("cleanup-path-invalid");
    const raw = `users/${op.uid}/listing-media-staging/${op.imageId}/source`;
    if (raw !== op.rawPath) throw new Error("cleanup-path-invalid");
    const prefix = `users/${op.uid}/listing-media/${op.imageId}/v1-${op.digest}/`;
    // No bucket-wide list/deletion; only four exact server-owned names.
    for (const name of [raw, ...["thumbnail", "card", "detail"].map(v => prefix + v + ".webp")]) await bucket.file(name).delete({ ignoreNotFound: true });
  },
  finishCleanup: imageId => db.doc(`mediaOperations/${imageId}`).delete(),
};
async function sweep() {
  await cleanupMedia(cleanupAdapter);
  const last = cleanupAdapter.last;
  await db.doc("mediaCleanup/current").set(last ? { createdAt: last.data().createdAt, imageId: last.id } : { createdAt: null, imageId: null });
}
// Cloud Run MUST require authenticated invocation; only the Eventarc service identity gets run.invoker.
// One request/container prevents aggregate native-memory amplification. Deploy with concurrency=1.
let busy = false;
http.createServer(async (req, res) => {
  if (req.method !== "POST" || (req.url !== "/cleanup" && req.headers["ce-type"] !== "google.cloud.storage.object.v1.finalized") || busy) { res.writeHead(503).end(); return; }
  busy = true;
  try {
    let body = "";
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new Error("event-too-large"); }
    if (req.url === "/cleanup") await sweep();
    else await processFinalized(JSON.parse(body), adapter);
    res.writeHead(204).end();
  } catch { console.warn(JSON.stringify({ event: "media-processing-deferred" })); res.writeHead(503).end(); }
  finally { busy = false; }
}).listen(Number(process.env.PORT ?? 8080));
