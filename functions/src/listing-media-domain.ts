/** One bounded contract for the processor, callables and browser. No codec runs in the browser. */
export const MEDIA_PIPELINE_VERSION = 1;
/** Owner-approved staging isolation; production/legacy default bucket is unchanged. */
export const STAGING_MEDIA_BUCKET = "takeme-staging-822a5-media-v1";
/** Prepared only; this bucket must be created/registered/qualified before V1 production rollout. */
export const PRODUCTION_MEDIA_BUCKET = "takeme-52b80-media-v1";
export function listingMediaBucket(projectId: string): string {
  if (projectId === "takeme-staging-822a5") return STAGING_MEDIA_BUCKET;
  if (projectId === "takeme-52b80") return PRODUCTION_MEDIA_BUCKET;
  if (projectId === "demo-takeme") return `${projectId}.firebasestorage.app`;
  throw new Error("Unapproved media project.");
}
export const MAX_MEDIA_BYTES = 30 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 50_000_000;
export const MAX_MEDIA_EDGE = 16_384;
export const MEDIA_RETENTION_MS = 24 * 60 * 60_000;
export const MEDIA_VARIANTS = { thumbnail: 400, card: 800, detail: 1600 } as const;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type MediaStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
export type ReadyMedia = {
  imageId: string; status: "READY"; width: number; height: number; mime: "image/webp";
  thumbnailPath: string; cardPath: string; detailPath: string;
};
export type MediaInput = { imageId: string; digest: string; contentType: string; sizeBytes: number };
export const mediaId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function parseMediaInput(value: unknown): MediaInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a photo.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "contentType,digest,imageId,sizeBytes" || !mediaId(v.imageId)
    || typeof v.digest !== "string" || !/^[a-f0-9]{64}$/.test(v.digest)
    || !MEDIA_TYPES.includes(v.contentType as typeof MEDIA_TYPES[number])
    || !Number.isInteger(v.sizeBytes) || Number(v.sizeBytes) < 1 || Number(v.sizeBytes) > MAX_MEDIA_BYTES) throw new Error("Choose a photo smaller than 30 MB.");
  return v as MediaInput;
}
export const rawMediaPath = (uid: string, imageId: string) => `users/${uid}/listing-media-staging/${imageId}/source`;
export const finalMediaPrefix = (uid: string, imageId: string, digest: string) => `users/${uid}/listing-media/${imageId}/v${MEDIA_PIPELINE_VERSION}-${digest}/`;
export function readyMedia(value: unknown, uid: string): ReadyMedia | null {
  if (!value || typeof value !== "object") return null;
  if ((value as Record<string, unknown>).cleanupClaim) return null;
  const v = value as ReadyMedia;
  if (!mediaId(uid) || !mediaId(v.imageId) || v.status !== "READY" || v.mime !== "image/webp"
    || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width < 1 || v.height < 1 || Math.max(v.width, v.height) > 1600) return null;
  const prefix = `users/${uid}/listing-media/${v.imageId}/v1-`;
  const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([a-f0-9]{64})/detail\\.webp$`).exec(v.detailPath);
  if (!match || v.thumbnailPath !== finalMediaPrefix(uid, v.imageId, match[1]!) + "thumbnail.webp" || v.cardPath !== finalMediaPrefix(uid, v.imageId, match[1]!) + "card.webp") return null;
  return { imageId: v.imageId, status: "READY", width: v.width, height: v.height, mime: v.mime, thumbnailPath: v.thumbnailPath, cardPath: v.cardPath, detailPath: v.detailPath };
}
/** Caller order is the cover order. A partially ready batch is never publishable. */
export function orderedReadyMedia(ids: unknown, operations: Record<string, unknown>, uid: string): ReadyMedia[] {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 8 || ids.some(id => !mediaId(id)) || new Set(ids).size !== ids.length) throw new Error("Keep between one and eight photos.");
  return ids.map(id => { const media = readyMedia(operations[id], uid); if (!media || media.imageId !== id) throw new Error("Your photos are still processing. Review photos before publishing."); return media; });
}
export function storageMediaUrl(bucket: string, path: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Additional codec budget; legacy upload cadence stays unchanged. Server-owned rolling window. */
export function mediaAdmission(events: unknown, now: number): number[] {
  if (events !== undefined && (!Array.isArray(events) || events.length > 32 || events.some(at => !Number.isSafeInteger(at) || at < 0 || at > now))) throw new Error("Photo allowance needs review.");
  const retained = ((events ?? []) as number[]).filter(at => at > now - 3_600_000);
  if (retained.length >= 32) throw new Error("Please wait before processing more photos.");
  return [...retained, now];
}
