import { test } from "node:test";
import assert from "node:assert/strict";
import { listingImage, parseListingMedia, retainedListingMedia } from "../src/lib/listing-media.ts";
import { finalMediaPrefix, storageMediaUrl } from "../functions/src/listing-media-domain.ts";
const bucket = "demo-takeme.firebasestorage.app", prefix = finalMediaPrefix("owner","one","b".repeat(64));
const media = {imageId:"one",status:"READY",width:1600,height:1200,mime:"image/webp",coverOrder:0,thumbnailPath:prefix+"thumbnail.webp",cardPath:prefix+"card.webp",detailPath:prefix+"detail.webp"};
test("retained draft previews resolve exact owner-bound READY media without replacing canonical URLs", () => {
  const url=storageMediaUrl(bucket,media.detailPath), listing={sellerId:"owner",imageUrls:[url],mediaImages:parseListingMedia([media],"owner")};
  assert.equal(retainedListingMedia(listing,url,"demo-takeme")?.thumbnailPath,media.thumbnailPath);
  assert.deepEqual(listing.imageUrls,[url]);
  for (const candidate of [url+"&token=unexpected",storageMediaUrl(bucket,media.thumbnailPath),"https://example.test/photo.jpg"]) assert.equal(retainedListingMedia({...listing,imageUrls:[candidate]},candidate,"demo-takeme"),null);
  assert.equal(retainedListingMedia({...listing,sellerId:"other"},url,"demo-takeme"),null);
  assert.equal(retainedListingMedia(listing,url,"takeme-52b80"),null);
  assert.equal(retainedListingMedia(listing,url,"unapproved-project"),null);
  assert.equal(retainedListingMedia({...listing,mediaImages:parseListingMedia([{...media,status:"PROCESSING"}],"owner")},url,"demo-takeme"),null);
});
test("Home/Explore cards and small surfaces select bounded variants; detail uses detail",()=>{
  const listing={imageUrls:[storageMediaUrl(bucket,media.detailPath)],mediaImages:parseListingMedia([media],"owner")};
  for(const size of ["thumbnail","card","detail"] as const) assert.equal(listingImage(listing,size),storageMediaUrl(bucket,media[`${size}Path`]));
});
test("legacy listings remain readable; malformed/private media never override legacy URLs",()=>{
  const listing={imageUrls:["https://example.test/legacy.jpg"]};assert.equal(listingImage(listing),listing.imageUrls[0]);
  assert.equal(listingImage({...listing,mediaImages:parseListingMedia([media],"owner")}),listing.imageUrls[0]);
  assert.deepEqual(parseListingMedia([{...media,cardPath:"users/owner/listing-media-staging/one/source"}],"owner"),[]);
  assert.deepEqual(parseListingMedia([media],"other"),[]);
});
test("local canonical variants resolve only to an explicitly pinned demo emulator",()=>{
  const previous=[process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID];
  try {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS="true";process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-takeme";
    const listing={imageUrls:[storageMediaUrl(bucket,media.detailPath)],mediaImages:parseListingMedia([media],"owner")};
    assert.equal(listingImage(listing,"card"),storageMediaUrl(bucket,media.cardPath).replace("https://firebasestorage.googleapis.com","http://127.0.0.1:9199"));
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID="takeme-52b80";
    assert.equal(listingImage(listing,"card"),storageMediaUrl(bucket,media.cardPath));
  } finally {
    for(const [i,name] of ["NEXT_PUBLIC_USE_FIREBASE_EMULATORS","NEXT_PUBLIC_FIREBASE_PROJECT_ID"].entries()) {
      if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];
    }
  }
});

test("public-first catalogue projection preserves only owner-bound READY derivatives", async () => {
  const { parsePublicCatalogueListing } = await import("../src/lib/public-catalogue.ts");
  const item = { id: "listing", sellerId: "owner", title: "Sample", description: "Sample listing", categoryId: "home", condition: "Good", price: 10, listingType: "buy_now", status: "active", publicLocation: { districtOrCity: "Petaling Jaya", state: "Selangor", country: "Malaysia" }, createdAt: "2026-10-08T00:00:00Z", imageUrls: [storageMediaUrl(bucket, media.detailPath)], mediaImages: [{...media, rawPath: "private-input", sourceMetadata: "private"}] };
  const parsed = parsePublicCatalogueListing(item);
  assert.ok(parsed);
  assert.equal(listingImage(parsed, "card"), storageMediaUrl(bucket, media.cardPath));
  assert.equal(JSON.stringify(parsed).includes("private-input"), false);
  assert.equal(JSON.stringify(parsed).includes("sourceMetadata"), false);
  assert.deepEqual(parsePublicCatalogueListing({...item, sellerId: "another"})?.mediaImages, []);
  assert.deepEqual(parsePublicCatalogueListing({...item, mediaImages: [{...media, status: "PROCESSING"}]})?.mediaImages, []);
  assert.deepEqual(parsePublicCatalogueListing({...item, mediaImages: undefined})?.mediaImages, []);
});

test("isolated staging derivatives use only the owner-approved media bucket", async () => {
  const {listingMediaBucket, STAGING_MEDIA_BUCKET} = await import("../functions/src/listing-media-domain.ts");
  const {isStagingMediaUrl, isStagingEditorialAssetUrl} = await import("../src/lib/firebase/staging-isolation.ts");
  assert.equal(listingMediaBucket("takeme-staging-822a5"), STAGING_MEDIA_BUCKET);
  assert.equal(listingMediaBucket("takeme-52b80"), "takeme-52b80-media-v1");
  assert.equal(listingMediaBucket("demo-takeme"), bucket);
  assert.throws(() => listingMediaBucket("unreviewed-project"));
  const valid = storageMediaUrl(STAGING_MEDIA_BUCKET, media.detailPath);
  assert.equal(isStagingMediaUrl(valid), true);
  assert.equal(isStagingEditorialAssetUrl(valid), false);
  for (const path of ["admin-assets/id/image.png", "users/owner/profile/photo.webp", "users/owner/listing-media-staging/one/source", media.detailPath.replace("v1-", "v2-")]) assert.equal(isStagingMediaUrl(storageMediaUrl(STAGING_MEDIA_BUCKET, path)), false);
  assert.equal(isStagingMediaUrl(valid + "&token=not-allowed"), false);
  assert.equal(isStagingMediaUrl(valid.replace(STAGING_MEDIA_BUCKET, "takeme-52b80.firebasestorage.app")), false);
  assert.equal(listingImage({imageUrls:[valid],mediaImages:parseListingMedia([media],"owner")},"card"),storageMediaUrl(STAGING_MEDIA_BUCKET,media.cardPath));
});

test("prepared production derivatives use the dedicated bucket while app identity and legacy readers stay unchanged", async () => {
  const {PRODUCTION_MEDIA_BUCKET} = await import("../functions/src/listing-media-domain.ts");
  const url = storageMediaUrl(PRODUCTION_MEDIA_BUCKET, media.detailPath), listing = {sellerId:"owner",imageUrls:[url],mediaImages:parseListingMedia([media],"owner")};
  assert.equal(retainedListingMedia(listing,url,"takeme-52b80")?.imageId,"one");
  assert.equal(listingImage(listing,"card"),storageMediaUrl(PRODUCTION_MEDIA_BUCKET,media.cardPath));
  const legacy = {imageUrls:[storageMediaUrl("takeme-52b80.firebasestorage.app","listings/legacy/image.jpg")]};
  assert.equal(listingImage(legacy,"card"),legacy.imageUrls[0]);
});
