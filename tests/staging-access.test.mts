import assert from "node:assert/strict";
import test from "node:test";
import { stagingAccessAllowed, createStagingWorker } from "../workers/staging-access.mjs";
import { stagingEnvironment as staging } from "../functions/src/staging-environment.ts";
import { STAGING_MEDIA_BUCKET } from "../functions/src/listing-media-domain.ts";

const audience = "a".repeat(64), issuer = "https://qualification.cloudflareaccess.com";
const approvedEmails = ["amirulaidi@gmail.com", "zweetdata@gmail.com"];
const email = approvedEmails[0];
const now = 1900000000000;
const env = {
  TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: staging.projectId,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: staging.projectId, NEXT_PUBLIC_SITE_URL: staging.siteUrl,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false",
  CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience, CF_ACCESS_ALLOWED_EMAILS: JSON.stringify(approvedEmails),
};
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const publicKey = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "ephemeral-test-key", alg: "RS256", use: "sig" };
function base64(bytes: Uint8Array) { return Buffer.from(bytes).toString("base64url"); }
async function token(change = {}, headerChange = {}) {
  const header = base64(new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: publicKey.kid, ...headerChange })));
  const payload = base64(new TextEncoder().encode(JSON.stringify({ type: "app", iss: issuer, aud: [audience], exp: Math.floor(now / 1000) + 600, iat: Math.floor(now / 1000) - 10, email, ...change })));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64(new Uint8Array(signature))}`;
}
const certificateFetch = async (url: string, init?: RequestInit) => { assert.equal(url, issuer + "/cdn-cgi/access/certs"); if (init) assert.equal(init.redirect, "manual"); return Response.json({ keys: [publicKey] }); };

test("staging denies anonymous assets/legal requests and missing or mixed configuration before any certificate/app IO", async () => {
  let calls = 0;
  const options = { now, fetch: async () => { calls++; throw new Error("Unexpected network"); } };
  for (const path of ["/", "/privacy", "/terms", "/_next/static/source.js", "/_next/image?url=%2Fbrand%2Fimage.png"]) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl + path), env, options), false);
  const assertion = await token();
  for (const changed of [{ CF_ACCESS_TEAM_DOMAIN: "" }, { CF_ACCESS_TEAM_DOMAIN: "https://attacker.example.test" }, { CF_ACCESS_AUD: "" }, { CF_ACCESS_ALLOWED_EMAILS: "[]" }, { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }, { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }]) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": assertion } }), { ...env, ...changed }, options), false);
  assert.equal(await stagingAccessAllowed(new Request("https://takeme.my/", { headers: { "Cf-Access-Jwt-Assertion": assertion } }), env, options), false);
  assert.equal(calls, 0);
});

function nativeContext(identity: unknown, aud = audience) {
  return { access: { aud, getIdentity: async () => identity } };
}
const noCertificateIO = async () => { throw new Error("Native identity must not fetch certificates"); };

test("missing Access context and tokens deny even with a claimed email header", async () => {
  const request = new Request(staging.siteUrl, { headers: { "Cf-Access-Authenticated-User-Email": email } });
  assert.equal(await stagingAccessAllowed(request, env, { context: {}, fetch: noCertificateIO }), false);
});

test("native Access identity without an email denies", async () => {
  for (const identity of [undefined, null, {}, { email: "" }, { email: "   " }, { email: 123 }]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl), env, { context: nativeContext(identity), fetch: noCertificateIO }), false);
  }
});

test("native Access identity requires exact email equality", async () => {
  for (const wrong of ["other@example.test", "third@gmail.com", "*@gmail.com", ...approvedEmails.flatMap(email => [`${email}.attacker.test`, `prefix-${email}`])]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl), env, { context: nativeContext({ email: wrong }), fetch: noCertificateIO }), false);
  }
});

test("native Access accepts both normalized mixed-case approved emails", async () => {
  for (const email of approvedEmails) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl), env, { context: nativeContext({ email: `  ${email.toUpperCase()}  ` }), fetch: noCertificateIO }), true);
});

test("native Access accepts both exact approved emails without request identity headers", async () => {
  for (const email of approvedEmails) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl), env, { context: nativeContext({ email }), fetch: noCertificateIO }), true);
});

test("allowlist configuration accepts only the exact unique approved pair after normalization, in either order", async () => {
  for (const emails of [approvedEmails, [...approvedEmails].reverse(), [...approvedEmails].reverse().map(email => `  ${email.toUpperCase()}  `)]) {
    const configured = { ...env, CF_ACCESS_ALLOWED_EMAILS: JSON.stringify(emails) };
    for (const email of approvedEmails) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl), configured, { context: nativeContext({ email }), fetch: noCertificateIO }), true);
  }
});

test("malformed, missing, duplicate, arbitrary or extra allowlist entries fail closed before certificate or app IO", async () => {
  const assertion = await token();
  let certificateCalls = 0, appCalls = 0;
  const fetch = async () => { certificateCalls++; throw new Error("Invalid configuration must not fetch certificates"); };
  const worker = createStagingWorker({ fetch: async () => { appCalls++; return new Response("Unexpected app IO"); } }, { now, fetch });
  const malformed = [undefined, "", "not-json", "null", JSON.stringify(email), JSON.stringify({ emails: approvedEmails }),
    ...[[], [email], [email, email], [email, `  ${email.toUpperCase()}  `], [null, approvedEmails[1]], [123, approvedEmails[1]],
      ["", approvedEmails[1]], ["invalid", approvedEmails[1]], ["*@gmail.com", approvedEmails[1]], ["gmail.com", approvedEmails[1]],
      [email, "third@gmail.com"], ["first@example.test", "second@example.test"], [...approvedEmails, "third@gmail.com"]].map(emails => JSON.stringify(emails))];
  for (const CF_ACCESS_ALLOWED_EMAILS of malformed) {
    const configured = { ...env, CF_ACCESS_ALLOWED_EMAILS };
    for (const headers of [{}, { "Cf-Access-Jwt-Assertion": assertion }, { Cookie: `CF_Authorization=${assertion}` }] as HeadersInit[]) {
      const request = new Request(staging.siteUrl, { headers });
      assert.equal(await stagingAccessAllowed(request, configured, { now, context: nativeContext({ email }), fetch }), false);
      assert.equal((await worker.fetch(request, configured, {})).status, 403);
    }
  }
  assert.equal(certificateCalls, 0);
  assert.equal(appCalls, 0);
});

test("invalid native context denies without falling back to a valid signed application cookie", async () => {
  const request = new Request(staging.siteUrl, { headers: { Cookie: `CF_Authorization=${await token()}` } });
  let certificateCalls = 0;
  const fetch = async (url: string) => { certificateCalls++; return certificateFetch(url); };
  for (const context of [nativeContext({ email }, "b".repeat(64)), nativeContext({ email: "other@example.test" }), nativeContext({}), { access: null }, { access: { aud: audience } }, { access: { aud: audience, getIdentity: async () => { throw new Error("Unavailable"); } } }]) {
    assert.equal(await stagingAccessAllowed(request, env, { now, context, fetch }), false);
  }
  assert.equal(certificateCalls, 0);
});

test("Static Assets paths accept a fully verified application cookie when native context and assertion are absent", async () => {
  for (const email of approvedEmails) {
    for (const identity of [email, `  ${email.toUpperCase()}  `]) {
      const assertion = await token({ email: identity });
      for (const path of ["/", "/login", "/privacy", "/_next/static/source.js", "/_next/image?url=%2Fbrand%2Fimage.png"]) {
        assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl + path, { headers: { Cookie: `other=ignored; CF_Authorization=${assertion}; preference=test` } }), env, { now, context: {}, fetch: certificateFetch }), true);
      }
    }
  }
});

test("cookie fallback denies malformed, duplicate, empty and oversized application cookies before certificate IO", async () => {
  const assertion = await token();
  let certificateCalls = 0;
  const fetch = async (url: string) => { certificateCalls++; return certificateFetch(url); };
  for (const cookie of ["other=ignored", "CF_Authorization=", "CF_Authorization", `CF_Authorization=\"${assertion}\"`, `CF_Authorization=${assertion}; CF_Authorization=${assertion}`, "CF_Authorization=" + "a".repeat(32769), "CF_Authorization=not.a.token", `CF_Authorization=${assertion.replaceAll(".", "%2E")}`]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { Cookie: cookie } }), env, { now, fetch }), false);
  }
  assert.equal(certificateCalls, 0);
});

test("cookie identities require a live signed application audience, issuer and approved user email", async () => {
  for (const change of [{ type: "org" }, { email: undefined }, { email: "other@example.test" }, { aud: ["b".repeat(64)] }, { iss: "https://other.cloudflareaccess.com" }, { exp: Math.floor(now / 1000) }, { nbf: Math.floor(now / 1000) + 600 }, { iat: Math.floor(now / 1000) + 600 }]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { Cookie: `CF_Authorization=${await token(change)}` } }), env, { now, fetch: certificateFetch }), false);
  }
  const valid = await token();
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { Cookie: `CF_Authorization=${valid.slice(0, -20)}${"a".repeat(20)}` } }), env, { now, fetch: certificateFetch }), false);
});

test("present invalid or empty assertion cannot downgrade to a valid application cookie", async () => {
  for (const assertion of ["", "invalid", await token({ email: "other@example.test" })]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": assertion, Cookie: `CF_Authorization=${await token()}` } }), env, { now, fetch: certificateFetch }), false);
  }
});

test("certificate fetch uses workerd-compatible manual mode and denies redirects without following them", async () => {
  let calls = 0;
  const request = new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": await token() } });
  for (const status of [301, 302, 303, 307, 308]) {
    assert.equal(await stagingAccessAllowed(request, env, { now, fetch: async (url: string, init: RequestInit) => {
      calls++; assert.equal(url, issuer + "/cdn-cgi/access/certs"); assert.equal(init.redirect, "manual");
      return new Response(null, { status, headers: { Location: "https://unapproved.example.test/certs" } });
    } }), false);
  }
  assert.equal(calls, 5);
});

test("Worker passes the real invocation context to the guard and denies before downstream assets/app IO", async () => {
  let calls = 0;
  const worker = createStagingWorker({ fetch: async (_request: Request, _env: unknown, context: unknown) => { calls++; assert.equal(context, approved); return new Response("Synthetic staging content"); } }, { fetch: noCertificateIO });
  const approved = nativeContext({ email });
  assert.equal((await worker.fetch(new Request(staging.siteUrl + "/_next/static/source.js"), env, nativeContext({ email: "other@example.test" }))).status, 403);
  assert.equal(calls, 0);
  const response = await worker.fetch(new Request(staging.siteUrl), env, approved);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("Access requires a real RS256 signature, exact issuer/audience, live dates and one of the two approved tester emails", async () => {
  const options = { now, fetch: certificateFetch };
  const valid = await token();
  for (const email of approvedEmails) {
    for (const identity of [email, `  ${email.toUpperCase()}  `]) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": await token({ email: identity }) } }), env, options), true);
  }
  for (const [change, header] of [[{ email: undefined }, {}], [{ email: "" }, {}], [{ email: "   " }, {}], [{ email: 123 }, {}], [{ email: "other@example.test" }, {}], [{ email: "third@gmail.com" }, {}], [{ email: "*@gmail.com" }, {}], [{ aud: ["b".repeat(64)] }, {}], [{ iss: "https://different.cloudflareaccess.com" }, {}], [{ exp: Math.floor(now / 1000) }, {}], [{ nbf: Math.floor(now / 1000) + 600 }, {}], [{ iat: Math.floor(now / 1000) + 600 }, {}], [{}, { alg: "HS256" }], [{}, { kid: "unknown" }]]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": await token(change, header) } }), env, options), false);
  }
  const invalid = valid.slice(0, -20) + "a".repeat(20);
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": invalid } }), env, options), false);
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": valid } }), env, { now, fetch: async () => new Response("unavailable", { status: 503 }) }), false);
});

test("approved identities cannot use the staging wrapper for a production target or origin", async () => {
  let certificateCalls = 0, appCalls = 0;
  const fetch = async () => { certificateCalls++; throw new Error("Production must not fetch certificates"); };
  const worker = createStagingWorker({ fetch: async () => { appCalls++; return new Response("Unexpected app IO"); } }, { now, fetch });
  for (const email of approvedEmails) {
    const assertion = await token({ email });
    for (const [url, configured] of [[staging.siteUrl, { ...env, TAKEME_RELEASE_TARGET: "production" }], ["https://takeme.my/", env]] as const) {
      for (const headers of [{}, { "Cf-Access-Jwt-Assertion": assertion }, { Cookie: `CF_Authorization=${assertion}` }] as HeadersInit[]) {
        const request = new Request(url, { headers });
        assert.equal(await stagingAccessAllowed(request, configured, { now, context: nativeContext({ email }), fetch }), false);
        assert.equal((await worker.fetch(request, configured, {})).status, 403);
      }
    }
  }
  assert.equal(certificateCalls, 0);
  assert.equal(appCalls, 0);
});

test("guarded Worker blocks all app calls without Access and marks authenticated staging output private/noindex", async () => {
  let calls = 0;
  const worker = createStagingWorker({ fetch: async () => { calls++; return new Response("Synthetic staging content", { headers: { "Cache-Control": "public, max-age=3600" } }); } }, { now, fetch: certificateFetch });
  const denied = await worker.fetch(new Request(staging.siteUrl + "/privacy"), env, {});
  assert.equal(denied.status, 403); assert.equal(denied.headers.get("Cache-Control"), "no-store"); assert.equal(calls, 0);
  const allowed = await worker.fetch(new Request(staging.siteUrl + "/privacy", { headers: { "Cf-Access-Jwt-Assertion": await token() } }), env, {});
  assert.equal(allowed.status, 200); assert.equal(allowed.headers.get("X-Robots-Tag"), "noindex, nofollow"); assert.equal(allowed.headers.get("Cache-Control"), "no-store"); assert.equal(calls, 1);
  const policy = allowed.headers.get("Content-Security-Policy");
  assert.ok(policy?.includes(`/v0/b/${staging.storageBucket}/o/`));
  assert.ok(policy?.includes(`/v0/b/${STAGING_MEDIA_BUCKET}/o/`));
  assert.deepEqual(policy?.split(" ").filter(value => value.startsWith("https://firebasestorage.googleapis.com")), [
    `https://firebasestorage.googleapis.com/v0/b/${staging.storageBucket}/o/`,
    `https://firebasestorage.googleapis.com/v0/b/${STAGING_MEDIA_BUCKET}/o/`,
  ]);
  assert.ok(policy?.includes("blob:")); assert.ok(policy?.includes("'self'"));
  assert.equal(policy?.includes("takeme-52b80"), false);
  assert.equal(policy?.includes("firebasestorage.googleapis.com;"), false);
});
