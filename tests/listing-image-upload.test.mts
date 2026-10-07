import assert from "node:assert/strict";
import test from "node:test";
import { newListingSubmission } from "../src/lib/listing-submission.ts";
import { PROTECTED_WRITE_MAINTENANCE_MESSAGE, ProtectedWriteMaintenanceError, protectedWriteMaintenanceMessage } from "../src/lib/protected-write-maintenance.ts";
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

test("maintenance rejection preserves safe copy and does not retry or publish an upload", async () => {
  const calls: string[] = [];
  const adapter = uploadAdapter(calls);
  const upload = adapter.upload;
  let uploads = 0;
  adapter.upload = async (reference, blob, contentType) => {
    if (++uploads === 2) throw new ProtectedWriteMaintenanceError();
    return upload(reference, blob, contentType);
  };
  await assert.rejects(uploadListingImagesWith("seller", "listing", [original, original], adapter), error => {
    assert.ok(error instanceof ListingImagePipelineError);
    assert.equal(error.stage, "upload");
    assert.equal(error.message, PROTECTED_WRITE_MAINTENANCE_MESSAGE);
    assert.equal(protectedWriteMaintenanceMessage(error), PROTECTED_WRITE_MAINTENANCE_MESSAGE);
    return true;
  });
  assert.equal(uploads, 2);
  assert.equal(calls.filter(value => value === "download").length, 1);
  assert.equal(calls.filter(value => value === "remove").length, 1);
  assert.ok(!calls.includes("publish"));
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

test("checkpoint retry verifies and reuses a completed immutable upload after a lost URL response", async () => {
  const calls: string[] = [], state = newListingSubmission("buy_now");
  state.id = "listing"; state.creationAttempted = true;
  const adapter = uploadAdapter(calls);
  let exists = false, first = true;
  adapter.exists = async () => exists;
  const upload = adapter.upload, download = adapter.downloadUrl;
  adapter.upload = async (...args) => { await upload(...args); exists = true; };
  adapter.downloadUrl = async reference => { if (first) { first = false; throw Error("lost response"); } return download(reference); };
  await assert.rejects(uploadListingImagesWith("seller", "listing", [original], adapter, state));
  assert.equal(state.uploads.length, 1);
  const result = await uploadListingImagesWith("seller", "listing", [original], adapter, state);
  assert.equal(result[0].fullPath, state.uploads[0].path);
  assert.equal(calls.filter(value => value === "upload").length, 1);
  assert.ok(!calls.includes("remove"));
});

test("upload recovery refuses foreign ownership and failed metadata reads without a replacement upload", async () => {
  for (const foreign of [true, false]) {
    const calls: string[] = [], state = newListingSubmission("buy_now");
    state.id = "listing"; state.creationAttempted = true;
    const adapter = uploadAdapter(calls);
    adapter.exists = async () => { throw Error("read denied"); };
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", await webp().arrayBuffer())).toString("hex");
    state.uploads = [{ digest, path: `users/${foreign ? "other" : "seller"}/listings/listing/retained.webp` }];
    await assert.rejects(uploadListingImagesWith("seller", "listing", [original], adapter, state));
    assert.ok(!calls.includes("upload"));
    assert.ok(!calls.includes("remove"));
    assert.equal(state.uploads.length, 1);
  }
});

function nativeHeic() {
  const box = (kind: string, data: Uint8Array) => {
    const bytes = new Uint8Array(data.length + 8);
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    bytes.set(Buffer.from(kind), 4); bytes.set(data, 8); return bytes;
  };
  const size = new Uint8Array(12);
  new DataView(size.buffer).setUint32(4, 800); new DataView(size.buffer).setUint32(8, 600);
  return new File([new Uint8Array([
    ...box('ftyp', new Uint8Array([...Buffer.from('heic'), 0, 0, 0, 0, ...Buffer.from('mif1')])),
    ...box('meta', new Uint8Array([...new Uint8Array(4), ...box('iprp', box('ipco', box('ispe', size)))])),
  ])], 'synthetic.heic', {type:'image/heic'});
}

test('native HEIC success normalizes pixels; native failure stays local and isolated', async () => {
  const { NATIVE_HEIC_UNAVAILABLE_MESSAGE } = await import('../src/lib/consumer-photo.ts');
  const keys = ['createImageBitmap', 'document', 'Worker', 'fetch'] as const;
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let closed = 0, encoded = 0, nativeRejects = false;
  const source = nativeHeic();
  try {
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable:true, value: async (file: File, options: ImageBitmapOptions) => {
      assert.equal(options.imageOrientation, 'from-image');
      if (file === source && nativeRejects) throw new Error('native format unavailable');
      return {width:800,height:600,close:()=>closed++};
    }});
    Object.defineProperty(globalThis, 'document', { configurable:true, value: { createElement: () => ({
      width:0,height:0,getContext:()=>({drawImage:()=>{}}),
      toBlob:(callback:BlobCallback,type:string,quality:number)=>{assert.equal(type,'image/webp');assert.equal(quality,0.82);encoded++;callback(webp());},
    }) }});
    Object.defineProperty(globalThis, 'Worker', { configurable:true, value: class { constructor(){assert.fail('No decoder worker is permitted');} } });
    Object.defineProperty(globalThis, 'fetch', { configurable:true, value: ()=>assert.fail('No conversion endpoint is permitted') });
    const prepared = await prepareListingImage(source);
    assert.notEqual(prepared.blob,source);assert.equal(prepared.contentType,'image/webp');assert.equal(closed,1);assert.equal(encoded,1);
    nativeRejects = true;
    // Use a fresh File to avoid the deliberate successful preparation cache.
    const failing = nativeHeic();
    Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async(file:File)=>{
      if(file===failing)throw new Error('native format unavailable');
      return {width:800,height:600,close:()=>closed++};
    }});
    const calls:string[]=[];
    await assert.rejects(uploadListingImagesWith('seller','listing',[failing],uploadAdapter(calls,prepareListingImage)),error=>{
      assert.ok(error instanceof ListingImagePipelineError);assert.equal(error.stage,'processing');assert.equal(error.message,NATIVE_HEIC_UNAVAILABLE_MESSAGE);return true;
    });
    assert.deepEqual(calls,[],'unsupported originals must never reach reference/permit/upload');
    const png = new Uint8Array(33); png.set([137,80,78,71,13,10,26,10]); png.set(Buffer.from('IHDR'),12); new DataView(png.buffer).setUint32(16,800); new DataView(png.buffer).setUint32(20,600);
    const outcomes=await Promise.allSettled([prepareListingImage(failing),prepareListingImage(new File([png],'valid.png',{type:'image/png'}))]);
    assert.equal(outcomes[0].status,'rejected');assert.equal(outcomes[1].status,'fulfilled');
  } finally {
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});
