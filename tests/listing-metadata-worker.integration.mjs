import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse, convertV4MiniflareOptions } from "miniflare";
import { stagingEnvironment as staging } from "../functions/src/staging-environment.ts";
import { releaseProofPrefix } from "../src/lib/release-proof.ts";

// Only fabricated public-format SDK fields. The harness does not read local
// config, credentials, Firebase or Cloudflare; all outbound traffic is intercepted.
const firebase = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "s".repeat(35),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: staging.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: staging.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: staging.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: staging.projectNumber,
  NEXT_PUBLIC_FIREBASE_APP_ID: `1:${staging.projectNumber}:web:${"b".repeat(22)}`,
};
const env = {
  ...firebase, NODE_ENV: "production", TAKEME_RELEASE_TARGET: "staging",
  NEXT_PUBLIC_SITE_URL: staging.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
  TAKEME_OFFLINE_QUALIFICATION: "false",
  TAKEME_BUILD_RELEASE_PROOF: releaseProofPrefix + btoa(JSON.stringify({
    format: 1, purpose: "staging-preview", target: "staging", projectId: staging.projectId,
    siteUrl: staging.siteUrl, useEmulators: false, firebase,
    policy: { publicationApproved: true, termsVersion: staging.policyVersion, privacyVersion: staging.policyVersion, minimumAge: 18 },
  })),
};
const endpoint = `https://asia-southeast1-${staging.projectId}.cloudfunctions.net/getPublicListingDetail`;
const image = `https://firebasestorage.googleapis.com/v0/b/${staging.storageBucket}/o/synthetic%2Fphoto.png?alt=media&token=synthetic-media-token`;
const projection = { status: "active", title: "Synthetic Worker item", price: 25, description: "Synthetic private contact text is not preview content.",
  publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, imageUrls: [image] };
const bundled = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
    contents: `
      import { getPublicListingForMetadata } from "./src/lib/firebase/public-listing-server.ts";
      import { buildListingMetadata } from "./src/lib/listing-metadata.ts";
      export default { async fetch(request) {
        const id = new URL(request.url).pathname.slice(1);
        if (id === "unsupported-error-mode") {
          try { new Request(${JSON.stringify(endpoint)}, { redirect: "error" }); return Response.json({ rejected: false }); }
          catch { return Response.json({ rejected: true }); }
        }
        const listing = await getPublicListingForMetadata(id);
        return Response.json({ listing, metadata: buildListingMetadata(id, listing, process.env.NEXT_PUBLIC_SITE_URL) });
      } };
    `,
  },
  define: Object.fromEntries(Object.entries(env).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])),
  bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
});
const outboundIds = [];
const runtime = new Miniflare(convertV4MiniflareOptions({
  script: bundled.outputFiles[0].text, modules: true, cf: false,
  telemetry: { enabled: false },
  compatibilityDate: "2026-10-03", compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
  outboundService: async request => {
    // Any accidental foreign-project or redirect follow fails before network IO.
    assert.equal(request.url, endpoint);
    assert.equal(request.method, "POST");
    const { data } = await request.json();
    outboundIds.push(data.listingId);
    if (data.listingId === "valid") return WorkerResponse.json({ result: { listing: projection } });
    if (data.listingId === "missing") return WorkerResponse.json({ result: { listing: null } });
    if (data.listingId === "not-found") return new WorkerResponse(null, { status: 404 });
    if (data.listingId === "invalid-json") return new WorkerResponse("not-json");
    const redirect = /^redirect-(301|302|303|307|308)-(expected|foreign)$/.exec(data.listingId);
    assert.ok(redirect, "Only bounded synthetic fixture requests are supported.");
    return new WorkerResponse(null, { status: Number(redirect[1]), headers: {
      Location: redirect[2] === "expected" ? endpoint : "https://untrusted.example.test/redirected-listing",
    } });
  },
}));

try {
  const response = await runtime.dispatchFetch("http://localhost/valid");
  assert.equal(response.status, 200);
  const valid = await response.json();
  assert.equal(valid.listing.title, projection.title);
  assert.deepEqual(valid.metadata.title, { absolute: "Synthetic Worker item — RM25 | TAKEME" });
  assert.equal(valid.metadata.openGraph.title, "Synthetic Worker item — RM25 | TAKEME");
  assert.deepEqual(valid.metadata.openGraph.images, [{ url: image, alt: projection.title }]);
  assert.deepEqual(valid.metadata.robots, { index: false, follow: false });
  assert.ok(!JSON.stringify(valid.metadata).includes(projection.description));
  let rejected = 0;
  for (const id of ["missing", "not-found", "invalid-json", ...[301, 302, 303, 307, 308].flatMap(status => [`redirect-${status}-expected`, `redirect-${status}-foreign`])]) {
    const result = await (await runtime.dispatchFetch(`http://localhost/${id}`)).json();
    assert.equal(result.listing, null);
    assert.deepEqual(result.metadata.title, { absolute: "Listing unavailable | TAKEME" });
    assert.deepEqual(result.metadata.robots, { index: false, follow: false });
    rejected++;
  }
  assert.equal(outboundIds.length, 14);
  const unsupported = await (await runtime.dispatchFetch("http://localhost/unsupported-error-mode")).json();
  assert.equal(unsupported.rejected, true, "The workerd regression must exercise its unsupported redirect:error mode.");
  console.log(`Worker metadata: valid product/social preview passed; ${rejected} unavailable/redirect cases rejected; no external network IO.`);
} finally {
  await runtime.dispose();
}
