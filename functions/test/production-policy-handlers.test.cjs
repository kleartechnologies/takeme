"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
const adminApp = require("firebase-admin/app");
const adminAuth = require("firebase-admin/auth");
const adminFirestore = require("firebase-admin/firestore");

// Actual compiled callable handlers with synthetic collaborators only. These
// tests initialize no SDK app, load no credentials and deny every network path.
let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; throw new Error("Synthetic policy tests prohibit network access."); };
const savedNetwork = { fetch: globalThis.fetch, connect: net.Socket.prototype.connect,
  httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get };
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
http.request = http.get = https.request = https.get = denyNetwork;

const descriptors = [[adminApp, "getApp"], [adminAuth, "getAuth"], [adminFirestore, "getFirestore"]]
  .map(([module, key]) => [module, key, Object.getOwnPropertyDescriptor(module, key)]);
const selectedNames = new Set(["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "FIREBASE_CONFIG",
  "TAKEME_RELEASE_TARGET", "TAKEME_FIREBASE_PROJECT_ID", "TAKEME_STORAGE_BUCKETS", "TAKEME_DELETION_ENVIRONMENT",
  "TAKEME_ENABLE_STAGING_DELETION", "TAKEME_ENABLE_PRODUCTION_DELETION", "PROTECTED_PAYMENTS_ENABLED",
  "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "NEXT_PUBLIC_USE_FIREBASE_EMULATORS",
  ...Object.keys(process.env).filter(key => /EMULATOR|EMULATORS/.test(key))]);
const savedEnv = Object.fromEntries([...selectedNames].map(key => [key, process.env[key]]));
const uid = "synthetic-local-policy-owner";
const onboardingPath = `users/${uid}/private/onboarding`;
const profilePath = `users/${uid}`;
const lifecyclePath = `accountLifecycles/${uid}`;
const policyPath = "releasePolicies/current";
let projectId, bucket, documents, committedWrites, authReads, reads, beforeRead;
const { Timestamp, FieldValue } = adminFirestore;
const timestamp = Timestamp.fromMillis(1_800_000_000_000);

function snapshot(ref) {
  reads.push(ref.path);
  if (beforeRead) beforeRead(ref.path);
  const data = documents.get(ref.path);
  return { exists: data !== undefined, data: () => data };
}
function resolveServerValues(value) {
  if (value instanceof FieldValue) return timestamp;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map(resolveServerValues);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, resolveServerValues(field)]));
  return value;
}
const db = {
  doc: path => ({ path, get: async function () { return snapshot(this); }, create: async function (data) {
    if (documents.has(path)) throw { code: 6 };
    documents.set(path, resolveServerValues(data)); committedWrites.push({ path, kind: "create" });
  } }),
  runTransaction: async handler => {
    const pending = [];
    const tx = {
      get: async ref => { assert.equal(pending.length, 0, "All transaction reads must precede writes."); return snapshot(ref); },
      set: (ref, data) => pending.push({ path: ref.path, kind: "set", data }),
      update: (ref, data) => { assert.ok(documents.has(ref.path)); pending.push({ path: ref.path, kind: "update", data }); },
      create: (ref, data) => { assert.equal(documents.has(ref.path), false); pending.push({ path: ref.path, kind: "create", data }); },
    };
    const result = await handler(tx);
    for (const write of pending) {
      documents.set(write.path, write.kind === "update" ? { ...documents.get(write.path), ...resolveServerValues(write.data) } : resolveServerValues(write.data));
      committedWrites.push({ path: write.path, kind: write.kind });
    }
    return result;
  },
};
Object.defineProperty(adminApp, "getApp", { configurable: true, value: () => ({ options: { projectId, storageBucket: bucket } }) });
Object.defineProperty(adminAuth, "getAuth", { configurable: true, value: () => ({ getUser: async requested => {
  assert.equal(requested, uid, "No real or client-selected account may be read."); authReads++; return { uid, disabled: false };
} }) });
Object.defineProperty(adminFirestore, "getFirestore", { configurable: true, value: () => db });

const { productionEnvironment } = require("../lib/production-environment");
const { demoReleasePolicy, productionReleasePolicy } = require("../lib/release-policy");
const onboarding = require("../lib/auth-onboarding");
const { requestUploadPermits } = require("../lib/upload-permits");
const { marketplaceMutationCall, runGuardedTransaction } = require("../lib/account-lifecycle");
const { assertMarketplaceEligibility, currentReleasePolicy } = require("../lib/account-eligibility");
const { policyAcceptancePath, legacyAcceptanceHistory } = require("../lib/policy-acceptance-history");
const functions = { ...onboarding, requestUploadPermits };
const preparationNames = ["getAccountSetupStatus", "acceptWebPolicies", "completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits"];

function reset(target = "production") {
  for (const key of selectedNames) delete process.env[key];
  projectId = target === "demo" ? "demo-takeme" : productionEnvironment.projectId;
  bucket = target === "demo" ? "demo-takeme.appspot.com" : productionEnvironment.storageBucket;
  Object.assign(process.env, { GCLOUD_PROJECT: projectId, TAKEME_RELEASE_TARGET: target, TAKEME_FIREBASE_PROJECT_ID: projectId,
    TAKEME_STORAGE_BUCKETS: bucket, TAKEME_DELETION_ENVIRONMENT: target,
    TAKEME_ENABLE_PRODUCTION_DELETION: "false", TAKEME_ENABLE_STAGING_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false" });
  if (target === "demo") Object.assign(process.env, { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
  documents = new Map(); committedWrites = []; reads = []; authReads = 0; beforeRead = null;
}
// These identifiers are synthetic resolver fixtures, never proposed final
// production policy versions and never written to any Firebase resource.
const syntheticProductionRecord = () => ({ releaseTarget: "production", projectId: productionEnvironment.projectId,
  publicationApproved: true, termsVersion: "synthetic-final-1", privacyVersion: "synthetic-final-2", minimumAge: 18 });
const accepted = policy => ({ termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion,
  termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" });
const acceptanceRequest = policy => ({ acceptTerms: true, acceptPrivacy: true, confirmAge18: true, termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion });
const uploadData = () => ({ uploads: [{ path: `users/${uid}/profile/synthetic-local.png`, contentType: "image/png", sizeBytes: 3 }] });
const request = (data = {}) => ({ auth: { uid }, data });
const policyUnavailable = error => error.code === "failed-precondition" && error.details?.reason === "policy-release-unavailable";

for (const [label, record] of [
  ["missing record", undefined], ["publication false", { ...syntheticProductionRecord(), publicationApproved: false }],
  ["Terms missing", (() => { const record = syntheticProductionRecord(); delete record.termsVersion; return record; })()],
  ["Privacy missing", (() => { const record = syntheticProductionRecord(); delete record.privacyVersion; return record; })()],
  ["age missing", (() => { const record = syntheticProductionRecord(); delete record.minimumAge; return record; })()],
  ["age string", { ...syntheticProductionRecord(), minimumAge: "18" }], ["age null", { ...syntheticProductionRecord(), minimumAge: null }],
  ["age below minimum", { ...syntheticProductionRecord(), minimumAge: 17 }], ["record array", []],
  ["record scalar", "approved"], ["extra metadata", { ...syntheticProductionRecord(), updatedAt: timestamp }],
  ["copied demo record", { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy }],
]) {
  test(`all five preparation handlers fail closed: ${label}`, async () => {
    reset(); if (record !== undefined) documents.set(policyPath, record);
    assert.deepEqual(await onboarding.getAccountSetupStatus.run(request()), { step: "acceptance", policyAvailable: false,
      termsVersion: null, privacyVersion: null, minimumAge: 18 });
    for (const name of preparationNames.slice(1)) {
      const data = name === "acceptWebPolicies" ? acceptanceRequest(syntheticProductionRecord()) : name === "requestUploadPermits" ? uploadData() : {};
      await assert.rejects(functions[name].run(request(data)), policyUnavailable);
    }
    assert.deepEqual(committedWrites, []);
    assert.equal(reads.includes(profilePath), false);
  });
}

test("every preparation handler rejects signed-out requests without account reads or writes", async () => {
  reset();
  for (const name of preparationNames) await assert.rejects(functions[name].run({ data: {} }), { code: "unauthenticated" });
  assert.equal(authReads, 0); assert.deepEqual(reads, []); assert.deepEqual(committedWrites, []);
});

test("approved demo policy walks fresh acceptance, profile, welcome and current account status", async () => {
  reset("demo");
  const status = () => onboarding.getAccountSetupStatus.run(request());
  assert.equal((await status()).step, "acceptance");
  assert.deepEqual(documents.get(policyPath), { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  const initialCreates = committedWrites.length;
  for (const key of ["acceptTerms", "acceptPrivacy", "confirmAge18"]) {
    for (const invalid of [false, undefined, "true", 1]) {
      await assert.rejects(onboarding.acceptWebPolicies.run(request({ ...acceptanceRequest(demoReleasePolicy), [key]: invalid })), { code: "invalid-argument" });
    }
  }
  assert.equal(committedWrites.length, initialCreates);
  assert.deepEqual(await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy))), { accepted: true });
  assert.deepEqual(documents.get(onboardingPath), { ...accepted(demoReleasePolicy), acceptanceHistoryId: documents.get(onboardingPath).acceptanceHistoryId });
  const acceptedWrites = committedWrites.length;
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  assert.equal(committedWrites.length, acceptedWrites, "Acceptance retry must not replace original evidence.");
  assert.equal((await status()).step, "profile");
  await assert.rejects(onboarding.completeFirstTimeProfile.run(request()), { code: "failed-precondition" });
  await assert.rejects(onboarding.finishAccountWelcome.run(request()), { code: "failed-precondition" });
  documents.set(profilePath, { displayName: "Synthetic local owner" });
  await onboarding.completeFirstTimeProfile.run(request());
  assert.equal((await status()).step, "welcome");
  await onboarding.finishAccountWelcome.run(request());
  assert.equal((await status()).step, "ready");
  const completedWrites = committedWrites.length;
  await onboarding.completeFirstTimeProfile.run(request());
  await onboarding.finishAccountWelcome.run(request());
  assert.equal(committedWrites.length, completedWrites, "Completion retries preserve the original timestamps.");
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(productionReleasePolicy.termsVersion, "1.0"); assert.equal(productionReleasePolicy.privacyVersion, "1.0");
});

test("profile, welcome and uploads reject incomplete or old demo acceptance before writing", async () => {
  for (const setup of [undefined, { ...accepted(demoReleasePolicy), termsVersion: "old" },
    { ...accepted(demoReleasePolicy), privacyVersion: "old" }, { ...accepted(demoReleasePolicy), age18ConfirmedAt: false },
    { ...accepted(demoReleasePolicy), termsAcceptedAt: true }, { ...accepted(demoReleasePolicy), revokedAt: timestamp }]) {
    reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
    documents.set(profilePath, { displayName: "Synthetic local owner" });
    if (setup) documents.set(onboardingPath, setup);
    for (const name of ["completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits"]) {
      await assert.rejects(functions[name].run(request(name === "requestUploadPermits" ? uploadData() : {})), { code: "failed-precondition" });
    }
    assert.deepEqual(committedWrites, []);
  }
});

test("demo upload permits require eligibility, exact owner paths and keep bounded evidence", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  documents.set(onboardingPath, accepted(demoReleasePolicy));
  await assert.rejects(requestUploadPermits.run(request({ uploads: [{ ...uploadData().uploads[0], path: "users/other-owner/profile/image.png" }] })), { code: "invalid-argument" });
  assert.deepEqual(committedWrites, []);
  const result = await requestUploadPermits.run(request(uploadData()));
  assert.equal(result.permits.length, 1); assert.equal(result.permits[0].path, uploadData().uploads[0].path);
  const stored = documents.get(onboardingPath);
  assert.equal(stored.termsVersion, demoReleasePolicy.termsVersion); assert.equal(stored.privacyVersion, demoReleasePolicy.privacyVersion);
  assert.equal(Object.keys(stored.uploadPermits).length, 1);
  assert.ok(stored.uploadPermits[result.permits[0].permitId].expiresAt instanceof Timestamp);
  assert.deepEqual(committedWrites.map(write => write.path), [`users/${uid}/private/cadence-upload`, onboardingPath]);
});

test("runtime version changes re-gate existing users and invalidate previous acceptance", async () => {
  reset(); const record = syntheticProductionRecord(); documents.set(policyPath, record);
  documents.set(profilePath, { displayName: "Synthetic local owner" });
  documents.set(onboardingPath, { ...accepted(record), profileCompletedAt: timestamp, welcomeCompletedAt: timestamp });
  assert.equal((await onboarding.getAccountSetupStatus.run(request())).step, "ready");
  documents.set(policyPath, { ...record, termsVersion: "synthetic-final-3" });
  const status = await onboarding.getAccountSetupStatus.run(request());
  assert.equal(status.step, "acceptance"); assert.equal(status.termsVersion, "synthetic-final-3");
  await assert.rejects(onboarding.acceptWebPolicies.run(request(acceptanceRequest(record))), { code: "failed-precondition" });
  for (const name of ["completeFirstTimeProfile", "finishAccountWelcome", "requestUploadPermits"]) {
    await assert.rejects(functions[name].run(request(name === "requestUploadPermits" ? uploadData() : {})), { code: "failed-precondition" });
  }
  assert.deepEqual(committedWrites, []);
});

test("first explicit acceptance atomically creates immutable history and its current projection", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  const path = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId), history = documents.get(path);
  assert.equal(history.evidenceKind, "web-acceptance"); assert.equal(history.minimumAgeConfirmed, 18);
  assert.equal(history.source, "web"); assert.equal(history.releaseTarget, "demo"); assert.equal(history.projectId, "demo-takeme");
  for (const field of ["termsAcceptedAt", "privacyAcceptedAt", "ageConfirmedAt", "acceptedAt"]) assert.ok(history[field] instanceof Timestamp);
  assert.deepEqual(committedWrites.map(write => write.path), [path, onboardingPath]);
  const saved = { ...history }, current = { ...documents.get(onboardingPath) }, writes = committedWrites.length;
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  assert.deepEqual(documents.get(path), saved); assert.deepEqual(documents.get(onboardingPath), current);
  assert.equal(committedWrites.length, writes, "Same-policy retries must create no additional event or projection write.");
});

test("explicit future-policy acceptance preserves old history and profile/welcome state", async () => {
  reset(); const first = syntheticProductionRecord(); documents.set(policyPath, first);
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(first)));
  const firstPath = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId), original = { ...documents.get(firstPath) };
  documents.set(onboardingPath, { ...documents.get(onboardingPath), profileCompletedAt: timestamp, welcomeCompletedAt: timestamp });
  const next = { ...first, termsVersion: "synthetic-final-3", privacyVersion: "synthetic-final-4" };
  documents.set(policyPath, next);
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(next)));
  const nextPath = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId);
  assert.deepEqual(documents.get(firstPath), original); assert.notEqual(nextPath, firstPath);
  assert.equal(documents.get(nextPath).termsVersion, next.termsVersion);
  assert.equal(documents.get(onboardingPath).termsVersion, next.termsVersion);
  assert.ok(documents.get(onboardingPath).profileCompletedAt.isEqual(timestamp)); assert.ok(documents.get(onboardingPath).welcomeCompletedAt.isEqual(timestamp));
});

test("legacy exact evidence is copied only on an explicit acceptance, without invented provenance", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  const legacy = { ...accepted(demoReleasePolicy), termsAcceptedAt: Timestamp.fromMillis(1000), privacyAcceptedAt: Timestamp.fromMillis(2000), age18ConfirmedAt: Timestamp.fromMillis(3000) };
  documents.set(onboardingPath, legacy);
  await onboarding.getAccountSetupStatus.run(request());
  assert.equal(documents.has(policyAcceptancePath(uid, legacyAcceptanceHistory(uid, legacy).acceptanceId)), false, "Status/login must not create consent history.");
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  const event = documents.get(policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId));
  assert.equal(event.evidenceKind, "legacy-current");
  assert.ok(event.termsAcceptedAt.isEqual(legacy.termsAcceptedAt)); assert.ok(event.privacyAcceptedAt.isEqual(legacy.privacyAcceptedAt)); assert.ok(event.ageConfirmedAt.isEqual(legacy.age18ConfirmedAt));
  for (const field of ["acceptedAt", "releaseTarget", "projectId"]) assert.equal(Object.hasOwn(event, field), false);
  assert.deepEqual(documents.get(onboardingPath), { ...legacy, acceptanceHistoryId: event.acceptanceId });
});

test("legacy prior versions are archived in the same transaction before current evidence changes", async () => {
  reset(); const current = syntheticProductionRecord(); documents.set(policyPath, current);
  const legacy = { ...accepted({ termsVersion: "historical-policy-1", privacyVersion: "historical-policy-2" }), profileCompletedAt: timestamp, welcomeCompletedAt: timestamp };
  documents.set(onboardingPath, legacy);
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(current)));
  const event = documents.get(policyAcceptancePath(uid, legacyAcceptanceHistory(uid, legacy).acceptanceId));
  assert.equal(event.evidenceKind, "legacy-current"); assert.equal(event.termsVersion, legacy.termsVersion);
  assert.equal(documents.get(policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId)).evidenceKind, "web-acceptance");
  assert.equal(documents.get(onboardingPath).termsVersion, current.termsVersion);
  assert.deepEqual(committedWrites.map(write => write.path), [policyAcceptancePath(uid, legacyAcceptanceHistory(uid, legacy).acceptanceId), policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId), onboardingPath]);
});

test("malformed, colliding or foreign history aborts all acceptance writes", async () => {
  for (const patch of [{ minimumAgeConfirmed: "18" }, { termsVersion: "different-version" }, { source: "client" },
    { acceptedAt: "client-time" }, { projectId: "other-project" }, { evidenceKind: "other" }, { extra: true }]) {
    reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
    await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
    const path = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId);
    documents.set(path, { ...documents.get(path), ...patch }); committedWrites = [];
    const before = { ...documents.get(onboardingPath) };
    await assert.rejects(onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy))), error => error.details?.reason === "policy-acceptance-history-invalid");
    assert.deepEqual(committedWrites, []); assert.deepEqual(documents.get(onboardingPath), before);
  }
});

test("partial legacy evidence fails closed instead of being overwritten or re-timestamped", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  const previous = { ...accepted(demoReleasePolicy), age18ConfirmedAt: "unknown-old-value" };
  documents.set(onboardingPath, previous);
  await assert.rejects(onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy))), error => error.details?.reason === "policy-acceptance-history-invalid");
  assert.deepEqual(documents.get(onboardingPath), previous); assert.deepEqual(committedWrites, []);
});

test("null current revocation preserves legacy or pointed evidence and does not invent fresh revocation", async () => {
  for (const scenario of ["legacy-current", "prior-policy", "pointed-current"]) {
    reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
    if (scenario === "pointed-current") await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
    const previous = { ...(documents.get(onboardingPath) ?? accepted(demoReleasePolicy)), revokedAt: null,
      ...(scenario === "prior-policy" ? { termsVersion: "historical-policy-1" } : {}) };
    documents.set(onboardingPath, previous); committedWrites = [];
    await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
    const current = documents.get(onboardingPath), event = documents.get(policyAcceptancePath(uid, current.acceptanceHistoryId));
    assert.equal(Object.hasOwn(event, "revokedAt"), false); assert.equal(Object.hasOwn(event, "reacceptanceAfterRevokedAt"), false);
    if (scenario === "pointed-current") { assert.deepEqual(current, previous); assert.deepEqual(committedWrites, []); }
    if (scenario === "legacy-current") { assert.equal(event.evidenceKind, "legacy-current"); assert.deepEqual(current, { ...previous, acceptanceHistoryId: event.acceptanceId }); }
    if (scenario === "prior-policy") { assert.equal(event.evidenceKind, "web-acceptance"); assert.equal(Object.hasOwn(current, "revokedAt"), false); }
  }
});

test("revoked evidence remains blocked until explicit full acceptance and is truthfully archived", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  const revoked = { ...accepted(demoReleasePolicy), revokedAt: Timestamp.fromMillis(4000) };
  documents.set(onboardingPath, revoked);
  assert.equal((await onboarding.getAccountSetupStatus.run(request())).step, "acceptance");
  assert.deepEqual(committedWrites, []); assert.deepEqual(documents.get(onboardingPath), revoked);
  await assert.rejects(onboarding.acceptWebPolicies.run(request({ ...acceptanceRequest(demoReleasePolicy), acceptPrivacy: false })), { code: "invalid-argument" });
  assert.deepEqual(committedWrites, []);
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  const archived = documents.get(policyAcceptancePath(uid, legacyAcceptanceHistory(uid, revoked).acceptanceId));
  assert.ok(archived.revokedAt.isEqual(revoked.revokedAt));
  const freshPath = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId), fresh = documents.get(freshPath);
  assert.equal(fresh.evidenceKind, "web-acceptance"); assert.ok(fresh.reacceptanceAfterRevokedAt.isEqual(revoked.revokedAt));
  assert.notEqual(fresh.acceptanceId, archived.acceptanceId);
  assert.equal([...documents.keys()].filter(path => path.includes("/policyAcceptances/events/")).length, 2);
  assert.equal(Object.hasOwn(documents.get(onboardingPath), "revokedAt"), false);
});

test("same-version revocation of an existing event creates a fresh event and subsequent retries remain idempotent", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  const oldId = documents.get(onboardingPath).acceptanceHistoryId, oldPath = policyAcceptancePath(uid, oldId), oldEvent = { ...documents.get(oldPath) };
  const revokedAt = Timestamp.fromMillis(4000);
  documents.set(onboardingPath, { ...documents.get(onboardingPath), revokedAt }); committedWrites = [];
  assert.equal((await onboarding.getAccountSetupStatus.run(request())).step, "acceptance");
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  const newId = documents.get(onboardingPath).acceptanceHistoryId, fresh = documents.get(policyAcceptancePath(uid, newId));
  assert.notEqual(newId, oldId); assert.deepEqual(documents.get(oldPath), oldEvent);
  assert.ok(fresh.reacceptanceAfterRevokedAt.isEqual(revokedAt));
  assert.deepEqual(committedWrites.map(write => write.path), [policyAcceptancePath(uid, newId), onboardingPath]);
  const writes = committedWrites.length;
  await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
  assert.equal(committedWrites.length, writes); assert.equal(documents.get(onboardingPath).acceptanceHistoryId, newId);
});

test("missing, malformed or mismatched current history pointers fail closed", async () => {
  for (const mutation of ["missing-event", "bad-id", "missing-id", "mismatched-dates", "foreign-owner"]) {
    reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
    await onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy)));
    const path = policyAcceptancePath(uid, documents.get(onboardingPath).acceptanceHistoryId);
    if (mutation === "missing-event") documents.delete(path);
    if (mutation === "bad-id") documents.set(onboardingPath, { ...documents.get(onboardingPath), acceptanceHistoryId: "../other" });
    if (mutation === "missing-id") documents.set(onboardingPath, { ...documents.get(onboardingPath), acceptanceHistoryId: undefined });
    if (mutation === "mismatched-dates") documents.set(onboardingPath, { ...documents.get(onboardingPath), termsAcceptedAt: Timestamp.fromMillis(5000) });
    if (mutation === "foreign-owner") documents.set(path, { ...documents.get(path), ownerId: "other-owner" });
    committedWrites = []; const before = { ...documents.get(onboardingPath) };
    await assert.rejects(onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy))), error => error.details?.reason === "policy-acceptance-history-invalid");
    assert.deepEqual(committedWrites, []); assert.deepEqual(documents.get(onboardingPath), before);
  }
});

test("a fresh event ID collision aborts the transaction without adopting or overwriting it", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  let collidedPath;
  beforeRead = path => {
    if (path.includes("/policyAcceptances/events/")) {
      collidedPath = path; documents.set(path, { syntheticCollision: true });
    }
  };
  await assert.rejects(onboarding.acceptWebPolicies.run(request(acceptanceRequest(demoReleasePolicy))), error => error.details?.reason === "policy-acceptance-history-invalid");
  assert.deepEqual(committedWrites, []); assert.equal(documents.has(onboardingPath), false);
  assert.deepEqual(documents.get(collidedPath), { syntheticCollision: true });
});

test("marketplace mutations resolve the same demo policy both before and inside their write transaction", async () => {
  const mutation = marketplaceMutationCall(async owner => runGuardedTransaction(db, async tx => {
    tx.set(db.doc(`synthetic-mutations/${owner.auth.uid}`), { touched: true }); return { touched: true };
  }));
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  await assert.rejects(mutation.run(request()), error => error.details?.reason === "account-policy-required");
  assert.deepEqual(committedWrites, []);
  documents.set(onboardingPath, accepted(demoReleasePolicy));
  assert.deepEqual(await mutation.run(request()), { touched: true });
  assert.equal(committedWrites.length, 1);
  committedWrites = [];
  let policyReads = 0;
  beforeRead = path => { if (path === policyPath && ++policyReads === 2) documents.set(policyPath, { ...documents.get(policyPath), publicationApproved: false }); };
  await assert.rejects(mutation.run(request()), policyUnavailable);
  assert.deepEqual(committedWrites, [], "Revocation racing with a mutation must prevent its commit.");
});

test("deletion_pending remains blocked independently of otherwise-valid policy acceptance", async () => {
  reset("demo"); documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  documents.set(onboardingPath, accepted(demoReleasePolicy)); documents.set(lifecyclePath, { state: "deletion_pending", alias: "deleted-synthetic-local" });
  assert.deepEqual(await onboarding.getAccountSetupStatus.run(request()), { step: "deletion" });
  for (const name of preparationNames.slice(1)) await assert.rejects(functions[name].run(request()), { code: "failed-precondition" });
  assert.deepEqual(committedWrites, []);
});

test("currentReleasePolicy and eligibility use no policy copied from client data", async () => {
  reset();
  await assert.rejects(currentReleasePolicy(), policyUnavailable);
  await assert.rejects(assertMarketplaceEligibility(uid), policyUnavailable);
  documents.set(policyPath, syntheticProductionRecord());
  await assert.rejects(assertMarketplaceEligibility(uid), error => error.details?.reason === "account-policy-required");
  assert.deepEqual(committedWrites, []);
});

test.after(() => {
  for (const [module, key, descriptor] of descriptors) Object.defineProperty(module, key, descriptor);
  globalThis.fetch = savedNetwork.fetch; net.Socket.prototype.connect = savedNetwork.connect;
  http.request = savedNetwork.httpRequest; http.get = savedNetwork.httpGet;
  https.request = savedNetwork.httpsRequest; https.get = savedNetwork.httpsGet;
  for (const key of selectedNames) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
  assert.equal(networkAttempts, 0, "No real Firebase resource may be contacted.");
});
