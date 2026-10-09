const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseMediaInput, readyMedia, orderedReadyMedia, finalMediaPrefix, rawMediaPath, MAX_MEDIA_BYTES } = require("../lib/listing-media-domain");
const digest = "a".repeat(64);
const input = { imageId: "one", digest, contentType: "image/jpeg", sizeBytes: 1200 };
const image = id => ({ imageId: id, status: "READY", width: 1600, height: 1200, mime: "image/webp", ...Object.fromEntries(["thumbnail","card","detail"].map(n=>[`${n}Path`,finalMediaPrefix("owner",id,digest)+`${n}.webp`])) });
test("raw inputs are byte bounded and never use public listing paths",()=>{
  for(const type of ["image/jpeg","image/png","image/webp","image/avif"]) assert.equal(parseMediaInput({...input,contentType:type}).contentType,type);
  for(const v of [{...input,contentType:"image/heic"},{...input,contentType:"image/heif"},{...input,sizeBytes:0},{...input,sizeBytes:MAX_MEDIA_BYTES+1},{...input,contentType:"image/svg+xml"},{...input,imageId:"../raw"},{...input,digest:"no"},{...input,uid:"other"}]) assert.throws(()=>parseMediaInput(v));
  assert.equal(rawMediaPath("owner","one"),"users/owner/listing-media-staging/one/source");
});
test("only exact owner-bound complete WebP variants qualify",()=>{
  assert.ok(readyMedia(image("one"),"owner"));
  for(const value of [{...image("one"),status:"PROCESSING"},{...image("one"),cardPath:"users/other/image.webp"},{...image("one"),width:99999},{...image("one"),detailPath:"https://example.test/a"},{...image("one"),thumbnailPath:rawMediaPath("owner","one")}]) assert.equal(readyMedia(value,"owner"),null);
});
test("completion order cannot change cover order; partial failures block retained batch",()=>{
  assert.deepEqual(orderedReadyMedia(["two","one"],{one:image("one"),two:image("two")},"owner").map(v=>v.imageId),["two","one"]);
  for(const ids of [[],["one","one"],Array(9).fill("one"),["one","failed"]]) assert.throws(()=>orderedReadyMedia(ids,{one:image("one"),failed:{status:"FAILED"}},"owner"));
  assert.equal(orderedReadyMedia(["one"],{one:image("one")},"owner").length,1);
});

test("codec admission is bounded to 32/hour, prunes old timestamps and rejects corrupt quota", () => {
  const {mediaAdmission}=require("../lib/listing-media-domain.js");
  assert.equal(mediaAdmission(Array(31).fill(4000000),4000001).length,32);
  assert.throws(()=>mediaAdmission(Array(32).fill(4000000),4000001));
  assert.deepEqual(mediaAdmission([1],4000001),[4000001]);
  for(const bad of ["wrong",[-1],[NaN],[5000000]])assert.throws(()=>mediaAdmission(bad,4000001));
});

test("dedicated media buckets preserve the default legacy Firebase identity",()=>{
  const {listingMediaBucket,STAGING_MEDIA_BUCKET}=require("../lib/listing-media-domain");
  assert.equal(listingMediaBucket("takeme-staging-822a5"),STAGING_MEDIA_BUCKET);
  assert.equal(listingMediaBucket("takeme-52b80"),"takeme-52b80-media-v1");
  assert.equal(listingMediaBucket("demo-takeme"),"demo-takeme.firebasestorage.app");
  assert.throws(()=>listingMediaBucket("arbitrary"));
});
