import assert from "node:assert/strict";
import test from "node:test";
import { stagingAccessAllowed, createStagingWorker } from "../workers/staging-access.mjs";
import { stagingEnvironment as staging } from "../functions/src/staging-environment.ts";

const audience = "a".repeat(64), issuer = "https://qualification.cloudflareaccess.com";
const email = "approved@example.test";
const now = 1900000000000;
const env = {
  TAKEME_RELEASE_TARGET: "staging", TAKEME_FIREBASE_PROJECT_ID: staging.projectId,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: staging.projectId, NEXT_PUBLIC_SITE_URL: staging.siteUrl,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false",
  CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience, CF_ACCESS_ALLOWED_EMAILS: JSON.stringify([email]),
};
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const publicKey = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "ephemeral-test-key", alg: "RS256", use: "sig" };
function base64(bytes: Uint8Array) { return Buffer.from(bytes).toString("base64url"); }
async function token(change = {}, headerChange = {}) {
  const header = base64(new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: publicKey.kid, ...headerChange })));
  const payload = base64(new TextEncoder().encode(JSON.stringify({ iss: issuer, aud: [audience], exp: Math.floor(now / 1000) + 600, iat: Math.floor(now / 1000) - 10, email, ...change })));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64(new Uint8Array(signature))}`;
}
const certificateFetch = async (url: string) => { assert.equal(url, issuer + "/cdn-cgi/access/certs"); return Response.json({ keys: [publicKey] }); };

test("staging denies anonymous assets/legal requests and missing or mixed configuration before any certificate/app IO", async () => {
  let calls = 0;
  const options = { now, fetch: async () => { calls++; throw new Error("Unexpected network"); } };
  for (const path of ["/", "/privacy", "/terms", "/_next/static/source.js", "/_next/image?url=%2Fbrand%2Fimage.png"]) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl + path), env, options), false);
  const assertion = await token();
  for (const changed of [{ CF_ACCESS_TEAM_DOMAIN: "" }, { CF_ACCESS_TEAM_DOMAIN: "https://attacker.example.test" }, { CF_ACCESS_AUD: "" }, { CF_ACCESS_ALLOWED_EMAILS: "[]" }, { TAKEME_RELEASE_TARGET: "production" }, { TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "takeme-52b80" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }, { TAKEME_ENABLE_PRODUCTION_DELETION: "true" }]) assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": assertion } }), { ...env, ...changed }, options), false);
  assert.equal(await stagingAccessAllowed(new Request("https://takeme.my/", { headers: { "Cf-Access-Jwt-Assertion": assertion } }), env, options), false);
  assert.equal(calls, 0);
});

test("Access requires a real RS256 signature, exact issuer/audience, live dates and the approved tester email", async () => {
  const options = { now, fetch: certificateFetch };
  const valid = await token();
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": valid } }), env, options), true);
  for (const [change, header] of [[{ email: "other@example.test" }, {}], [{ aud: ["b".repeat(64)] }, {}], [{ iss: "https://different.cloudflareaccess.com" }, {}], [{ exp: Math.floor(now / 1000) }, {}], [{ nbf: Math.floor(now / 1000) + 600 }, {}], [{ iat: Math.floor(now / 1000) + 600 }, {}], [{}, { alg: "HS256" }], [{}, { kid: "unknown" }]]) {
    assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": await token(change, header) } }), env, options), false);
  }
  const invalid = valid.slice(0, -20) + "a".repeat(20);
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": invalid } }), env, options), false);
  assert.equal(await stagingAccessAllowed(new Request(staging.siteUrl, { headers: { "Cf-Access-Jwt-Assertion": valid } }), env, { now, fetch: async () => new Response("unavailable", { status: 503 }) }), false);
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
  assert.ok(policy?.includes("blob:")); assert.ok(policy?.includes("'self'"));
  assert.equal(policy?.includes("takeme-52b80"), false);
  assert.equal(policy?.includes("firebasestorage.googleapis.com;"), false);
});
