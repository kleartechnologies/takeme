import assert from "node:assert/strict";
import test from "node:test";
import {
  ListingImagePipelineError,
  prepareListingImage,
  uploadListingImagesWith,
  type ImageProcessingAdapter,
  type ListingImageUploadAdapter,
} from "../src/lib/listing-image-upload.ts";

const original = new File(["JPEG with private EXIF GPS data"], "photo.jpg", { type: "image/jpeg" });
function webp(extraChunk?: string) {
  const chunks = ["VP8 ", ...(extraChunk ? [extraChunk] : [])];
  const bytes = new Uint8Array(12 + chunks.length * 10);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => { for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index); };
  write(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  write(8, "WEBP");
  chunks.forEach((chunk, index) => { write(12 + index * 10, chunk); view.setUint32(16 + index * 10, 2, true); });
  return new Blob([bytes], { type: "image/webp" });
}
function extendedWebp(chunks: { name: string; data: Uint8Array }[], flags = 0x20) {
  const payloadLength = chunks.reduce((length, chunk) => length + 8 + chunk.data.length + (chunk.data.length % 2), 0);
  const bytes = new Uint8Array(12 + 18 + payloadLength);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index); };
  write(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); write(8, "WEBP");
  write(12, "VP8X"); view.setUint32(16, 10, true); bytes[20] = flags;
  let offset = 30;
  for (const chunk of chunks) {
    write(offset, chunk.name); view.setUint32(offset + 4, chunk.data.length, true);
    bytes.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length + (chunk.data.length % 2);
  }
  return new Blob([bytes], { type: "image/webp" });
}
const browserProfileWebp = () => extendedWebp([
  { name: "ICCP", data: new Uint8Array([1, 2, 3]) },
  { name: "VP8 ", data: new Uint8Array([4, 5]) },
]);

function imageAdapter(output: Blob | null, calls: string[] = []): ImageProcessingAdapter {
  return {
    async decode(file) {
      assert.equal(file, original);
      calls.push("decode");
      return { width: 4032, height: 3024, close: () => calls.push("close") };
    },
    async renderWebp(_bitmap, width, height) {
      assert.deepEqual([width, height], [1600, 1200]);
      calls.push("encode");
      return output;
    },
  };
}

function uploadAdapter(calls: string[], prepare = (file: File) => prepareListingImage(file, imageAdapter(webp(), calls))): ListingImageUploadAdapter<{ fullPath: string }> {
  let uploadedReference: { fullPath: string } | undefined;
  return {
    prepare,
    reference(path) { calls.push("reference"); uploadedReference = { fullPath: path }; return uploadedReference; },
    async upload(reference, blob, contentType) {
      calls.push("upload");
      assert.equal(reference, uploadedReference);
      assert.notEqual(blob, original);
      assert.equal(blob.type, "image/webp");
      assert.equal(contentType, "image/webp");
      assert.equal(reference.fullPath, "users/seller/listings/listing/fixed-id.webp");
    },
    async downloadUrl(reference) {
      calls.push("download");
      assert.equal(reference, uploadedReference);
      assert.equal(reference.fullPath, "users/seller/listings/listing/fixed-id.webp");
      return "https://example.invalid/uploaded-image";
    },
    async remove() { calls.push("remove"); },
    uniqueId() { return "fixed-id"; },
  };
}

test("server cadence denial keeps safe copy and cleans an earlier uploaded photo", async () => {
  const calls: string[] = [];
  const adapter = uploadAdapter(calls);
  const originalUpload = adapter.upload;
  let uploads = 0;
  adapter.upload = async (reference, blob, contentType) => {
    if (++uploads === 2) throw { code: "functions/resource-exhausted", details: { reason: "cadence-limit", retryAfterMs: 10_000, privateCounter: 64 } };
    return originalUpload(reference, blob, contentType);
  };
  await assert.rejects(uploadListingImagesWith("seller", "listing", [original, original], adapter), error => {
    assert.ok(error instanceof ListingImagePipelineError);
    assert.equal(error.stage, "upload");
    assert.equal(error.message, "Too many attempts. Please try again shortly.");
    assert.doesNotMatch(error.message, /64|privateCounter/);
    return true;
  });
  assert.equal(calls.filter(value => value === "download").length, 1);
  assert.equal(calls.filter(value => value === "remove").length, 1);
});

test("valid JPEG is decoded, resized, and encoded as a separate WebP payload", async () => {
  const calls: string[] = [];
  const prepared = await prepareListingImage(original, imageAdapter(webp(), calls));
  assert.notEqual(prepared.blob, original);
  assert.equal(prepared.contentType, "image/webp");
  assert.equal(prepared.extension, "webp");
  assert.deepEqual(calls, ["decode", "encode", "close"]);
});

test("browser VP8X + ICCP + VP8 output is sanitized before upload", async () => {
  const calls: string[] = [];
  let uploadedBlob: Blob | undefined;
  const adapter = uploadAdapter(calls, (file) => prepareListingImage(file, imageAdapter(browserProfileWebp(), calls)));
  const upload = adapter.upload;
  adapter.upload = async (reference, blob, contentType) => { uploadedBlob = blob; return upload(reference, blob, contentType); };
  await uploadListingImagesWith("seller", "listing", [original], adapter);
  assert.ok(uploadedBlob);
  const bytes = new Uint8Array(await uploadedBlob.arrayBuffer());
  assert.equal(bytes[20] & 0x20, 0, "the ICC profile flag must be cleared");
  assert.equal(new DataView(bytes.buffer).getUint32(4, true), bytes.length - 8);
  assert.equal(new TextDecoder().decode(bytes), new TextDecoder().decode(new Uint8Array(await extendedWebp([
    { name: "VP8 ", data: new Uint8Array([4, 5]) },
  ], 0).arrayBuffer())));
  assert.deepEqual(calls, ["decode", "encode", "close", "reference", "upload", "download"]);
});

test("malformed or unsupported WebP metadata never reaches upload", async () => {
  const cases = [
    extendedWebp([{ name: "ICCP", data: new Uint8Array([1]) }, { name: "VP8 ", data: new Uint8Array([4, 5]) }], 0),
    extendedWebp([{ name: "VP8 ", data: new Uint8Array([4, 5]) }, { name: "ICCP", data: new Uint8Array([1]) }]),
    extendedWebp([{ name: "ICCP", data: new Uint8Array([1]) }, { name: "ICCP", data: new Uint8Array([2]) }, { name: "VP8 ", data: new Uint8Array([4, 5]) }]),
    extendedWebp([{ name: "ICCP", data: new Uint8Array([1]) }, { name: "EXIF", data: new Uint8Array([1]) }, { name: "VP8 ", data: new Uint8Array([4, 5]) }]),
    extendedWebp([{ name: "ICCP", data: new Uint8Array([1]) }, { name: "XMP ", data: new Uint8Array([1]) }, { name: "VP8 ", data: new Uint8Array([4, 5]) }]),
    extendedWebp([{ name: "ICCP", data: new Uint8Array([1]) }, { name: "JUNK", data: new Uint8Array([1]) }, { name: "VP8 ", data: new Uint8Array([4, 5]) }]),
  ];
  const truncated = new Uint8Array(await browserProfileWebp().arrayBuffer());
  truncated[35] = 255;
  cases.push(new Blob([truncated], { type: "image/webp" }));
  const badPadding = new Uint8Array(await browserProfileWebp().arrayBuffer());
  badPadding[41] = 1;
  cases.push(new Blob([badPadding], { type: "image/webp" }));
  for (const output of cases) {
    const calls: string[] = [];
    await assert.rejects(uploadListingImagesWith("seller", "listing", [original], uploadAdapter(calls, (file) => prepareListingImage(file, imageAdapter(output, calls)))),
      (error: unknown) => error instanceof ListingImagePipelineError && error.stage === "processing");
    assert.ok(!calls.includes("upload"));
    assert.ok(!calls.includes("download"));
  }
});

test("only the processed WebP reaches upload and its exact reference reaches getDownloadURL", async () => {
  const calls: string[] = [];
  const uploaded = await uploadListingImagesWith("seller", "listing", [original], uploadAdapter(calls));
  assert.deepEqual(uploaded, [{ url: "https://example.invalid/uploaded-image", fullPath: "users/seller/listings/listing/fixed-id.webp" }]);
  assert.deepEqual(calls, ["decode", "encode", "close", "reference", "upload", "download"]);
  // The returned URL is what the existing createListing path sends to publishFixed.
  assert.deepEqual(uploaded.map((item) => item.url), ["https://example.invalid/uploaded-image"]);
});

test("failed WebP encoding stops before Storage upload or download", async () => {
  const calls: string[] = [];
  await assert.rejects(
    uploadListingImagesWith("seller", "listing", [original], uploadAdapter(calls, (file) => prepareListingImage(file, imageAdapter(null, calls)))),
    (error: unknown) => error instanceof ListingImagePipelineError && error.stage === "processing",
  );
  assert.deepEqual(calls, ["decode", "encode", "close"]);
});

test("browser PNG fallback or mislabeled bytes cannot pass the upload boundary", async () => {
  for (const badOutput of [new Blob(["PNG"], { type: "image/png" }), new Blob(["not actually WebP"], { type: "image/webp" }), webp("EXIF"), webp("XMP ")]) {
    const calls: string[] = [];
    await assert.rejects(
      uploadListingImagesWith("seller", "listing", [original], uploadAdapter(calls, (file) => prepareListingImage(file, imageAdapter(badOutput, calls)))),
      (error: unknown) => error instanceof ListingImagePipelineError && error.stage === "processing",
    );
    assert.ok(!calls.includes("upload"));
    assert.ok(!calls.includes("download"));
  }
});

test("the original File is rejected even if a future prepare adapter returns it", async () => {
  const calls: string[] = [];
  await assert.rejects(
    uploadListingImagesWith("seller", "listing", [original], uploadAdapter(calls, async () => ({ blob: original, contentType: "image/webp", extension: "webp" }))),
    (error: unknown) => error instanceof ListingImagePipelineError && error.stage === "processing",
  );
  assert.ok(!calls.includes("upload"));
});

test("upload and download failures have distinct stages and never proceed to publish", async () => {
  for (const stage of ["upload", "download"] as const) {
    const calls: string[] = [];
    const adapter = uploadAdapter(calls);
    if (stage === "upload") adapter.upload = async () => { calls.push("upload"); throw new Error("Firebase Storage rejected upload"); };
    else adapter.downloadUrl = async () => { calls.push("download"); throw new Error("Firebase Storage rejected URL"); };
    await assert.rejects(
      uploadListingImagesWith("seller", "listing", [original], adapter),
      (error: unknown) => error instanceof ListingImagePipelineError && error.stage === stage,
    );
    assert.equal(calls.includes("download"), stage === "download");
    assert.ok(!calls.includes("publish"));
    assert.equal(calls.includes("remove"), stage === "download");
  }
});
