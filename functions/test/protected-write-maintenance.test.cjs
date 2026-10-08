"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
const adminApp = require("firebase-admin/app");
const adminAuth = require("firebase-admin/auth");
const adminFirestore = require("firebase-admin/firestore");
const { maintenanceIsPaused, validateProtectedWriteControl, PROTECTED_WRITE_MAINTENANCE_MESSAGE,
  PROTECTED_WRITE_MAINTENANCE_REASON } = require("../lib/protected-write-maintenance");
const { productionEnvironment } = require("../lib/production-environment");
const { stagingFirebaseProjectId, stagingStorageBucket } = require("../lib/staging-environment");
const { demoReleasePolicy } = require("../lib/release-policy");

const contexts = [
  { target: "demo", projectId: "demo-takeme" },
  { target: "staging", projectId: stagingFirebaseProjectId },
  { target: "production", projectId: productionEnvironment.projectId },
];
const control = (context, paused = true) => ({ releaseTarget: context.target, projectId: context.projectId, protectedWritesPaused: paused });

test("all three trusted environments accept only their exact minimal control and explicit absence defaults OFF", () => {
  for (const context of contexts) {
    assert.equal(maintenanceIsPaused(undefined, context), false);
    for (const paused of [false, true]) {
      const value = control(context, paused);
      assert.equal(maintenanceIsPaused(value, context), paused);
      assert.deepEqual(validateProtectedWriteControl(value, context), value);
      assert.equal(Object.isFrozen(validateProtectedWriteControl(value, context)), true);
      assert.deepEqual(value, control(context, paused), "Resolving a control must not mutate its source.");
    }
    for (const other of contexts.filter(candidate => candidate !== context)) assert.equal(maintenanceIsPaused(control(other, false), context), true);
  }
});

test("malformed present control and untrusted runtime context fail closed, including when the record is absent", () => {
  const context = contexts[0];
  for (const invalid of [null, false, true, 0, "false", [], {},
    { ...control(context, false), protectedWritesPaused: "false" },
    { ...control(context, false), projectId: "other-project" },
    { ...control(context, false), releaseTarget: "production" },
    { ...control(context, false), updatedAt: "unexpected-extra-field" },
    { releaseTarget: "demo", projectId: "demo-takeme" },
    { protectedWritesPaused: false },
  ]) {
    assert.equal(maintenanceIsPaused(invalid, context), true);
    assert.equal(validateProtectedWriteControl(invalid, context), null);
  }
  for (const invalidContext of [null, { target: "unknown", projectId: "demo-takeme" },
    { target: "demo", projectId: productionEnvironment.projectId }, { target: "production", projectId: "demo-takeme" }]) {
    assert.equal(maintenanceIsPaused(undefined, invalidContext), true);
    assert.equal(maintenanceIsPaused(control(context, false), invalidContext), true);
  }
});

// Exercise actual compiled wrappers/callable handlers with synthetic collaborators
// only. No SDK app/credentials, cloud requests or emulator resources are loaded.
let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; throw new Error("Local maintenance tests prohibit network access."); };
const savedNetwork = { fetch: globalThis.fetch, connect: net.Socket.prototype.connect,
  httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get };
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
http.request = http.get = https.request = https.get = denyNetwork;
const descriptors = [[adminApp, "getApp"], [adminAuth, "getAuth"], [adminFirestore, "getFirestore"]]
  .map(([module, key]) => [module, key, Object.getOwnPropertyDescriptor(module, key)]);
const envNames = new Set(["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "FIREBASE_CONFIG",
  "TAKEME_RELEASE_TARGET", "TAKEME_FIREBASE_PROJECT_ID", "TAKEME_STORAGE_BUCKETS", "TAKEME_DELETION_ENVIRONMENT",
  "TAKEME_ENABLE_STAGING_DELETION", "TAKEME_ENABLE_PRODUCTION_DELETION", "NEXT_PUBLIC_USE_FIREBASE_EMULATORS",
  "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST",
  ...Object.keys(process.env).filter(key => /EMULATOR|EMULATORS/.test(key))]);
const savedEnv = Object.fromEntries([...envNames].map(key => [key, process.env[key]]));
const uid = "synthetic-maintenance-owner";
const controlPath = "releaseControls/current", policyPath = "releasePolicies/current";
const lifecyclePath = `accountLifecycles/${uid}`, onboardingPath = `users/${uid}/private/onboarding`;
const { Timestamp, FieldValue } = adminFirestore;
const timestamp = Timestamp.fromMillis(1_800_000_000_000);
let projectId, bucket, documents, writes, reads, authReads, beforeRead, failControlRead, transactionReads, handlerEntries;

function snapshot(ref, transaction = false) {
  reads.push(ref.path);
  if (transaction) transactionReads.push(ref.path);
  if (beforeRead) beforeRead(ref.path, transaction);
  if (failControlRead && ref.path === controlPath) throw new Error("Synthetic control read failure.");
  const value = documents.get(ref.path);
  return { exists: documents.has(ref.path), data: () => value };
}
function serverValues(value) {
  if (value instanceof FieldValue) return timestamp;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map(serverValues);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, serverValues(field)]));
  return value;
}
const db = {
  doc: path => ({ path, get: async function () { return snapshot(this); }, create: async data => {
    if (documents.has(path)) throw { code: 6 };
    documents.set(path, serverValues(data)); writes.push({ path, kind: "create" });
  } }),
  runTransaction: async handler => {
    const pending = [];
    const tx = {
      get: async ref => { assert.equal(pending.length, 0, "All checks must read before writes."); return snapshot(ref, true); },
      set: (ref, value) => pending.push({ path: ref.path, value, kind: "set" }),
      create: (ref, value) => { assert.equal(documents.has(ref.path), false); pending.push({ path: ref.path, value, kind: "create" }); },
      update: (ref, value) => { assert.ok(documents.has(ref.path)); pending.push({ path: ref.path, value, kind: "update" }); },
    };
    const result = await handler(tx);
    for (const write of pending) {
      documents.set(write.path, write.kind === "update" ? { ...documents.get(write.path), ...serverValues(write.value) } : serverValues(write.value));
      writes.push({ path: write.path, kind: write.kind });
    }
    return result;
  },
};
Object.defineProperty(adminApp, "getApp", { configurable: true, value: () => ({ options: { projectId, storageBucket: bucket } }) });
Object.defineProperty(adminAuth, "getAuth", { configurable: true, value: () => ({ getUser: async requested => {
  assert.equal(requested, uid); authReads++; return { uid, disabled: false };
} }) });
Object.defineProperty(adminFirestore, "getFirestore", { configurable: true, value: () => db });
const runtime = require("../lib/protected-write-maintenance-runtime");
const { marketplaceCall, marketplaceMutationCall, resolutionMutationCall, runGuardedTransaction } = require("../lib/account-lifecycle");
const onboarding = require("../lib/auth-onboarding");
const { requestUploadPermits } = require("../lib/upload-permits");
const request = (data = {}) => ({ auth: { uid }, data });
const rejection = error => error.code === "failed-precondition" && error.message === PROTECTED_WRITE_MAINTENANCE_MESSAGE
  && assert.deepEqual(error.details, { reason: PROTECTED_WRITE_MAINTENANCE_REASON }) === undefined;
const mutator = marketplaceMutationCall(async () => {
  handlerEntries++;
  return runGuardedTransaction(db, async tx => { tx.set(db.doc("syntheticWrites/result"), { written: true }); return { completed: true }; });
});

function reset(target = "demo") {
  for (const name of envNames) delete process.env[name];
  const context = contexts.find(value => value.target === target);
  projectId = context.projectId;
  bucket = target === "demo" ? "demo-takeme.appspot.com" : target === "staging" ? stagingStorageBucket : productionEnvironment.storageBucket;
  Object.assign(process.env, { GCLOUD_PROJECT: projectId, TAKEME_RELEASE_TARGET: target, TAKEME_FIREBASE_PROJECT_ID: projectId,
    TAKEME_STORAGE_BUCKETS: bucket, TAKEME_DELETION_ENVIRONMENT: target,
    TAKEME_ENABLE_STAGING_DELETION: "false", TAKEME_ENABLE_PRODUCTION_DELETION: "false" });
  if (target === "demo") Object.assign(process.env, { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
  documents = new Map(); writes = []; reads = []; transactionReads = []; authReads = 0; beforeRead = null; failControlRead = false; handlerEntries = 0;
  return context;
}
function allowDemo() {
  documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  documents.set(onboardingPath, { termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion,
    termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: "web" });
}

test("public status is minimal and read-only; absent controls never auto-create records", async () => {
  assert.deepEqual(runtime.getProtectedWriteStatus.__endpoint.region, ["asia-southeast1"], "Status must use the same explicit regional client endpoint as protected actions.");
  assert.equal(runtime.getProtectedWriteStatus.__endpoint.maxInstances, 20, "Public status retains the existing Functions instance cap without relying on import-order global defaults.");
  for (const target of ["demo", "staging", "production"]) {
    const context = reset(target);
    assert.deepEqual(await runtime.getProtectedWriteStatus.run({ data: {} }), { protectedWritesPaused: false });
    assert.deepEqual(reads, [controlPath]); assert.equal(authReads, 0); assert.deepEqual(writes, []);
    assert.equal(documents.has(controlPath), false); assert.equal(documents.has(policyPath), false);
    for (const paused of [true, false]) {
      documents.set(controlPath, control(context, paused));
      assert.deepEqual(await runtime.getProtectedWriteStatus.run({ data: {} }), { protectedWritesPaused: paused });
    }
  }
});

test("read failure, invalid context and present undefined/null records return only paused status", async () => {
  reset(); failControlRead = true;
  assert.deepEqual(await runtime.getProtectedWriteStatus.run({ data: {} }), { protectedWritesPaused: true });
  await assert.rejects(mutator.run(request()), rejection);
  assert.equal(authReads, 0); assert.equal(handlerEntries, 0); assert.deepEqual(writes, []);
  reset(); process.env.TAKEME_FIREBASE_PROJECT_ID = "untrusted-project";
  assert.deepEqual(await runtime.getProtectedWriteStatus.run({ data: {} }), { protectedWritesPaused: true });
  await assert.rejects(mutator.run(request()), rejection);
  assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  for (const value of [null, undefined, { protectedWritesPaused: false }]) {
    reset(); documents.set(controlPath, value);
    assert.deepEqual(await runtime.getProtectedWriteStatus.run({ data: {} }), { protectedWritesPaused: true });
  }
});

test("maintenance rejects before policy/lifecycle and arguments, including pending resolution and uploads", async () => {
  for (const lifecycle of [undefined, { state: "deletion_pending", alias: "deleted-synthetic" }]) {
    const context = reset(); documents.set(controlPath, control(context));
    if (lifecycle) documents.set(lifecyclePath, lifecycle);
    for (const handler of [mutator, resolutionMutationCall(async () => { handlerEntries++; }), requestUploadPermits]) {
      await assert.rejects(handler.run(request()), rejection);
    }
    assert.equal(handlerEntries, 0); assert.equal(authReads, 0);
    assert.deepEqual(reads, [controlPath, controlPath, controlPath]); assert.deepEqual(writes, []);
  }
});

test("OFF or absent maintenance retains eligibility enforcement and one explicit mutation", async () => {
  for (const present of [false, true]) {
    const context = reset(); if (present) documents.set(controlPath, control(context, false));
    await assert.rejects(mutator.run(request()), error => error.details?.reason === "policy-release-unavailable");
    assert.equal(handlerEntries, 0); assert.deepEqual(writes, []);
    allowDemo();
    assert.deepEqual(await mutator.run(request()), { completed: true });
    assert.equal(handlerEntries, 1); assert.deepEqual(writes, [{ path: "syntheticWrites/result", kind: "set" }]);
    assert.equal(transactionReads[0], controlPath, "Control is the first guarded transaction read.");
  }
});

test("enabling maintenance between callable preflight and its guarded transaction prevents the write", async () => {
  const context = reset(); allowDemo(); documents.set(controlPath, control(context, false));
  beforeRead = (path, transaction) => { if (transaction && path === controlPath) documents.set(controlPath, control(context, true)); };
  await assert.rejects(mutator.run(request()), rejection);
  assert.equal(handlerEntries, 1); assert.deepEqual(transactionReads, [controlPath]); assert.deepEqual(writes, []);
});

test("paused actions are not queued/replayed when OFF resumes; only a new explicit call writes", async () => {
  const context = reset(); allowDemo(); documents.set(controlPath, control(context));
  await assert.rejects(mutator.run(request()), rejection);
  documents.set(controlPath, control(context, false));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(handlerEntries, 0); assert.deepEqual(writes, []);
  await mutator.run(request()); assert.equal(handlerEntries, 1); assert.equal(writes.length, 1);
});

test("read wrappers and unscoped derived transactions remain available during maintenance", async () => {
  const context = reset(); documents.set(controlPath, control(context));
  const read = marketplaceCall(async () => runGuardedTransaction(db, async tx => (await tx.get(db.doc("syntheticRead/public"))).data() ?? {}));
  assert.deepEqual(await read.run(request()), {});
  await runGuardedTransaction(db, async tx => { tx.set(db.doc("syntheticDerived/already-committed-event"), { processed: true }); });
  assert.equal(reads.includes(controlPath), false);
  assert.deepEqual(writes, [{ path: "syntheticDerived/already-committed-event", kind: "set" }]);
});

test("acceptance, first profile completion and welcome completion remain available during maintenance", async () => {
  const context = reset(); documents.set(controlPath, control(context));
  documents.set(policyPath, { releaseTarget: "demo", projectId: "demo-takeme", ...demoReleasePolicy });
  documents.set(`users/${uid}`, { displayName: "Synthetic maintenance owner" });
  await onboarding.acceptWebPolicies.run(request({ acceptTerms: true, acceptPrivacy: true, confirmAge18: true,
    termsVersion: demoReleasePolicy.termsVersion, privacyVersion: demoReleasePolicy.privacyVersion }));
  await onboarding.completeFirstTimeProfile.run(request());
  await onboarding.finishAccountWelcome.run(request());
  assert.equal((await onboarding.getAccountSetupStatus.run(request())).step, "ready");
  assert.equal(reads.includes(controlPath), false);
  assert.deepEqual(documents.get(controlPath), control(context));
  assert.ok(documents.get(onboardingPath).termsAcceptedAt); assert.ok(documents.get(onboardingPath).welcomeCompletedAt);
  assert.equal(writes.some(write => write.path === controlPath), false);
});

test("signed-out mutations retain authentication rejection without private state reads", async () => {
  reset(); await assert.rejects(requestUploadPermits.run({ data: {} }), { code: "unauthenticated" });
  assert.deepEqual(reads, []); assert.equal(authReads, 0); assert.deepEqual(writes, []);
});

test("every callable/trigger export has an explicit maintenance classification", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ts = require("typescript");
  const sourceDir = path.resolve(__dirname, "../src");
  const groups = {
    protected: `cancelAuction cancelPromotionRequest confirmTransactionCompletion createAuctionListing createFixedListingDraft
      createPromotionRequest declineTransactionCancellation deleteSavedSearch disputeTransaction markAllNotificationsRead
      markConversationSeen markNotificationRead openListingConversation openNotification openTransactionConversation placeBid
      publishAuctionListing publishFixedListing removeFixedListing reportPublicReview requestTransactionCancellation respondToOffer
      saveSearch sendConversationMessage setNotificationPreference setSellerFollow submitMarketplaceReport submitOffer
      submitTransactionReview trackMarketplaceEvent trackPromotionEngagement updateAdminReport updateAuctionListing updateFixedListing
      requestUploadPermits createProtectedPayment respondToProtectedDispute addProtectedDisputeEvidence
      mutateAdminEditorial publishAdminHomepage requestAdminAssetPermit finalizeAdminAsset`.split(/\s+/),
    readOnly: `getAdminMetrics getAdminPage getAdminRecord getAuctionViewerState getConversation getConversationMessages
      getConversations getFeaturedPromotions getFollowState getFollowing getListingDealState getMarketplaceDiscovery
      getMarketplaceRecommendations getMarketplaceSimilar getMyListingHistory getMyPromotionRequests getMyTransactions
      getNotificationPreferences getNotifications getPromotionPackages getPromotionPlacements getPublicListingDetail getPublicListingPage
      getPublicReviews getPublicSellerSummaries getReputationPolicy getSavedSearches getTransactionDetail getUnreadCount
      getAccountSetupStatus getAccountDeletionAvailability getAccountDeletionStatus getProtectedPaymentPolicy getSellerPaymentOnboarding
      getProtectedWriteStatus getAdminEditorialPage getAdminEditorialRecord previewAdminHomepage getPublicHomepage getAdminControlOverview getAdminSession`.split(/\s+/),
    specialWrite: `acceptWebPolicies completeFirstTimeProfile finishAccountWelcome requestAccountDeletion retryAccountDeletion loadAdminReportContext`.split(/\s+/),
    derived: `onSavedListingCreated onSavedListingDeleted onAuctionBidCreated onConversationStarted onConversationMessageCreated
      onCompletedTransactionInterest onAuctionWonCreateTransaction onBidEngagementCreated onListingEngagementChanged
      onMessageEngagementCreated onOfferEngagementCreated onOfferEngagementUpdated onPromotedListingUpdated onSavedWatchChanged
      onTransactionConversationCreated onTransactionEngagementCreated onTransactionEngagementUpdated
      invalidateEditorialListing invalidateEditorialSeller invalidateEditorialLifecycle`.split(/\s+/),
    schedules: `advanceAuctionLifecycle processEngagementJobs expireOffers releaseExpiredReviews queueEndingAuctionAlerts
      expirePromotions processAccountDeletions`.split(/\s+/),
  };
  assert.deepEqual(Object.values(groups).map(names => names.length), [42, 41, 6, 20, 7]);
  const classified = Object.values(groups).flat();
  assert.equal(new Set(classified).size, 116, "No classification may overlap or omit an export.");
  const constructors = new Map(), helpers = new Map(), exported = new Set();
  for (const file of fs.readdirSync(sourceDir).filter(name => name.endsWith(".ts"))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(sourceDir, file), "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) helpers.set(statement.name.text, statement.getText(source));
      if (ts.isVariableStatement(statement)) {
        const isExport = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue;
          constructors.set(declaration.name.text, { constructor: declaration.initializer.expression.getText(source), source: declaration.getText(source) });
          if (file === "index.ts" && isExport) exported.add(declaration.name.text);
        }
      }
      if (file === "index.ts" && ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const entry of statement.exportClause.elements) exported.add(entry.name.text);
      }
    }
  }
  assert.deepEqual([...exported].sort(), [...classified].sort(), "A new export requires explicit maintenance classification.");
  for (const name of groups.protected) {
    const entry = constructors.get(name);
    assert.ok(["marketplaceMutationCall", "resolutionMutationCall"].includes(entry?.constructor), `${name} must use a protected mutation wrapper.`);
    // The disabled payment creation stub has no write to commit; every other
    // protected handler rereads maintenance in its actual guarded transaction.
    if (name !== "createProtectedPayment") {
      const guarded = entry.source.includes("runGuardedTransaction")
        || entry.source.includes("recordMarketplaceSignal(") && helpers.get("recordMarketplaceSignal")?.includes("runGuardedTransaction");
      assert.ok(guarded, `${name} must protect its write transaction directly or through the guarded signal helper.`);
    }
  }
  for (const name of groups.readOnly) assert.ok(["marketplaceCall", "resolutionCall", "onCall"].includes(constructors.get(name)?.constructor), `${name} is an explicit read exemption.`);
  for (const name of groups.specialWrite) assert.ok(["marketplaceCall", "onCall"].includes(constructors.get(name)?.constructor), `${name} is an explicit lifecycle/onboarding exemption.`);
  for (const name of groups.derived) assert.ok(/^onDocument(?:Created|Updated|Deleted|Written)$/.test(constructors.get(name)?.constructor ?? ""), `${name} is an explicit committed-event exemption.`);
  for (const name of groups.schedules) assert.equal(constructors.get(name)?.constructor, "onSchedule", `${name} is an explicit scheduled-work exemption.`);
});

test.after(() => {
  for (const [module, key, descriptor] of descriptors) Object.defineProperty(module, key, descriptor);
  for (const [name, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  globalThis.fetch = savedNetwork.fetch; net.Socket.prototype.connect = savedNetwork.connect;
  http.request = savedNetwork.httpRequest; http.get = savedNetwork.httpGet;
  https.request = savedNetwork.httpsRequest; https.get = savedNetwork.httpsGet;
  assert.equal(networkAttempts, 0, "Maintenance handler tests must remain completely offline.");
});
