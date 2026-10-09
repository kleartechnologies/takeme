import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { isPublicMediaUrl } from "../src/lib/public-media.ts";
import { listingImage } from "../src/lib/listing-media.ts";
import { getPublicHomePage, getPublicProductSnapshot } from "../src/lib/firebase/public-catalogue-server.ts";
import { getPublicListingForMetadata } from "../src/lib/firebase/public-listing-server.ts";
import { buildListingMetadata } from "../src/lib/listing-metadata.ts";
import { finalMediaPrefix, storageMediaUrl, PRODUCTION_MEDIA_BUCKET } from "../functions/src/listing-media-domain.ts";
import { productionEnvironment as prod } from "../functions/src/production-environment.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { releaseProofPrefix } from "../src/lib/release-proof.ts";

const prefix = finalMediaPrefix("seller", "photo", "a".repeat(64));
const media = { imageId: "photo", status: "READY", width: 1200, height: 1600, mime: "image/webp", coverOrder: 0,
  cardPath: prefix + "card.webp", thumbnailPath: prefix + "thumbnail.webp", detailPath: prefix + "detail.webp" };
const detail = storageMediaUrl(PRODUCTION_MEDIA_BUCKET, media.detailPath);
const card = storageMediaUrl(PRODUCTION_MEDIA_BUCKET, media.cardPath);
const legacy = storageMediaUrl(prod.storageBucket, "users/seller/listings/item/photo.webp") + "&token=synthetic-media-token";
const item = { id: "item", sellerId: "seller", title: "Synthetic media", description: "Synthetic test", categoryId: "electronics", condition: "Good", price: 10,
  listingType: "buy_now", status: "active", createdAt: "2026-10-09T00:00:00Z", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" as const },
  imageUrls: [detail], mediaImages: [media] };

test("production public listing sources accept legacy and all three exact dedicated derivatives", () => {
  assert.equal(isPublicMediaUrl(legacy, prod), true);
  for (const size of ["card", "thumbnail", "detail"] as const) assert.equal(isPublicMediaUrl(storageMediaUrl(PRODUCTION_MEDIA_BUCKET, media[`${size}Path`]), prod), true);
  for (const env of [{ ...prod, storageBucket: PRODUCTION_MEDIA_BUCKET }, { ...prod, projectId: "foreign" }, { ...prod, useEmulators: true }, {}])
    assert.equal(isPublicMediaUrl(detail, env), false);
});

test("production rejects foreign buckets, private namespaces and noncanonical derivative URLs", () => {
  const rejected = [
    detail.replace(PRODUCTION_MEDIA_BUCKET, "unknown"), detail.replace(PRODUCTION_MEDIA_BUCKET, "takeme-staging-822a5-media-v1"),
    detail.replace(PRODUCTION_MEDIA_BUCKET, "takeme-staging-822a5.firebasestorage.app"), detail.replace(PRODUCTION_MEDIA_BUCKET, PRODUCTION_MEDIA_BUCKET + ".evil"),
    detail.replace(PRODUCTION_MEDIA_BUCKET, prod.storageBucket), legacy.replace(prod.storageBucket, PRODUCTION_MEDIA_BUCKET),
    storageMediaUrl(PRODUCTION_MEDIA_BUCKET, "users/seller/listing-media-staging/photo/source"),
    storageMediaUrl(PRODUCTION_MEDIA_BUCKET, "users/seller/listings/item/private.webp"),
    storageMediaUrl(PRODUCTION_MEDIA_BUCKET, "users/seller/profile/photo.webp"),
    storageMediaUrl(PRODUCTION_MEDIA_BUCKET, prefix + "source"), storageMediaUrl(PRODUCTION_MEDIA_BUCKET, prefix + "original.jpg"),
    storageMediaUrl(PRODUCTION_MEDIA_BUCKET, prefix.replace("v1-", "v2-") + "card.webp"),
    detail + "&token=unexpected", detail + "&alt=media", detail + "&redirect=/", detail + "#fragment",
    detail.replace("https:", "http:"), detail.replace("https://", "https://user:password@"),
    detail.replace("firebasestorage.googleapis.com", "storage.googleapis.com"), detail.replace("firebasestorage.googleapis.com", "firebasestorage.googleapis.com.evil"),
    detail.replace("%2F", "%252F"), detail.replace("%2F", "/"), detail.replace("seller", "seller%2F.."),
    storageMediaUrl(prod.storageBucket, "users/seller/private/evidence.webp"), storageMediaUrl(prod.storageBucket, "photo.webp"),
    storageMediaUrl(prod.storageBucket, "admin-assets/12345678-abcd-4321-abcd-123456789abc/image.png"),
    "not a URL", detail.replace("users", "%ZZ"),
  ];
  for (const url of rejected) assert.equal(isPublicMediaUrl(url, prod), false, url);
});

test("editorial and avatar namespaces remain separate from listing media", () => {
  const banner = storageMediaUrl(prod.storageBucket, "admin-assets/12345678-abcd-4321-abcd-123456789abc/image.png");
  const avatar = storageMediaUrl(prod.storageBucket, "users/seller/profile/photo.webp") + "&token=synthetic-media-token";
  assert.equal(isPublicMediaUrl(banner, prod, "editorial"), true);
  assert.equal(isPublicMediaUrl(avatar, prod, "avatar"), true);
  const extensionlessAvatar = storageMediaUrl(prod.storageBucket, "users/seller/profile/12345678-abcd-4321-abcd-123456789abc") + "&token=synthetic-media-token";
  assert.equal(isPublicMediaUrl(extensionlessAvatar, prod, "avatar"), true);
  assert.equal(isPublicMediaUrl(extensionlessAvatar, prod), false);
  assert.equal(isPublicMediaUrl(avatar, prod), false);
  assert.equal(isPublicMediaUrl(banner, prod), false);
  assert.equal(isPublicMediaUrl(detail, prod, "editorial"), false);
  assert.equal(isPublicMediaUrl(detail, prod, "avatar"), false);
});

const require = createRequire(import.meta.url);
function loadTsx(file: string, mocks: Record<string, unknown>): Record<string, ComponentType<Record<string, unknown>>> {
  const output = ts.transpileModule(readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
  }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", output)((name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
    throw new Error("Unexpected render dependency: " + name);
  }, testModule, testModule.exports);
  return testModule.exports;
}
const Empty = () => null;
const Link = (p: Record<string, unknown>) => createElement("a", { href: p.href }, p.children as ReactNode);
const Image = (p: Record<string, unknown>) => createElement("img", { src: p.src, alt: p.alt });
const common = { "next/link": Link, "next/image": Image };
const cards = loadTsx("src/components/listings/listing-card.tsx", { ...common,
  "@/lib/listing-media": { listingImage }, "@/components/auth/auth-provider": { useAuth: () => ({ user: null }) },
  "@/components/saved/save-button": { SaveButton: Empty }, "@/components/profile/public-seller-summary": { PublicSellerSummary: Empty },
  "./discovery-card-content": { DiscoveryCardContent: ({ listing }: { listing: typeof item }) => createElement("p", null, listing.title) },
  "@/lib/services/intelligence": {}, "@/lib/services/promotions": {}, "@/lib/auction-presentation": {},
  "@/lib/use-auction-time": { useAuctionTime: () => 0 }, "@/lib/listing-display": { listingCardPrice: () => 10 },
});
const sections = loadTsx("src/components/home/discovery-section.tsx", common);
const home = loadTsx("src/components/home/home-marketplace.tsx", { "./discovery-section": sections,
  "@/components/listings/listing-card": cards, "@/lib/public-catalogue": {}, "@/components/auth/auth-provider": {},
  "@/components/ui/firebase-state": {}, "@/components/ui/states": { ErrorState: ({ message }: { message: string }) => createElement("p", null, message) },
  "@/lib/firebase/client": {}, "@/lib/services/intelligence": {}, "@/lib/services/listings": {},
});

test("production Home/Fresh Finds accepts the dedicated CARD and renders the real listing card", async t => {
  const firebase = { NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "s".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${prod.projectId}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: prod.projectId, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: prod.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "367115645204", NEXT_PUBLIC_FIREBASE_APP_ID: "1:367115645204:web:" + "b".repeat(22) };
  const env = { ...firebase, NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: prod.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_RELEASE_TARGET: "production",
    TAKEME_BUILD_RELEASE_PROOF: releaseProofPrefix + btoa(JSON.stringify({ format: 1, purpose: "production-build", target: "production", projectId: prod.projectId,
      siteUrl: prod.siteUrl, useEmulators: false, firebase, policy: productionReleasePolicy })) };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const homepage = { schemaVersion: 1, version: 1, categories: [], sections: [{ sectionId: "fresh", type: "fresh", title: "Fresh Finds", source: "AUTOMATIC",
    startAt: null, endAt: null, products: [{ id: item.id, title: item.title, price: 10, priceLabel: "Price", imageUrl: card, sellerId: "seller", endAt: null }],
    sellers: [], categories: [], banners: [], announcement: null, cta: null }] };
  let payload: unknown = { listings: [item], homepage };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ result: payload })));
  try {
    Object.assign(process.env, env);
    const page = await getPublicHomePage(); assert.ok(page); assert.deepEqual(page.homepage, homepage);
    const html = renderToStaticMarkup(createElement(home.HomeMarketplace, { initialPage: page }));
    assert.match(html, /Fresh Finds/); assert.match(html, /Synthetic media/); assert.ok(html.includes(card.replaceAll("&", "&amp;")));
    assert.ok(!html.includes("couldn’t be loaded")); assert.ok(!html.includes("listing-media-staging"));
    const parsed = page.listings[0];
    for (const size of ["card", "thumbnail", "detail"] as const) assert.equal(listingImage(parsed, size), storageMediaUrl(PRODUCTION_MEDIA_BUCKET, media[`${size}Path`]));
    payload = { listing: item, bids: [] }; assert.equal((await getPublicProductSnapshot(item.id))?.listing.imageUrls[0], detail);
    assert.equal((await getPublicListingForMetadata(item.id))?.imageUrls?.[0], detail);
    assert.deepEqual(buildListingMetadata(item.id, item, prod.siteUrl).openGraph?.images, [{ url: detail, alt: item.title }]);
    payload = { listings: [{ ...item, imageUrls: [legacy], mediaImages: [] }], homepage: { ...homepage, sections: [] } };
    const old = await getPublicHomePage(); assert.ok(old);
    assert.ok(renderToStaticMarkup(createElement(home.HomeMarketplace, { initialPage: old })).includes(legacy.replaceAll("&", "&amp;")));
    for (const status of ["draft", "removed", "hidden"]) {
      payload = { listings: [{ ...item, status }] }; assert.equal(await getPublicHomePage(), null);
      payload = { listing: { ...item, status } }; assert.equal(await getPublicProductSnapshot(item.id), null);
    }
    for (const url of [detail.replace(PRODUCTION_MEDIA_BUCKET, "unknown"), storageMediaUrl(PRODUCTION_MEDIA_BUCKET, "users/seller/listing-media-staging/photo/source")]) {
      payload = { listings: [{ ...item, imageUrls: [url] }] }; assert.equal(await getPublicHomePage(), null);
      payload = { listing: { ...item, imageUrls: [url] } }; assert.equal(await getPublicProductSnapshot(item.id), null);
      assert.deepEqual((await getPublicListingForMetadata(item.id))?.imageUrls, []);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
