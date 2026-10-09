import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { normalize, sniff, hash } from "../normalize.mjs";

const pixels = sharp({create:{width:1200,height:800,channels:4,background:{r:35,g:120,b:220,alpha:0.5}}});
test("all web formats decode, resize proportionally and strip metadata",async()=>{
  for(const format of ["jpeg","png","webp","avif"]){
    const bytes = format === "avif" ? await readFile(process.env.TAKEME_AVIF_FIXTURE || "/fixtures/synthetic.avif") : await pixels.clone().toFormat(format).toBuffer(), result=await normalize(bytes,hash(bytes));
    assert.deepEqual(Object.values(result.variants).map(v=>[v.width,v.height]),[[400,267],[800,533],[1200,800]]);
    for(const variant of Object.values(result.variants)){const m=await sharp(variant.bytes).metadata();assert.equal(m.format,"webp");assert.equal(m.exif,undefined);assert.equal(m.xmp,undefined);assert.equal(m.icc,undefined);assert.equal(m.orientation,undefined);}
  }
});
test("real synthetic GPS/EXIF input is present and absent from every output; orientation fixed",async()=>{
  const bytes=await pixels.clone().jpeg().withExif({IFD0:{Orientation:"6",Make:"Synthetic camera"},IFD3:{GPSLatitudeRef:"N",GPSLatitude:"1/1 2/1 3/1",GPSLongitudeRef:"E",GPSLongitude:"4/1 5/1 6/1"}}).withMetadata({orientation:6}).toBuffer();
  const before=await sharp(bytes).metadata();assert.equal(before.orientation,6);assert.ok(before.exif);assert.ok(before.exif.includes(Buffer.from("Synthetic camera")));
  // GPS IFD tag 0x8825 is actually embedded, not just an assumed test description.
  assert.ok(before.exif.includes(Buffer.from([0x25,0x88])) || before.exif.includes(Buffer.from([0x88,0x25])));
  const result=await normalize(bytes);assert.equal(result.width,800);assert.equal(result.height,1200);
  for(const v of Object.values(result.variants))assert.equal((await sharp(v.bytes).metadata()).exif,undefined);
});
test("reject nonimages, corrupt payloads, zero bytes, excessive dimensions and digest mismatch",async()=>{
  for(const b of [Buffer.alloc(0),Buffer.from("not an image.jpg"),Buffer.from([255,216,255,...Array(20).fill(0)]),Buffer.from("0000ftypheic000000000000")])await assert.rejects(normalize(b));
  const valid=await pixels.clone().png().toBuffer();await assert.rejects(normalize(valid,"b".repeat(64)));
  const huge=Buffer.from(valid);huge.writeUInt32BE(100000,16);await assert.rejects(normalize(huge));
  assert.throws(()=>sniff(Buffer.from("<svg width='20'/>")));
});
test("12MP source is limited to 1600 long edge; small transparent image is never upscaled",async()=>{
  const large=await sharp({create:{width:4000,height:3000,channels:3,background:"#b34512"}}).jpeg().toBuffer();
  assert.equal((await normalize(large)).variants.detail.width,1600);
  const small=await sharp({create:{width:80,height:40,channels:4,background:{r:20,g:20,b:20,alpha:0.5}}}).png().toBuffer();const result=await normalize(small);
  for(const v of Object.values(result.variants)){assert.equal(v.width,80);assert.equal((await sharp(v.bytes).metadata()).hasAlpha,true);}
});

// Expat parses native VIPS/XML headers, which are outside the upload format
// allowlist. Do not expand sniffing to arbitrary libvips-supported formats.
test("native VIPS and XML inputs cannot reach the XML parser",async()=>{
  for(const bytes of [Buffer.concat([Buffer.from([0xb6,0xa6,0xf2,0x08]),Buffer.alloc(256)]),Buffer.from("<?xml version='1.0'?><image/>"),Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")]) {
    assert.throws(()=>sniff(bytes),/unsupported-input/);
    await assert.rejects(normalize(bytes),/unsupported-input/);
  }
});

test("V1 has no HEIF loader; raw HEIC/HEIF and falsely declared MIME never produce derivatives", async () => {
  assert.equal(sharp.versions.heif, undefined);
  assert.equal(sharp.format.heif.input.buffer, false);
  const jpeg = await pixels.clone().jpeg().toBuffer();
  await assert.rejects(normalize(jpeg, hash(jpeg), "image/png"), /mime-mismatch/);
  await normalize(jpeg, hash(jpeg), "image/jpeg");
  for (const brand of ["heic", "heix", "mif1", "hevc", "hevx", "avis", "msf1"]) {
    const bytes = Buffer.alloc(24); bytes.writeUInt32BE(24, 0); bytes.write("ftyp", 4); bytes.write(brand, 8); bytes.write(brand, 16);
    await assert.rejects(normalize(bytes), /unsupported|sequence/);
  }
});
test("malformed PNG/WebP/AVIF cannot escape the bounded supported parsers", async () => {
  for (const format of ["png", "webp"]) {
    const bytes = await pixels.clone().toFormat(format).toBuffer();
    const broken = bytes.subarray(0, 20);
    await assert.rejects(normalize(broken));
  }
  const avif = await readFile(process.env.TAKEME_AVIF_FIXTURE || "/fixtures/synthetic.avif");
  await assert.rejects(normalize(avif.subarray(0, 64)));
});

test("AV1-only input applies AVIF rotation and retains alpha before stripping output metadata", async () => {
  const bytes = await readFile(process.env.TAKEME_AVIF_ORIENTATION_FIXTURE || "/fixtures/v1-avif-orientation.avif");
  const result = await normalize(bytes);
  assert.equal(result.width, 80); assert.equal(result.height, 120);
  for (const v of Object.values(result.variants)) { const m = await sharp(v.bytes).metadata(); assert.equal(m.hasAlpha, true); assert.equal(m.exif, undefined); assert.equal(m.orientation, undefined); }
});
