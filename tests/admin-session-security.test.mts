import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

function load<T>(path: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)((name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error("Unexpected test dependency: " + name);
  }, compiled, compiled.exports);
  return compiled.exports as T;
}
type Identity = { uid: string; expiresAt: number };
type Boundary = { verifyAdminIdentity: (request: object) => Promise<Identity> };
type Session = { adminSessionCookie: string; verifyAdminToken: (token: string) => Promise<Identity | null>; readAdminSession: () => Promise<Identity | null> };
type Route = { POST: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response> };
function fixture() {
  const expiry = Math.floor(Date.now() / 1000) + 1800;
  const state = { revoked: false, removed: false, consumer: false, expiry, verified: 0 };
  const issued: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const deleted: string[] = [];
  const jar = new Map<string, string>();
  class ErrorResponse extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
  const boundary = load<Boundary>("functions/src/admin-auth.ts", {
    "firebase-admin/auth": { getAuth: () => ({
      verifyIdToken: async (token: string, checkRevoked: boolean) => {
        state.verified++;
        assert.equal(checkRevoked, true);
        if (token !== "synthetic-valid-token" || state.revoked || state.expiry <= Date.now() / 1000)
          throw new Error("private verifier details");
        return { uid: "synthetic-admin", admin: !state.consumer, exp: state.expiry };
      },
      getUser: async () => ({ disabled: false, customClaims: { admin: !state.removed } }),
    }) },
    "firebase-functions/v2/https": { HttpsError: ErrorResponse },
  });
  const cookieStore = {
    get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => { issued.push({ name, value, options }); jar.set(name, value); },
    delete: (name: string) => { deleted.push(name); jar.delete(name); },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(input, "http://127.0.0.1:5001/demo-takeme/asia-southeast1/getAdminSession");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "manual");
    const header = (options?.headers as Record<string, string>).Authorization;
    try {
      const result = await boundary.verifyAdminIdentity({ auth: { uid: "synthetic-admin", token: { admin: true } }, rawRequest: { headers: { authorization: header } } });
      return Response.json({ result });
    } catch { return new Response(null, { status: 403 }); }
  };
  const savedEnv = { project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, demo: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS };
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-takeme";
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
  const session = load<Session>("apps/admin/src/lib/server-session.ts", {
    "server-only": {}, "next/headers": { cookies: async () => cookieStore },
  });
  const route = load<Route>("apps/admin/src/app/api/session/route.ts", {
    "next/headers": { cookies: async () => cookieStore }, "@admin/lib/server-session": session,
  });
  return { state, issued, deleted, jar, session, route, restore: () => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [["NEXT_PUBLIC_FIREBASE_PROJECT_ID", savedEnv.project], ["NEXT_PUBLIC_USE_FIREBASE_EMULATORS", savedEnv.demo]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  } };
}
const request = (token: unknown = "synthetic-valid-token", origin = "https://admin.example.test") => new Request("https://admin.example.test/api/session", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ token }),
});
test("valid admin session issues a bounded HttpOnly Secure SameSite Strict cookie and validates reuse", async () => {
  const f = fixture();
  try {
    const response = await f.route.POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { uid: "synthetic-admin" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(f.issued.length, 1);
    const cookie = f.issued[0];
    assert.equal(cookie.name, "takeme-admin-session");
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.sameSite, "strict");
    assert.equal(cookie.options.path, "/");
    assert.ok((cookie.options.maxAge as number) > 0 && (cookie.options.maxAge as number) <= 1800);
    assert.equal((await f.session.readAdminSession())?.uid, "synthetic-admin");
    assert.equal(f.state.verified, 2);
  } finally { f.restore(); }
});
for (const mode of ["revoked", "removed", "consumer", "expired", "forged", "malformed"]) {
  test(`${mode} session creation never issues an admin cookie or successful session response`, async () => {
    const f = fixture();
    try {
      if (mode === "expired") f.state.expiry = Math.floor(Date.now() / 1000) - 1;
      if (["revoked", "removed", "consumer"].includes(mode)) f.state[mode as "revoked" | "removed" | "consumer"] = true;
      const token = mode === "forged" ? "synthetic-forged-token" : mode === "malformed" ? null : "synthetic-valid-token";
      const response = await f.route.POST(request(token));
      assert.equal(response.status, 403);
      assert.equal(await response.text(), "");
      assert.deepEqual(f.issued, []);
      assert.equal(f.jar.has(f.session.adminSessionCookie), false);
    } finally { f.restore(); }
  });
}
for (const mode of ["revoked", "removed", "expired", "malformed"]) {
  test(`already-issued ${mode} cookie is denied at the protected server-session boundary`, async () => {
    const f = fixture();
    try {
      assert.equal((await f.route.POST(request())).status, 200);
      assert.ok(await f.session.readAdminSession());
      if (mode === "expired") f.state.expiry = Math.floor(Date.now() / 1000) - 1;
      else if (mode === "malformed") f.jar.set(f.session.adminSessionCookie, "synthetic-forged-cookie");
      else f.state[mode as "revoked" | "removed"] = true;
      assert.equal(await f.session.readAdminSession(), null);
      assert.equal(f.issued.length, 1);
    } finally { f.restore(); }
  });
}
test("cross-origin and origin-less creation/logout are rejected without verification or cookie change", async () => {
  const f = fixture();
  try {
    for (const origin of ["https://unrelated.example.test", ""]) {
      assert.equal((await f.route.POST(request(undefined, origin))).status, 403);
      assert.equal((await f.route.DELETE(new Request("https://admin.example.test/api/session", { method: "DELETE", headers: { origin } }))).status, 403);
    }
    assert.equal(f.state.verified, 0); assert.deepEqual(f.issued, []); assert.deepEqual(f.deleted, []);
  } finally { f.restore(); }
});
test("same-origin logout clears only the admin cookie without account-wide revocation", async () => {
  const f = fixture();
  try {
    await f.route.POST(request());
    const count = f.state.verified;
    const response = await f.route.DELETE(new Request("https://admin.example.test/api/session", { method: "DELETE", headers: { origin: "https://admin.example.test" } }));
    assert.equal(response.status, 204);
    assert.deepEqual(f.deleted, ["takeme-admin-session"]);
    assert.equal(await f.session.readAdminSession(), null);
    assert.equal(f.state.revoked, false); assert.equal(f.state.verified, count);
  } finally { f.restore(); }
});
test("expiry less than one second away cannot issue a zero-duration session", async () => {
  const f = fixture();
  try {
    const realNow = Date.now;
    const almostExpired = Math.floor(realNow() / 1000) * 1000 + 900;
    Date.now = () => almostExpired;
    f.state.expiry = Math.floor(almostExpired / 1000) + 1;
    try {
      assert.equal((await f.route.POST(request())).status, 403);
      assert.deepEqual(f.issued, []);
    } finally { Date.now = realNow; }
  } finally { f.restore(); }
});
