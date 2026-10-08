import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, getIdToken } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { acceptDemoPolicies, createDemoPassword } from "./helpers/demo-eligibility.mjs";

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-takeme")
  throw new Error("Demo-only session qualification");
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: adminInit, deleteApp: adminDelete } = require("firebase-admin/app");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const projectId = "demo-takeme";
const suffix = Date.now().toString();
const admin = adminInit({ projectId }, "session-revocation-" + suffix);
const trustedAuth = adminAuth(admin);
const apps = [];
let checks = 0;
async function identity(label, privileged = true) {
  const app = initializeApp({ apiKey: "demo-api-key", authDomain: "demo-takeme.firebaseapp.com", projectId, appId: "1:123456789:web:demo" }, label + suffix);
  apps.push(app);
  const auth = getAuth(app), functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const user = (await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, createDemoPassword())).user;
  await acceptDemoPolicies(app, functions);
  if (privileged) await trustedAuth.setCustomUserClaims(user.uid, { admin: true, unrelatedClaim: "preserved" });
  const token = await getIdToken(user, true);
  return { user, token, functions };
}
async function raw(name, token, data = {}) {
  // The same exact ID token used by the dedicated app's HttpOnly cookie path.
  return fetch(`http://127.0.0.1:5001/demo-takeme/asia-southeast1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }) });
}
async function deny(name, token, data) {
  const response = await raw(name, token, data);
  assert.ok(response.status === 401 || response.status === 403);
  const body = await response.json();
  assert.equal(body.result, undefined); // No future expiry, successful session or data.
  assert.ok(body.error);
  checks++;
}
try {
  const normal = await identity("session-normal", false);
  for (const name of ["getAdminSession", "getAdminEditorialPage", "getAdminEditorialRecord", "getAdminPage", "getAdminRecord", "requestAdminAssetPermit", "loadAdminReportContext"])
    await deny(name, normal.token, { admin: true, kind: "campaigns", section: "users", sizeBytes: 1024, contentType: "image/png" });
  // The Functions emulator fabricates callable auth for malformed credentials;
  // forged JWT rejection is covered at the SDK-verifier/cookie boundaries offline.
  for (const remove of [false, true]) {
    const operator = await identity(remove ? "session-removed" : "session-revoked");
    const result = await httpsCallable(operator.functions, "getAdminSession")({});
    assert.equal(result.data.uid, operator.user.uid);
    assert.ok(result.data.expiresAt > Date.now() / 1000); checks++;
    assert.equal((await raw("getAdminEditorialPage", operator.token, { kind: "campaigns" })).status, 200); checks++;
    if (remove) {
      const before = await trustedAuth.getUser(operator.user.uid);
      const claims = { ...before.customClaims };
      delete claims.admin;
      await trustedAuth.setCustomUserClaims(operator.user.uid, claims);
      // Claim removal doesn't rewrite the issued token; our current-authority
      // read independently rejects it. Preserve unrelated custom claims.
      const current = await trustedAuth.getUser(operator.user.uid);
      assert.equal(current.customClaims.unrelatedClaim, "preserved");
      await deny("getAdminSession", operator.token);
    }
    // Ensure the old authentication time precedes the second-resolution cutoff.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await trustedAuth.revokeRefreshTokens(operator.user.uid);
    const current = await trustedAuth.getUser(operator.user.uid);
    assert.ok(Date.parse(current.tokensValidAfterTime) > Date.parse(operator.user.metadata.lastSignInTime)); checks++;
    await deny("getAdminSession", operator.token); // Existing cookie credential.
    await deny("getAdminEditorialPage", operator.token, { kind: "campaigns" });
    await deny("getAdminPage", operator.token, { section: "users" });
  }
  console.log(`Admin session emulator qualification PASS: ${checks} assertions; issued tokens revoked; no cloud calls.`);
} finally {
  // Emulator-only account cleanup; no production claims/accounts/data accessed.
  for (const app of apps) {
    const uid = getAuth(app).currentUser?.uid;
    if (uid) await trustedAuth.deleteUser(uid);
    await deleteApp(app);
  }
  await adminDelete(admin);
}
