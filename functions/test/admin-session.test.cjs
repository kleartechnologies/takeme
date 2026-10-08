const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const authModule = require("firebase-admin/auth");
const firestoreModule = require("firebase-admin/firestore");
const { readFileSync } = require("node:fs");

// Real SDK revocation algorithm, offline JWT-validation/Auth collaborators.
// Live signature/issuer/audience validation is the SDK's responsibility; this
// suite proves the handler invokes that verifier with checkRevoked=true.
const auth = authModule.getAuth(initializeApp({ projectId: "demo-takeme" }, "admin-session-unit"));
let current, claims, jwtError, verifyCalls, reads;
const originalVerify = auth.verifyIdToken.bind(auth);
auth.verifyIdToken = async (token, checkRevoked) => {
  verifyCalls.push({ token, checkRevoked });
  return originalVerify(token, checkRevoked);
};
auth.idTokenVerifier.verifyJWT = async () => {
  if (jwtError) throw jwtError;
  return claims;
};
auth.getUser = async (uid) => {
  assert.equal(uid, current.uid);
  return current;
};
Object.defineProperty(authModule, "getAuth", { configurable: true, value: () => auth });
Object.defineProperty(firestoreModule, "getFirestore", { configurable: true, value: () => ({
  doc: (path) => ({ get: async () => {
    reads.push(path);
    assert.equal(path, "accountLifecycles/synthetic-admin");
    return { exists: false, data: () => undefined };
  } }),
  collection: () => { throw new Error("No session/audit writes or admin data reads allowed in this test"); },
}) });
const { verifyAdminIdentity } = require("../lib/admin-auth");
const { getAdminSession, getAdminEditorialPage } = require("../lib/editorial");
const { getAdminPage } = require("../lib/admin");
const message = "Admin access is no longer available. Please sign in again.";
function reset() {
  const now = Math.floor(Date.now() / 1000);
  claims = { uid: "synthetic-admin", sub: "synthetic-admin", admin: true, exp: now + 1800, auth_time: now - 120 };
  current = { uid: "synthetic-admin", disabled: false, customClaims: { admin: true }, tokensValidAfterTime: new Date((now - 300) * 1000).toUTCString() };
  jwtError = null; verifyCalls = []; reads = [];
  return { auth: { uid: claims.uid, token: { ...claims } }, data: {}, rawRequest: { headers: { authorization: "Bearer synthetic-placeholder" } } };
}
async function denied(handler, request) {
  await assert.rejects(() => handler(request), (error) => {
    assert.equal(error.code, "permission-denied");
    assert.equal(error.message, message);
    assert.equal(error.details, undefined);
    return true;
  });
}
test("valid current admin receives only verified UID and original token expiry", async () => {
  const request = reset();
  // Decoded transport expiry must not be the source of the session expiry.
  request.auth.token.exp += 10000;
  assert.deepEqual(await getAdminSession.run(request), { uid: claims.uid, expiresAt: claims.exp });
  assert.deepEqual(verifyCalls, [{ token: "synthetic-placeholder", checkRevoked: true }]);
  assert.deepEqual(reads, ["accountLifecycles/synthetic-admin"]);
});
for (const reason of ["auth/id-token-expired", "auth/argument-error", "auth/invalid-id-token", "issuer/audience mismatch"]) {
  test(`SDK validation failure (${reason}) returns no session or sensitive details`, async () => {
    const request = reset(); jwtError = new Error(reason + " private token details");
    await denied(getAdminSession.run, request);
    assert.equal(verifyCalls[0].checkRevoked, true);
  });
}
test("original revoked + removed-admin reproduction is denied by real SDK revocation check", async () => {
  const request = reset();
  current.customClaims = { admin: false };
  current.tokensValidAfterTime = new Date().toUTCString();
  await denied(getAdminSession.run, request);
  assert.equal(verifyCalls[0].checkRevoked, true);
});
test("revocation alone rejects the old token even with current admin claim", async () => {
  const request = reset(); current.tokensValidAfterTime = new Date().toUTCString();
  await denied(getAdminSession.run, request);
});
test("claim removal alone leaves embedded token unchanged but current-authority read denies", async () => {
  const request = reset(); current.customClaims = {};
  assert.equal(claims.admin, true);
  await denied(getAdminSession.run, request);
});
test("normal user and forged transport admin flag cannot receive a session", async () => {
  const request = reset(); claims.admin = false;
  await denied(getAdminSession.run, request);
  request.auth.token.admin = false;
  await denied(getAdminSession.run, request);
});
test("verified UID must match callable identity", async () => {
  const request = reset(); claims.uid = "unrelated-user";
  await denied(verifyAdminIdentity, request);
});
test("expired/invalid verified expiry cannot create a future session", async () => {
  for (const exp of [0, Math.floor(Date.now() / 1000) - 1, NaN, Infinity, "future"]) {
    const request = reset(); claims.exp = exp;
    await denied(getAdminSession.run, request);
  }
});
test("missing/malformed/oversized bearer or missing auth fail closed", async () => {
  for (const header of [undefined, [], "", "Basic placeholder", "Bearer one two", "Bearer " + "x".repeat(8193)]) {
    const request = reset(); request.rawRequest.headers.authorization = header;
    await denied(verifyAdminIdentity, request);
    assert.equal(verifyCalls.length, 0);
  }
  const request = reset(); request.auth = undefined;
  await denied(verifyAdminIdentity, request);
});
test("disabled account and Auth read failure fail closed", async () => {
  const request = reset(); current.disabled = true;
  await denied(verifyAdminIdentity, request);
  reset(); const getUser = auth.getUser;
  auth.getUser = async () => { throw new Error("private Auth failure"); };
  try { await denied(verifyAdminIdentity, request); } finally { auth.getUser = getUser; }
});
test("revoked identity is also rejected by editorial and legacy protected admin reads", async () => {
  for (const endpoint of [getAdminEditorialPage, getAdminPage]) {
    const request = reset(); current.tokensValidAfterTime = new Date().toUTCString();
    await denied(endpoint.run, request);
    assert.deepEqual(reads, ["accountLifecycles/synthetic-admin"]);
  }
});
test("every editorial/marketplace admin guard awaits the shared verifier", () => {
  for (const [file, guard] of [["editorial", "requireEditorialAdmin"], ["admin", "requireAdmin"]]) {
    const source = readFileSync(require.resolve(`../src/${file}.ts`), "utf8");
    const calls = [...source.matchAll(new RegExp(`(?<!function )${guard}\\(request\\)`, "g"))];
    assert.ok(calls.length >= 5);
    for (const call of calls) assert.equal(source.slice(call.index - 6, call.index), "await ");
    assert.match(source, /await verifyAdminIdentity\(request\)/);
  }
});
