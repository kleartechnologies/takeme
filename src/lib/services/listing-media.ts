import { getBlob, getStorage, ref } from "firebase/storage";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, functions, storage } from "@/lib/firebase/client";
import { marketplaceCallable } from "./marketplace-call";
import { inspectConsumerPhoto } from "@/lib/consumer-photo";
import { readyMedia, storageMediaUrl, listingMediaBucket, type ReadyMedia } from "../../../functions/src/listing-media-domain.ts";

export const mediaPipelineEnabled = process.env.NEXT_PUBLIC_TAKEME_MEDIA_PIPELINE === "v1";
const registered = new WeakMap<File, { imageId: string; digest: string; media: ReadyMedia }>();
const operationIds = new WeakMap<File, string>();
const pending = new WeakMap<File, Promise<ReadyMedia>>();
export const preparedMedia = (file: File) => registered.get(file);
export async function prepareServerPhoto(file: File, imageId: string = crypto.randomUUID(), onStatus?: (status: "UPLOADING" | "PROCESSING") => void): Promise<ReadyMedia> {
  imageId = operationIds.get(file) ?? imageId; operationIds.set(file, imageId);
  const existing = registered.get(file); if (existing) return existing.media;
  const job = pending.get(file); if (job) return job;
  const run = (async () => {
    if (!mediaPipelineEnabled || !functions || !storage || !auth?.currentUser || !db) throw new Error("Photo processing is unavailable.");
    const bytes = await file.arrayBuffer(), header = inspectConsumerPhoto(new Uint8Array(bytes));
    if (header.format === "heic") throw new Error("Unsupported selected representation.", { cause: { code: "media/unsupported" } });
    const contentType = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" })[header.format];
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b=>b.toString(16).padStart(2,"0")).join("");
    const begin = marketplaceCallable<{ imageId: string; digest: string; contentType: string; sizeBytes: number }, { imageId: string; path: string; status: string; permitId?: string }>(functions, "beginListingMedia");
    const { data: issued } = await begin({ imageId, digest, contentType, sizeBytes: file.size });
    const expectedPath = `users/${auth.currentUser.uid}/listing-media-staging/${imageId}/source`;
    if (issued.imageId !== imageId || issued.path !== expectedPath) throw new Error("Invalid photo authorisation.");
    if (issued.status === "UPLOADING") {
      if (!issued.permitId) throw new Error("Invalid photo authorisation.");
      onStatus?.("UPLOADING");
      const projectId = storage.app.options.projectId;
      const endpoint = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ? `http://127.0.0.1:5001/${projectId}/asia-southeast1/uploadListingMediaSource` : `https://asia-southeast1-${projectId}.cloudfunctions.net/uploadListingMediaSource`;
      const token = await auth.currentUser.getIdToken();
      let response: Response;
      try {
        response = await fetch(endpoint, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": contentType, "X-Takeme-Image": imageId, "X-Takeme-Permit": issued.permitId }, body: file });
      } catch { throw new Error("Photo connection interrupted.", { cause: { code: "media/network" } }); }
      if (!response.ok) throw new Error("The photo could not be uploaded.", { cause: { code: response.status === 429 || response.status >= 500 ? "media/unavailable" : "media/unauthorized" } });
    }
    onStatus?.("PROCESSING");
    const media = await new Promise<ReadyMedia>((resolve, reject) => {
      const timer = setTimeout(() => { stop?.(); reject(new Error("Photo processing is taking longer than expected.", { cause: { code: "media/timeout" } })); }, 180_000);
      const stop = onSnapshot(doc(db!, "mediaOperations", imageId), snap => {
        const op = snap.data();
        if (op?.status === "READY") { clearTimeout(timer); stop?.(); resolve(op as ReadyMedia); }
        else if (op?.status === "FAILED") { clearTimeout(timer); stop?.(); reject(new Error("We couldn’t process this photo. Tap to replace it.")); }
      }, error => { clearTimeout(timer); stop?.(); reject(new Error("Photo status could not be read.", { cause: { code: `firestore/${error.code}` } })); });
    });
    registered.set(file, { imageId, digest, media }); return media;
  })();
  pending.set(file, run);
  try { return await run; } finally { pending.delete(file); }
}
export async function serverPhotoUrls(files: File[]) {
  const projectId = storage?.app.options.projectId;
  const bucket = projectId ? listingMediaBucket(projectId) : undefined;
  if (!bucket) throw new Error("Photos are unavailable.");
  const media = await Promise.all(files.map(file => prepareServerPhoto(file, preparedMedia(file)?.imageId)));
  return media.map(m => ({ url: storageMediaUrl(bucket, m.detailPath), fullPath: m.detailPath }));
}

/** Draft derivatives remain private: authenticated SDK bytes become a local preview URL. */
export async function serverPhotoPreview(file: File) {
  const media=preparedMedia(file)?.media;
  if(!media)throw new Error("Your photo is still processing.");
  return serverReadyPhotoPreview(media);
}

/** Existing draft previews use the same authenticated, bounded thumbnail read. */
export async function serverReadyPhotoPreview(value: ReadyMedia) {
  const uid = auth?.currentUser?.uid;
  const media = uid ? readyMedia(value, uid) : null;
  if (!storage || !media) throw new Error("Your photo is unavailable. Sign in as its owner and try again.");
  const bucket = listingMediaBucket(storage.app.options.projectId!);
  const mediaStorage = bucket === storage.app.options.storageBucket ? storage : getStorage(storage.app, `gs://${bucket}`);
  return getBlob(ref(mediaStorage,media.thumbnailPath),8*1024*1024);
}
