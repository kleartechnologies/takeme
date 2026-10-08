import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { accountGateState, protectedActionDestination, isPublicMarketplaceRoute } from "../src/lib/auth-routing.ts";
import { parsePublicCatalogueListing, parsePublicCataloguePage, parseAnonymousBids } from "../src/lib/public-catalogue.ts";
const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const listing = { id: "public-item", sellerId: "seller", title: "Camera", description: "Working camera", categoryId: "legacy-camera", condition: "Good", price: 100, listingType: "buy_now", status: "active", publicLocation: { districtOrCity: "Jitra", state: "Kedah", country: "Malaysia" }, imageUrls: ["https://firebasestorage.googleapis.com/v0/b/test/o/photo"], createdAt: "2026-10-08T00:00:00Z" };

test("only explicit public routes retain their tree throughout auth/account boot and transient lookup failure", () => {
  for (const path of ["/", "/explore", "/categories", "/for-you", "/listings/item", "/sellers/member", "/help/tiers"]) {
    assert.equal(isPublicMarketplaceRoute(path), true);
    for (const loading of [true, false]) for (const signedIn of [true, false]) for (const error of [true, false]) {
      assert.equal(accountGateState(path, loading, signedIn, null, error), "render");
    }
    for (const step of ["acceptance", "profile", "welcome", "ready"] as const) {
      assert.equal(accountGateState(path, false, true, { step, policyAvailable: false }, false), "render");
    }
    assert.equal(accountGateState(path, false, true, { step: "deletion" }, false), "redirect");
  }
});

test("private routes do not acquire public exemptions or flash during boot/account failure", () => {
  for (const path of ["/profile", "/profile/settings", "/sell", "/saved", "/updates", "/messages/private", "/listings/item/edit", "/listings/item/promote", "/unknown"]) {
    assert.equal(isPublicMarketplaceRoute(path), false);
    assert.equal(accountGateState(path, true, false, null, false), "checking");
    assert.equal(accountGateState(path, false, true, null, false), "checking");
    assert.equal(accountGateState(path, false, true, null, true), "error");
  }
  for (const step of ["acceptance", "profile", "welcome"] as const) assert.equal(accountGateState("/sell", false, true, { step, policyAvailable: true }, false), "redirect");
  assert.equal(accountGateState("/sell", false, true, { step: "ready", policyAvailable: true }, false), "render");
  assert.equal(accountGateState("/messages/existing", false, true, { step: "deletion" }, false), "render");
});

test("public visibility never authorizes protected actions or loses explicit return context", () => {
  for (const path of ["/sell", "/listings/item?offer=1", "/messages/chat", "/listings/auction?bid=1", "/saved", "/sellers/member"]) {
    assert.match(protectedActionDestination(false, null, path)!, /^\/login\?next=/);
    for (const state of [null, { step: "ready" as const, policyAvailable: false }, { step: "acceptance" as const, policyAvailable: true }]) assert.match(protectedActionDestination(true, state, path)!, /^\/onboarding\/acceptance\?next=/);
    assert.equal(protectedActionDestination(true, { step: "deletion" }, path), "/account-deletion");
    assert.equal(protectedActionDestination(true, { step: "ready", policyAvailable: true }, path), null);
  }
  const provider = source("src/components/auth/auth-provider.tsx");
  assert.match(provider, /checking.current \|\| loading/);
  assert.match(provider, /await assertProtectedWritesAvailable\(\)/);
  assert.match(provider, /auth\?\.currentUser\?\.uid !== uid/);
  assert.match(provider, /await refreshSetup\(\)/);
});

test("public DTO drops all unknown/private fields, including participant identities and unsafe location", () => {
  const parsed = parsePublicCatalogueListing({ ...listing, address: "private", currentBidderId: "private", winnerId: "private", saved: true, eligibility: { eligible: true }, sellerEmail: "private", location: "private street" });
  assert.ok(parsed);
  assert.equal(parsed.location, "Jitra, Kedah");
  for (const key of ["address", "currentBidderId", "winnerId", "saved", "eligibility", "sellerEmail"]) assert.equal(key in parsed, false);
  for (const status of ["draft", "removed", "hidden"]) assert.equal(parsePublicCatalogueListing({ ...listing, status }), null);
  assert.equal(parsePublicCatalogueListing({ ...listing, publicLocation: { ...listing.publicLocation, districtOrCity: "Jalan Private" } }), null);
  assert.equal(parsePublicCataloguePage({ listings: Array(9).fill(listing) }), null);
  assert.equal(parsePublicCataloguePage({ listings: [{ ...listing, status: "ended" }] }), null);
  assert.deepEqual(parsePublicCataloguePage({ listings: [], private: "secret" }), { listings: [], cursor: null, hasMore: false });
});

test("public auction DTO retains fresh prices/dates but anonymous bids never claim private identity", () => {
  const auction = parsePublicCatalogueListing({ ...listing, listingType: "auction", auctionStatus: "ended", startingBid: 100, currentBid: 200, bidCount: 2, finalBid: 200, auctionEndAt: listing.createdAt });
  assert.equal(auction?.finalBid, 200); assert.equal(auction?.auctionEndAt, listing.createdAt);
  assert.deepEqual(parseAnonymousBids([{ amount: 200, createdAt: listing.createdAt, isOwnBid: true, bidderId: "secret" }]), [{ amount: 200, createdAt: listing.createdAt, isOwnBid: false }]);
  assert.deepEqual(parseAnonymousBids([{ amount: -1, createdAt: listing.createdAt }]), []);
});

test("Home's public first row is independent of Auth and recommendation failure; retries stay anonymous", () => {
  const shell = source("src/app/page.tsx");
  assert.match(shell, /<EndingSoonMarketplace \/><FeaturedMarketplace \/><PersonalizedMarketplace \/>/);
  const home = source("src/components/home/home-marketplace.tsx");
  const primary = home.slice(home.indexOf("export function HomeMarketplace("), home.indexOf("export function HomeMarketplaceSkeleton"));
  assert.doesNotMatch(primary, /useAuth|getHomeRecommendations|getActiveListings/);
  assert.match(primary, /credentials: "omit"/);
  const secondary = home.slice(home.indexOf("export function PersonalizedMarketplace"), home.indexOf("export function NearYouMarketplace"));
  assert.match(secondary, /setup\?\.step === "ready" && setup.policyAvailable === true/);
  assert.match(secondary, /result\?\.uid === uid/);
  assert.match(secondary, /catch\(\(\) => \{\}\)/);
  const reader = source("src/lib/firebase/public-catalogue-server.ts");
  assert.doesNotMatch(reader, /firebase\/auth|firebase\/functions|firebase\/storage|cookies\(|headers\(/);
  assert.match(reader, /redirect: "manual"/);
  assert.match(reader, /cache: "no-store"/);
  assert.match(reader, /filters: \{ sort: "newest", pageSize: 8 \}/);
});

test("Product server snapshot is request-scoped; auth boot never restarts public primary subscription", () => {
  assert.match(source("src/lib/firebase/public-catalogue-server.ts"), /getPublicProductSnapshot = cache\(/);
  const detail = source("src/components/listings/listing-detail-view.tsx");
  assert.match(detail, /\[id, initialListing, initialBids, privateViewer, retry\]/);
  assert.doesNotMatch(detail, /key=\{`\$\{listing.id\}:\$\{user/);
  assert.match(detail, /\["draft", "removed"\].includes\(state.listing.status\) && state.listing.sellerId !== privateViewer/);
  const service = source("src/lib/services/listings.ts");
  assert.match(service, /options.allowPrivate && auth\?\.currentUser/);
  assert.match(service, /setInterval\(\(\) => void refresh\(\), 10_000\)/);
  assert.match(detail, /initialListing: retry === 0 \? initialListing : null/);
});

test("browser icon is 48px while Apple/PWA branding remains independent", () => {
  const png = readFileSync(new URL("../src/app/icon.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), 48); assert.equal(png.readUInt32BE(20), 48);
  assert.ok(png.length < 10000);
  assert.ok(readFileSync(new URL("../src/app/apple-icon.png", import.meta.url)).length > 0);
});

test("anonymous server feed rejects identity drift, redirects, foreign media and private payloads", async t => {
  const { anonymousPublicRead } = await import("../src/lib/firebase/public-read.ts");
  const { getPublicHomePage, getPublicProductSnapshot } = await import("../src/lib/firebase/public-catalogue-server.ts");
  const { stagingEnvironment: stage } = await import("../functions/src/staging-environment.ts");
  const { releaseProofPrefix } = await import("../src/lib/release-proof.ts");
  const firebase = { NEXT_PUBLIC_FIREBASE_API_KEY: "AIza" + "s".repeat(35), NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: stage.authDomain, NEXT_PUBLIC_FIREBASE_PROJECT_ID: stage.projectId, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: stage.storageBucket, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: stage.projectNumber, NEXT_PUBLIC_FIREBASE_APP_ID: `1:${stage.projectNumber}:web:${"b".repeat(22)}` };
  const env = { ...firebase, NODE_ENV: "production", TAKEME_RELEASE_TARGET: "staging", NEXT_PUBLIC_SITE_URL: stage.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_BUILD_RELEASE_PROOF: releaseProofPrefix + btoa(JSON.stringify({ format: 1, purpose: "staging-preview", target: "staging", projectId: stage.projectId, siteUrl: stage.siteUrl, useEmulators: false, firebase, policy: { publicationApproved: true, termsVersion: stage.policyVersion, privacyVersion: stage.policyVersion, minimumAge: 18 } })) };
  const previous = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  const requests: { url: string; init?: RequestInit }[] = [];
  const publicItem = { ...listing, imageUrls: [`https://firebasestorage.googleapis.com/v0/b/${stage.storageBucket}/o/photo.png?alt=media&token=synthetic-media-token`] };
  let payload: unknown = { listings: [publicItem] }, status = 200;
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => { requests.push({ url, init }); return new Response(JSON.stringify({ result: payload }), { status }); });
  try {
    Object.assign(process.env, env);
    assert.equal((await getPublicHomePage())?.listings[0]?.id, listing.id);
    assert.equal(requests[0].url, `https://asia-southeast1-${stage.projectId}.cloudfunctions.net/getPublicListingPage`);
    assert.deepEqual(requests[0].init?.headers, { "Content-Type": "application/json" });
    assert.equal(requests[0].init?.redirect, "manual");
    assert.equal(requests[0].init?.cache, "no-store");
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { data: { filters: { sort: "newest", pageSize: 8 }, cursor: null } });
    payload = { listings: [publicItem] };
    await anonymousPublicRead("getPublicListingPage", { filters: { sort: "newest" }, cursor: null });
    assert.equal(requests.at(-1)?.init?.credentials, "omit");
    assert.deepEqual(requests.at(-1)?.init?.headers, { "Content-Type": "application/json" });
    payload = { listing: publicItem, bids: [] };
    assert.equal((await getPublicProductSnapshot(listing.id))?.listing.id, listing.id);
    payload = { listing: { ...publicItem, id: "other" }, bids: [] };
    assert.equal(await getPublicProductSnapshot(listing.id), null);
    payload = { listings: [{ ...publicItem, status: "draft" }] }; assert.equal(await getPublicHomePage(), null);
    payload = { listings: [listing] }; assert.equal(await getPublicHomePage(), null);
    status = 302; assert.equal(await getPublicHomePage(), null);
    const count = requests.length;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "takeme-52b80";
    assert.equal(await getPublicHomePage(), null); assert.equal(requests.length, count);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});


test("streamed public account controls use a pending server snapshot before attaching known identity", () => {
  const provider = source("src/components/auth/auth-provider.tsx");
  assert.match(provider, /useSyncExternalStore\(subscribeHydration, clientReady, serverPending\)/);
  assert.match(provider, /ready \? value : \{ \.\.\.value, user: null, loading: true, setup: null/);
  for (const path of ["src/components/saved/save-button.tsx", "src/components/profile/follow-seller-button.tsx", "src/components/listings/listing-detail-view.tsx"]) assert.match(source(path), /usePublicAuth\(\)/);
  const publicRead = source("src/lib/firebase/public-read.ts");
  assert.doesNotMatch(publicRead, /firebase\/auth|firebase\/functions|firebase\/storage|Bearer|Authorization/);
  assert.match(publicRead, /credentials: "omit"/);
  assert.match(source("src/lib/services/listings.ts"), /parsePublicCataloguePage\(data, filters.pageSize \?\? 12\)/);
});
