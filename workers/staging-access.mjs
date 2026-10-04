import { stagingEnvironment } from "../functions/src/staging-environment.ts";

const tokenLimit = 16384;
const certificates = new Map();
function normalizeEmail(value) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function decodePart(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
}
function jsonPart(value) { return JSON.parse(new TextDecoder().decode(decodePart(value))); }

function accessConfiguration(env) {
  const issuer = env.CF_ACCESS_TEAM_DOMAIN;
  if (!/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/.test(issuer || "") || !/^[a-f0-9]{64}$/.test(env.CF_ACCESS_AUD || "")) return null;
  try {
    const emails = JSON.parse(env.CF_ACCESS_ALLOWED_EMAILS || "");
    if (!Array.isArray(emails) || emails.length !== 1 || emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)))) return null;
    return { issuer, audience: env.CF_ACCESS_AUD, emails: emails.map(normalizeEmail) };
  } catch { return null; }
}

function accessToken(request) {
  // Never downgrade an invalid assertion to a different identity source.
  if (request.headers.has("Cf-Access-Jwt-Assertion")) return request.headers.get("Cf-Access-Jwt-Assertion");
  // Static Assets' internal router does not forward ctx.access to the user
  // Worker. Its application cookie is usable only after full JWT verification.
  const cookies = request.headers.get("Cookie");
  if (!cookies || cookies.length > tokenLimit * 2) return null;
  const matches = cookies.split(";").map(part => part.trim()).filter(part => part.split("=", 1)[0].trim() === "CF_Authorization");
  if (matches.length !== 1) return null;
  const value = matches[0].slice(matches[0].indexOf("=") + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/** No request reaches Next/assets without exact staging configuration and authenticated Access identity. */
export async function stagingAccessAllowed(request, env, options = {}) {
  if (env.TAKEME_RELEASE_TARGET !== "staging" || env.TAKEME_FIREBASE_PROJECT_ID !== stagingEnvironment.projectId
    || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== stagingEnvironment.projectId || env.NEXT_PUBLIC_SITE_URL !== stagingEnvironment.siteUrl
    || env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false" || env.TAKEME_ENABLE_PRODUCTION_DELETION !== "false"
    || new URL(request.url).origin !== stagingEnvironment.siteUrl) return false;
  const config = accessConfiguration(env);
  if (!config) return false;
  const access = options.context?.access;
  if (access !== undefined) {
    // Trust only Cloudflare's invocation context, never request email headers.
    // A present but invalid native identity cannot fall back to a user token.
    try {
      if (!access || access.aud !== config.audience || typeof access.getIdentity !== "function") return false;
      const identity = await access.getIdentity();
      return config.emails.includes(normalizeEmail(identity?.email));
    } catch { return false; }
  }
  const token = accessToken(request);
  if (!token || token.length > tokenLimit) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = jsonPart(parts[0]), claims = jsonPart(parts[1]);
    const now = Math.floor((options.now ?? Date.now()) / 1000);
    if (header?.alg !== "RS256" || typeof header.kid !== "string" || !header.kid || header.kid.length > 256
      || claims?.type !== "app" || claims.iss !== config.issuer || !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(config.audience)
      || !Number.isInteger(claims.exp) || claims.exp <= now || !config.emails.includes(normalizeEmail(claims.email))
      || claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now)
      || claims.iat !== undefined && (!Number.isInteger(claims.iat) || claims.iat > now + 30)) return false;
    const cached = options.fetch ? null : certificates.get(config.issuer);
    let keys = cached?.expires > Date.now() && cached.keys.some(key => key.kid === header.kid) ? cached.keys : null;
    if (!keys) {
      // Workers supports manual redirects; reject every non-2xx certificate
      // response below instead of following a redirect to another origin.
      const response = await (options.fetch ?? fetch)(`${config.issuer}/cdn-cgi/access/certs`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      if (!response.ok) return false;
      const text = await response.text();
      if (text.length > 65536) return false;
      keys = JSON.parse(text).keys;
      if (!Array.isArray(keys) || keys.length > 20) return false;
      if (!options.fetch) {
        if (certificates.size >= 4 && !certificates.has(config.issuer)) certificates.clear();
        certificates.set(config.issuer, { expires: Date.now() + 300000, keys });
      }
    }
    if (!Array.isArray(keys) || keys.length > 20) return false;
    const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodePart(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return false; }
}

export function createStagingWorker(worker, accessOptions = {}) {
  return {
    async fetch(request, env, context) {
      if (!await stagingAccessAllowed(request, env, { ...accessOptions, context })) return stagingDeniedResponse();
      const response = await worker.fetch(request, env, context);
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      // Also covers browser-direct/unoptimized images, which skip Next's loader.
      headers.append("Content-Security-Policy", `img-src 'self' blob: data: https://firebasestorage.googleapis.com/v0/b/${stagingEnvironment.storageBucket}/o/ https://lh3.googleusercontent.com`);
      if (!new URL(request.url).pathname.startsWith("/_next/static/")) headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    },
  };
}

export function stagingDeniedResponse() {
  return new Response("Staging access denied", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
