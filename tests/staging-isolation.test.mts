import assert from "node:assert/strict";
import test from "node:test";
import { stagingEnvironment } from "../functions/src/staging-environment.ts";
import { releaseProofPrefix } from "../src/lib/release-proof.ts";
import { assertFirebaseAppIdentity, firebaseAppIdentityMatches, isStagingMediaUrl, metadataEndpoint, type MetadataEnvironment } from "../src/lib/firebase/staging-isolation.ts";
import { getPublicListingForMetadata } from "../src/lib/firebase/public-listing-server.ts";
import { buildListingMetadata } from "../src/lib/listing-metadata.ts";

// Fabricated public-format configuration only. No registered SDK values or credentials.
function fixture() {
  const firebase = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "s".repeat(35),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: stagingEnvironment.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: stagingEnvironment.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: stagingEnvironment.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: stagingEnvironment.projectNumber,
    NEXT_PUBLIC_FIREBASE_APP_ID: `1:${stagingEnvironment.projectNumber}:web:${"b".repeat(22)}`,
  };
  const proof = {
    format: 1, purpose: "staging-preview", target: "staging", projectId: stagingEnvironment.projectId,
    siteUrl: stagingEnvironment.siteUrl, useEmulators: false, firebase,
    policy: { publicationApproved: true, termsVersion: stagingEnvironment.policyVersion, privacyVersion: stagingEnvironment.policyVersion, minimumAge: 18 },
  };
  const encode = (value: unknown) => releaseProofPrefix + btoa(JSON.stringify(value));
  const env: MetadataEnvironment = { ...firebase, NODE_ENV: "production", TAKEME_RELEASE_TARGET: "staging",
    NEXT_PUBLIC_SITE_URL: stagingEnvironment.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_BUILD_RELEASE_PROOF: encode(proof) };
  return { env, proof, encode };
}

const stageImage = `https://firebasestorage.googleapis.com/v0/b/${stagingEnvironment.storageBucket}/o/users%2Ftest-seller%2Flistings%2Ftest-listing%2Fphoto.png?alt=media&token=synthetic-media-token`;
const productionImage = "https://firebasestorage.googleapis.com/v0/b/takeme-52b80.firebasestorage.app/o/photo.png?alt=media&token=synthetic-media-token";

test("reused Firebase SDK apps must match all six actual identity fields", () => {
  const { env } = fixture();
  const config = { apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID };
  assert.equal(firebaseAppIdentityMatches({ ...config }, config), true);
  assert.doesNotThrow(() => assertFirebaseAppIdentity(config, config));
  for (const key of Object.keys(config)) {
    const other = { ...config, [key]: "foreign-app-value" };
    assert.equal(firebaseAppIdentityMatches(other, config), false);
    assert.throws(() => assertFirebaseAppIdentity(other, config), error => error instanceof Error
      && error.message === "Firebase app identity does not match this build." && !error.message.includes("foreign-app-value"));
  }
  assert.equal(firebaseAppIdentityMatches({}, {}), false);
});

test("staging metadata endpoint requires a matching staging proof and exact resources", () => {
  const { env, proof, encode } = fixture();
  assert.equal(metadataEndpoint(env), `https://asia-southeast1-${stagingEnvironment.projectId}.cloudfunctions.net/getPublicListingDetail`);
  const wrongProofs = [{ ...proof, purpose: "release" }, { ...proof, target: "production" }, { ...proof, projectId: "takeme-52b80" },
    { ...proof, siteUrl: "https://takeme.my" }, { ...proof, policy: { ...proof.policy, termsVersion: "1.0-draft" } }];
  for (const value of wrongProofs) assert.equal(metadataEndpoint({ ...env, TAKEME_BUILD_RELEASE_PROOF: encode(value) }), null);
  for (const changes of [{ TAKEME_BUILD_RELEASE_PROOF: undefined }, { TAKEME_BUILD_RELEASE_PROOF: "invalid" },
    { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_RELEASE_TARGET: "demo" }, { TAKEME_RELEASE_TARGET: "unknown" },
    { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "takeme-52b80.firebaseapp.com" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app" }, { NEXT_PUBLIC_FIREBASE_API_KEY: "another-api-key" },
    { NEXT_PUBLIC_SITE_URL: "https://takeme.my" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" },
    { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: undefined }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "unknown" }, { TAKEME_OFFLINE_QUALIFICATION: "true" }]) {
    assert.equal(metadataEndpoint({ ...env, ...changes }), null);
  }
  assert.equal(metadataEndpoint({ NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-takeme" }),
    "http://127.0.0.1:5001/demo-takeme/asia-southeast1/getPublicListingDetail");
  const liveProject = "marketplace-release";
  const liveFirebase = { ...proof.firebase, NEXT_PUBLIC_FIREBASE_PROJECT_ID: liveProject,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${liveProject}.firebaseapp.com`, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${liveProject}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012", NEXT_PUBLIC_FIREBASE_APP_ID: `1:123456789012:web:${"b".repeat(22)}` };
  const liveProof = { ...proof, target: "production", purpose: "release", projectId: liveProject, siteUrl: "https://takeme.my", firebase: liveFirebase,
    policy: { ...proof.policy, termsVersion: "1.0-approved", privacyVersion: "1.0-approved" } };
  assert.equal(metadataEndpoint({ ...env, ...liveFirebase, TAKEME_RELEASE_TARGET: "production", NEXT_PUBLIC_SITE_URL: "https://takeme.my", TAKEME_BUILD_RELEASE_PROOF: encode(liveProof) }),
    `https://asia-southeast1-${liveProject}.cloudfunctions.net/getPublicListingDetail`);
});

async function withEnvironment<T>(env: MetadataEnvironment, operation: () => Promise<T>) {
  const keys = [...new Set([...Object.keys(fixture().env), "TAKEME_OFFLINE_QUALIFICATION"])];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  try { return await operation(); }
  finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
}

test("rejected production or mismatched staging metadata never invokes fetch", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Unexpected network request"); });
  const { env } = fixture();
  for (const change of [{ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "takeme-52b80.firebasestorage.app" },
    { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_RELEASE_TARGET: "unknown" },
    { TAKEME_BUILD_RELEASE_PROOF: undefined }, { NEXT_PUBLIC_SITE_URL: "https://takeme.my" },
    { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "unknown" }]) {
    await withEnvironment({ ...env, ...change }, async () => assert.equal(await getPublicListingForMetadata("owned-stage-listing"), null));
  }
  assert.equal(calls, 0);
});

test("qualified staging metadata fetches only its callable and filters foreign media", async t => {
  const { env } = fixture();
  const requests: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ result: { listing: { status: "active", title: "Synthetic item", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, imageUrls: [productionImage, stageImage] } } }), { status: 200 });
  });
  const listing = await withEnvironment(env, () => getPublicListingForMetadata("owned-stage-listing"));
  assert.deepEqual(listing?.imageUrls, [stageImage]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `https://asia-southeast1-${stagingEnvironment.projectId}.cloudfunctions.net/getPublicListingDetail`);
  assert.equal(requests[0].init?.cache, "no-store");
  assert.equal(requests[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { data: { listingId: "owned-stage-listing" } });
  assert.equal(requests[0].init?.redirect, "manual");
  const metadata = buildListingMetadata("owned-stage-listing", listing, stagingEnvironment.siteUrl);
  assert.deepEqual(metadata.title, { absolute: "Synthetic item | TAKEME" });
  assert.equal(metadata.openGraph?.title, "Synthetic item | TAKEME");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("staging metadata rejects every redirect without following even an expected destination", async t => {
  const { env } = fixture();
  const endpoint = metadataEndpoint(env)!;
  let calls = 0;
  for (const destination of [endpoint, "https://untrusted.example.test/listing", "https://asia-southeast1-takeme-52b80.cloudfunctions.net/getPublicListingDetail"]) {
    for (const status of [301, 302, 303, 307, 308]) {
      t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
        calls++;
        assert.equal(url, endpoint);
        assert.equal(init?.redirect, "manual");
        return new Response(null, { status, headers: { Location: destination } });
      });
      const listing = await withEnvironment(env, () => getPublicListingForMetadata("owned-stage-listing"));
      assert.equal(listing, null);
      assert.deepEqual(buildListingMetadata("owned-stage-listing", listing, stagingEnvironment.siteUrl).robots, { index: false, follow: false });
    }
  }
  assert.equal(calls, 15);
});

test("missing, private, failed and malformed staging metadata responses remain unavailable", async t => {
  const { env } = fixture();
  for (const [status, body] of [[404, {}], [403, {}], [503, {}], [200, { result: { listing: null } }],
    [200, { result: { listing: { status: "draft", title: "Private draft" } } }],
    [200, { result: { listing: { status: "active", title: "Invalid projection" } } }], [200, "invalid-json"]] as const) {
    t.mock.method(globalThis, "fetch", async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
    const listing = await withEnvironment(env, () => getPublicListingForMetadata("missing-stage-listing"));
    assert.equal(listing, null);
    const metadata = buildListingMetadata("missing-stage-listing", listing, stagingEnvironment.siteUrl);
    assert.deepEqual(metadata.title, { absolute: "Listing unavailable | TAKEME" });
    assert.deepEqual(metadata.robots, { index: false, follow: false });
  }
});

test("staging media and social previews reject foreign buckets, hosts and redirect-like queries", () => {
  assert.equal(isStagingMediaUrl(stageImage), true);
  for (const value of [productionImage, stageImage.replace(stagingEnvironment.storageBucket, "foreign-staging.firebasestorage.app"),
    stageImage.replace("https:", "http:"), stageImage.replace("firebasestorage.googleapis.com", "firebasestorage.googleapis.com.evil.invalid"),
    stageImage.replace("https://", "https://user:password@"), stageImage + "&redirect=https://takeme.my", stageImage + "&token=duplicate", stageImage + "#fragment",
    "https://takeme.my/image.png", "https://example.invalid/image.png"]) assert.equal(isStagingMediaUrl(value), false);
  const base = { status: "active", title: "Synthetic item", description: "", imageUrls: [productionImage] };
  const fallback = buildListingMetadata("stage-item", base, stagingEnvironment.siteUrl);
  assert.deepEqual(fallback.openGraph?.images, [{ url: `${stagingEnvironment.siteUrl}/brand/takeme-app-icon.png`, alt: base.title }]);
  assert.deepEqual(fallback.robots, { index: false, follow: false });
  assert.ok(!JSON.stringify(fallback).includes("takeme.my"));
  const valid = buildListingMetadata("stage-item", { ...base, imageUrls: [productionImage, stageImage] }, stagingEnvironment.siteUrl);
  assert.deepEqual(valid.openGraph?.images, [{ url: stageImage, alt: base.title }]);
  assert.deepEqual(buildListingMetadata("production-item", base, "https://takeme.my").openGraph?.images, [{ url: productionImage, alt: base.title }]);
});
