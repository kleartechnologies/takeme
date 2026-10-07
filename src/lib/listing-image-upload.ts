import type { ListingSubmissionCheckpoint } from "./listing-submission.ts";
import { MAX_IMAGE_BYTES } from "./listing-validation.ts";
import { cadenceErrorMessage } from "./cadence-error.ts";
import { protectedWriteMaintenanceMessage } from "./protected-write-maintenance.ts";
import { inspectConsumerPhoto, MAX_CONSUMER_PHOTO_BYTES, NATIVE_HEIC_UNAVAILABLE_MESSAGE, PHOTO_PROCESSING_TIMEOUT_MS, requirePhotoDimensions } from "./consumer-photo.ts";

export type ListingImageStage = "processing" | "upload" | "download";

export class ListingImagePipelineError extends Error {
  readonly stage: ListingImageStage;

  constructor(stage: ListingImageStage, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ListingImagePipelineError";
    this.stage = stage;
  }
}

type DecodedImage = Pick<ImageBitmap, "width" | "height" | "close">;

export interface ImageProcessingAdapter {
  decode(file: File): Promise<DecodedImage>;
  renderWebp(bitmap: DecodedImage, width: number, height: number): Promise<Blob | null>;
}

const browserImageAdapter: ImageProcessingAdapter = {
  async decode(file) {
    if (!file.size || file.size > MAX_CONSUMER_PHOTO_BYTES) throw new Error("Choose a photo smaller than 30 MB.");
    const header = inspectConsumerPhoto(new Uint8Array(await file.arrayBuffer()));
    try {
      if (typeof createImageBitmap !== "function") throw new Error("Image decoding is unavailable.");
      return await new Promise<ImageBitmap>((resolve, reject) => {
        let expired = false;
        const timer = setTimeout(() => { expired = true; reject(new Error("Photo processing timed out.")); }, PHOTO_PROCESSING_TIMEOUT_MS);
        createImageBitmap(file, { imageOrientation: "from-image" }).then(bitmap => {
          clearTimeout(timer); if (expired) bitmap.close(); else resolve(bitmap);
        }, error => { clearTimeout(timer); reject(error); });
      });
    }
    catch (error) {
      if (header.format === "heic") throw new ListingImagePipelineError("processing", NATIVE_HEIC_UNAVAILABLE_MESSAGE, { cause: error });
      throw error;
    }
  },
  renderWebp(bitmap, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    context.drawImage(bitmap as ImageBitmap, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { canvas.width = canvas.height = 0; reject(new Error("Photo rendering timed out.")); }, PHOTO_PROCESSING_TIMEOUT_MS);
      canvas.toBlob(blob => { clearTimeout(timer); canvas.width = canvas.height = 0; resolve(blob); }, "image/webp", 0.82);
    });
  },
};

type PreparedListingImage = { blob: Blob; contentType: "image/webp"; extension: "webp" };
const photoFingerprints = new WeakMap<File, string>();
export const preparedPhotoFingerprint = (file: File) => photoFingerprints.get(file);
const preparedPhotos = new WeakMap<File, PreparedListingImage>();
const preparingPhotos = new WeakMap<File, Promise<PreparedListingImage>>();

/** Early preparation produces a genuine normalized File; permits still apply at upload time. */
export async function prepareConsumerPhoto(file: File) {
  const prepared = await prepareListingImage(file);
  const normalized = new File([prepared.blob], "listing-photo.webp", { type: prepared.contentType });
  preparedPhotos.set(normalized, prepared);
  photoFingerprints.set(normalized, Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await prepared.blob.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join(""));
  return normalized;
}

async function requireEncodedWebp(blob: Blob | null, original: File): Promise<Blob> {
  if (!blob || blob === original || blob.type !== "image/webp" || blob.size < 12 || blob.size > MAX_IMAGE_BYTES) {
    throw new Error("The browser did not produce a usable WebP image.");
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fourCC = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (fourCC(0) !== "RIFF" || fourCC(8) !== "WEBP" || view.getUint32(4, true) !== bytes.length - 8) {
    throw new Error("The encoded image is not WebP.");
  }
  let offset = 12;
  let imageChunkFound = false;
  let extended = false;
  let colorProfileFlag = false;
  let colorProfileFound = false;
  let alphaFlag = false;
  let alphaFound = false;
  let imageKind = "";
  const retainedChunks: Uint8Array[] = [];
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("The WebP image is incomplete.");
    const chunk = fourCC(offset);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length || (size % 2 && bytes[end - 1] !== 0)) throw new Error("The WebP image is incomplete.");
    if (!["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP"].includes(chunk)) {
      // In particular, never upload EXIF, XMP, or unknown metadata chunks.
      throw new Error("The WebP image contains unsupported metadata.");
    }
    if (chunk === "VP8X") {
      if (offset !== 12 || extended || size !== 10) throw new Error("The WebP extended header is invalid.");
      extended = true;
      const flags = bytes[offset + 8];
      // Exif, XMP, animation and reserved features are not listing-image payloads.
      if (flags & ~0x30 || bytes[offset + 9] || bytes[offset + 10] || bytes[offset + 11]) {
        throw new Error("The WebP image contains unsupported metadata.");
      }
      colorProfileFlag = Boolean(flags & 0x20);
      alphaFlag = Boolean(flags & 0x10);
      const header = bytes.slice(offset, end);
      header[8] = flags & ~0x20;
      retainedChunks.push(header);
    } else if (chunk === "ICCP") {
      if (!extended || !colorProfileFlag || colorProfileFound || imageChunkFound || alphaFound || size === 0) {
        throw new Error("The WebP color profile is invalid.");
      }
      colorProfileFound = true;
      // A color profile is not required to decode the pixels and may contain metadata.
      // Never carry it into the upload payload.
    } else if (chunk === "ALPH") {
      if (!extended || !alphaFlag || alphaFound || imageChunkFound || size === 0) {
        throw new Error("The WebP alpha chunk is invalid.");
      }
      alphaFound = true;
      retainedChunks.push(bytes.subarray(offset, end));
    } else {
      if (imageChunkFound || (alphaFound && chunk !== "VP8 ") || size === 0) throw new Error("The WebP image payload is invalid.");
      imageChunkFound = true;
      imageKind = chunk;
      retainedChunks.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (!imageChunkFound || offset !== bytes.length || colorProfileFlag !== colorProfileFound || (imageKind === "VP8 " && alphaFlag !== alphaFound)) {
    throw new Error("The WebP image is incomplete.");
  }
  if (!colorProfileFound) return blob;
  const output = new Uint8Array(12 + retainedChunks.reduce((length, chunk) => length + chunk.length, 0));
  output.set(bytes.subarray(0, 12));
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  let writeOffset = 12;
  for (const chunk of retainedChunks) { output.set(chunk, writeOffset); writeOffset += chunk.length; }
  if (output.length > MAX_IMAGE_BYTES) throw new Error("The WebP image is too large.");
  return new Blob([output], { type: "image/webp" });
}

export async function prepareListingImage(file: File, adapter: ImageProcessingAdapter = browserImageAdapter) {
  if (adapter === browserImageAdapter) {
    const cached = preparedPhotos.get(file);
    if (cached) return cached;
    const pending = preparingPhotos.get(file);
    if (pending) return pending;
    const promise = prepareWith(file, adapter).then(value => { preparedPhotos.set(file, value); return value; }).finally(() => preparingPhotos.delete(file));
    preparingPhotos.set(file, promise);
    return promise;
  }
  return prepareWith(file, adapter);
}

async function prepareWith(file: File, adapter: ImageProcessingAdapter): Promise<PreparedListingImage> {
  let bitmap: DecodedImage | undefined;
  try {
    bitmap = await adapter.decode(file);
    if (!Number.isFinite(bitmap.width) || !Number.isFinite(bitmap.height) || bitmap.width <= 0 || bitmap.height <= 0) {
      throw new Error("The image dimensions are invalid.");
    }
    requirePhotoDimensions(bitmap.width, bitmap.height);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (adapter === browserImageAdapter && file.type === "image/webp" && bitmap.width <= 1600 && bitmap.height <= 1600 && file.size <= 512 * 1024) {
      try {
        const clean = await requireEncodedWebp(new Blob([file], { type: "image/webp" }), file);
        // A source colour profile needs decoded-pixel conversion through the sRGB canvas.
        // Only already metadata-free WebP can bypass encoding without changing colours.
        if (clean.size !== file.size) throw new Error("Source colour profile needs conversion.");
        return { blob: clean, contentType: "image/webp", extension: "webp" };
      }
      catch { /* Metadata-bearing or awkward WebP is re-encoded from decoded pixels. */ }
    }
    const blob = await requireEncodedWebp(await adapter.renderWebp(bitmap, width, height), file);
    return { blob, contentType: "image/webp" as const, extension: "webp" as const };
  } catch (cause) {
    if (cause instanceof ListingImagePipelineError) throw cause;
    throw new ListingImagePipelineError("processing", "We couldn’t process this photo. Tap to replace it.", { cause });
  } finally {
    bitmap?.close();
  }
}

export interface ListingImageUploadAdapter<TReference extends { fullPath: string }> {
  prepare(file: File): Promise<Awaited<ReturnType<typeof prepareListingImage>>>;
  reference(path: string): TReference;
  upload(reference: TReference, blob: Blob, contentType: "image/webp"): Promise<unknown>;
  downloadUrl(reference: TReference): Promise<string>;
  remove(reference: TReference): Promise<unknown>;
  uniqueId(): string;
  exists?(reference: TReference, blob: Blob): Promise<boolean>;
}

export async function uploadListingImagesWith<TReference extends { fullPath: string }>(
  uid: string,
  listingId: string,
  files: File[],
  adapter: ListingImageUploadAdapter<TReference>,
  checkpoint?: ListingSubmissionCheckpoint,
  onCheckpoint?: () => void,
) {
  const uploaded: { url: string; fullPath: string; reference: TReference }[] = [];
  try {
    for (const file of files) {
      const prepared = await adapter.prepare(file);
      // Keep the upload boundary fail-closed even if the preparation implementation changes.
      try {
        await requireEncodedWebp(prepared.blob, file);
        if (prepared.contentType !== "image/webp" || prepared.extension !== "webp") throw new Error("Invalid image format.");
      } catch (cause) {
        throw new ListingImagePipelineError("processing", "This photo could not be prepared safely. Try another photo or browser.", { cause });
      }
      let path = `users/${uid}/listings/${listingId}/${adapter.uniqueId()}.webp`;
      if (checkpoint) {
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await prepared.blob.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
        const retained = checkpoint.uploads.find(image => image.digest === digest);
        if (retained) {
          if (!retained.path.startsWith(`users/${uid}/listings/${listingId}/`)) throw new Error("Recovered upload ownership does not match.");
          path = retained.path;
        } else {
          if (checkpoint.uploads.length >= 24) throw new Error("Review this draft in My Listings before adding more replacement uploads.");
          checkpoint.uploads.push({ digest, path }); onCheckpoint?.();
        }
      }
      const reference = adapter.reference(path);
      try {
        if (checkpoint && !adapter.exists) throw new Error("Upload recovery is unavailable.");
        if (!checkpoint || !await adapter.exists!(reference, prepared.blob)) await adapter.upload(reference, prepared.blob, "image/webp");
      } catch (cause) {
        throw new ListingImagePipelineError("upload", protectedWriteMaintenanceMessage(cause) ?? cadenceErrorMessage(cause) ?? "The prepared photo could not be uploaded. Check your connection and try again.", { cause });
      }
      const entry = { url: "", fullPath: reference.fullPath, reference };
      uploaded.push(entry);
      try {
        entry.url = await adapter.downloadUrl(reference);
      } catch (cause) {
        throw new ListingImagePipelineError("download", "The uploaded photo could not be verified. Please try again.", { cause });
      }
    }
  } catch (error) {
    if (!checkpoint) await Promise.allSettled(uploaded.map((item) => adapter.remove(item.reference)));
    throw error;
  }
  return uploaded.map(({ url, fullPath }) => ({ url, fullPath }));
}
