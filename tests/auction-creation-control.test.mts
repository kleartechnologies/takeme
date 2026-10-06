import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { auctionCreationIsPaused, validateAuctionCreationControl, assessZeroAuctionActivation, type AuctionCreationControl } from "../functions/src/auction-creation-control.ts";
import { assessV1ActivationDrain, classifyActivationAbort } from "../functions/src/activation-rehearsal.ts";
import { planProductionAuctionControl, applyProductionAuctionControl, readZeroAuctionCounts, type AuctionControlStore } from "../functions/src/production-auction-control.ts";
import type { MaintenanceSnapshot } from "../functions/src/production-maintenance-control.ts";
import { prepareAuctionCreationRuleGuard } from "../scripts/auction-creation-rule-preparation.mjs";

const context = { target: "production" as const, projectId: "takeme-52b80" };
const record = (paused: boolean): AuctionCreationControl => ({ releaseTarget: context.target, projectId: context.projectId, auctionCreationPaused: paused });
const runtime = { env: { GCLOUD_PROJECT: "takeme-52b80", TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80", TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_ENABLE_PRODUCTION_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false" }, appProjectId: "takeme-52b80", appStorageBucket: "takeme-52b80.firebasestorage.app" };
const plan = (action: "freeze" | "restore", state: "absent" | "off" | "on" = "absent", token: string | null = state === "absent" ? null : "100.000000001") => planProductionAuctionControl(runtime, action, state, token);
const policy = { publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 as const };
const legal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "approved" as const, address: "approved" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };
const mirror = { releaseTarget: "production", projectId: "takeme-52b80", ...policy };
function store(initial?: unknown, maintenance: unknown = { releaseTarget: "production", projectId: "takeme-52b80", protectedWritesPaused: false }, runtimePolicy: unknown = mirror) {
  let snapshot: MaintenanceSnapshot = { exists: initial !== undefined, data: initial, updateTime: initial === undefined ? null : "100.000000001" }, reads = 0, writes = 0;
  const db: AuctionControlStore = {
    transaction: async handler => {
      const pending: AuctionCreationControl[] = [];
      const result = await handler({ readAuctionControl: async () => { reads++; return snapshot; }, readMaintenance: async () => maintenance, readPolicy: async () => runtimePolicy,
        create: value => { assert.equal(snapshot.exists, false); pending.push(value); }, replace: value => pending.push(value) });
      if (pending.length) { assert.equal(pending.length, 1); writes++; snapshot = { exists: true, data: pending[0], updateTime: "101.000000002" }; }
      return result;
    }, readAuctionControl: async () => snapshot,
  };
  return { db, stats: () => ({ reads, writes }), snapshot: () => snapshot };
}

test("auction control is exact, absent-compatible and fail-closed for unknown schema/identity", () => {
  assert.equal(auctionCreationIsPaused(undefined, context), false);
  assert.equal(auctionCreationIsPaused(record(false), context), false);
  assert.equal(auctionCreationIsPaused(record(true), context), true);
  for (const value of [null, {}, [], { ...record(false), extra: true }, { ...record(false), auctionCreationPaused: "false" }, { ...record(false), projectId: "foreign" }, Object.create(record(false))]) assert.equal(auctionCreationIsPaused(value, context), true);
  assert.equal(auctionCreationIsPaused(undefined, null), true);
  assert.equal(validateAuctionCreationControl(record(false), { target: "demo", projectId: "takeme-52b80" }), null);
});
test("zero-auction gate requires fresh frozen admission coverage and includes published scheduled auctions without X/Y", () => {
  const value = { active: 0, scheduled: 0, creationFrozen: true, freezeTokenUnchanged: true, admissionGuardsVerified: true, oldAdmissionsDrained: true, lifecycleHealthy: true, fresh: true };
  assert.equal(assessZeroAuctionActivation(value).ready, true);
  assert.equal(assessZeroAuctionActivation(value).activationAuthorized, false);
  for (const field of ["active", "scheduled"] as const) for (const count of [1, null, -1, NaN]) assert.equal(assessZeroAuctionActivation({ ...value, [field]: count }).ready, false);
  for (const field of ["creationFrozen", "freezeTokenUnchanged", "admissionGuardsVerified", "oldAdmissionsDrained", "lifecycleHealthy", "fresh"] as const) assert.equal(assessZeroAuctionActivation({ ...value, [field]: false }).ready, false);
});
test("900-second checkpoint starts at verified effective pause and still requires settlement/retirement", () => {
  const evidence = { now: 900_000, effectivePauseVerifiedAt: 0, lastOldRequestAt: 0, lastPermitIssuedAt: 0, ruleBridgeDeployedAt: 0, oldRevisionsRetired: true, runtimeQuiescenceVerified: true, historicalUploadsSettled: true, newPermitsStopped: true, freezeEnforcementVerified: true, directWriteEnforcementVerified: true };
  assert.equal(assessV1ActivationDrain({ ...evidence, now: 120_000 }).ready, false);
  assert.equal(assessV1ActivationDrain({ ...evidence, now: 899_999 }).ready, false);
  assert.equal(assessV1ActivationDrain(evidence).ready, true);
  assert.equal(assessV1ActivationDrain({ ...evidence, effectivePauseVerifiedAt: 1 }).ready, false);
  assert.equal(assessV1ActivationDrain({ ...evidence, effectivePauseVerifiedAt: null }).ready, false);
  assert.equal(assessV1ActivationDrain({ ...evidence, now: 9_000_000, historicalUploadsSettled: false }).ready, false);
  assert.equal(assessV1ActivationDrain({ ...evidence, lastOldRequestAt: 899_000 }).ready, false);
  for (const phase of ["pausedBeforePolicy", "policyBootstrapped", "partiallyCoordinated", "reopened"] as const) { assert.equal(classifyActivationAbort(phase).keepOrReestablishPause, true); assert.equal(classifyActivationAbort(phase).legacyReopenAllowed, false); }
});
test("auction freeze is fixed-document CAS/idempotent and never activates policy or repairs malformed control", async () => {
  const subject = store(); const receipt = await applyProductionAuctionControl(subject.db, plan("freeze"));
  assert.equal(receipt.auctionCreationPaused, true); assert.equal(subject.stats().writes, 1);
  assert.equal((await applyProductionAuctionControl(subject.db, plan("freeze", "on", receipt.updateTime))).result, "already-current");
  assert.equal(subject.stats().writes, 1);
  for (const value of [record(true), {}, { ...record(false), extra: 1 }]) { const denied = store(value); await assert.rejects(applyProductionAuctionControl(denied.db, plan("freeze", "off"))); assert.equal(denied.stats().writes, 0); }
  const stale = store(record(false)); await assert.rejects(applyProductionAuctionControl(stale.db, plan("freeze", "off", "99.000000001"))); assert.equal(stale.stats().writes, 0);
  await assert.rejects(applyProductionAuctionControl(subject.db, { ...plan("freeze"), path: "releasePolicies/current" } as never));
  assert.throws(() => plan("restore"));
  assert.throws(() => planProductionAuctionControl({ ...runtime, appProjectId: "demo-takeme" }, "freeze", "absent"));
});
test("auction restore requires final source before store access and explicit maintenance OFF + policy in transaction", async () => {
  const subject = store(record(true)); await assert.rejects(applyProductionAuctionControl(subject.db, plan("restore", "on")), /separately approved/); assert.equal(subject.stats().reads, 0);
  for (const maintenance of [null, { releaseTarget: "production", projectId: "takeme-52b80", protectedWritesPaused: true }, { protectedWritesPaused: false }]) { const denied = store(record(true), maintenance); await assert.rejects(applyProductionAuctionControl(denied.db, plan("restore", "on"), policy, legal), /maintenance OFF/); assert.equal(denied.stats().writes, 0); }
  const denied = store(record(true), undefined, { ...mirror, publicationApproved: false }); await assert.rejects(applyProductionAuctionControl(denied.db, plan("restore", "on"), policy, legal), /policy parity/); assert.equal(denied.stats().writes, 0);
  const allowed = store(record(true)); assert.equal((await applyProductionAuctionControl(allowed.db, plan("restore", "on"), policy, legal)).auctionCreationPaused, false);
});
test("unknown post-commit readback does not trigger repair", async () => {
  const subject = store(); await assert.rejects(applyProductionAuctionControl({ ...subject.db, readAuctionControl: async () => ({ exists: false, updateTime: null }) }, plan("freeze")), /Outcome unknown/); assert.equal(subject.stats().writes, 1);
});
test("aggregate-only check rejects drift, missing freeze, unknown/nonzero counts without listing reads", async () => {
  const frozen = { exists: true, data: record(true), updateTime: "100.000000001" }, calls: string[] = [];
  const subject = { readAuctionControl: async () => frozen, countPublished: async (status: "active" | "scheduled") => { calls.push(status); return 0; } };
  assert.equal((await readZeroAuctionCounts(subject, frozen.updateTime)).zeroPublishedUnfinishedAuctions, true); assert.deepEqual(calls.sort(), ["active", "scheduled"]);
  assert.equal((await readZeroAuctionCounts({ ...subject, countPublished: async status => status === "scheduled" ? 1 : 0 }, frozen.updateTime)).zeroPublishedUnfinishedAuctions, false);
  await assert.rejects(readZeroAuctionCounts({ ...subject, countPublished: async () => NaN }, frozen.updateTime));
  let read = 0; await assert.rejects(readZeroAuctionCounts({ ...subject, readAuctionControl: async () => ({ ...frozen, updateTime: ++read === 1 ? frozen.updateTime : "101.000000001" }) }, frozen.updateTime));
  await assert.rejects(readZeroAuctionCounts({ ...subject, readAuctionControl: async () => ({ exists: false, updateTime: null }) }, frozen.updateTime));
});
test("rule overlay preserves other permissions, adds only scoped admission, refuses unknown/double inputs", async () => {
  const current = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(current, /\(isAdmin\(\) && marketplaceEligible\(\)\) && auctionAdmissionAllowed\(\)/);
  assert.match(current, /request\.method == 'delete'/);
  assert.match(current, /match \/releaseControls\/\{id\}/);
  assert.throws(() => prepareAuctionCreationRuleGuard(current), /already exists/);
  assert.throws(() => prepareAuctionCreationRuleGuard("unreviewed"), /Known/);
});
test("auction CLI plans offline and refuses wrong target/closed restore before credential loading", async () => {
  const run = (args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/control-production-auctions.mjs", ...args], { cwd: new URL("../", import.meta.url), env: { NODE_ENV: "test", PATH: process.env.PATH, ...runtime.env }, encoding: "utf8" });
  const result = run(["--plan", "--action", "freeze", "--expected-state", "absent", "--project", "takeme-52b80"]); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).cloudAccessed, false);
  assert.notEqual(run(["--apply", "--action", "restore", "--expected-state", "on", "--expected-update-time", "100.000000001", "--project", "takeme-52b80", "--owner-approved-auction-restore"]).status, 0);
  assert.notEqual(run(["--check", "--expected-update-time", "100.000000001", "--project", "demo-takeme"]).status, 0);
  const source = await readFile(new URL("../scripts/control-production-auctions.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("assertAuctionControlSource(plan)") < source.indexOf('require("firebase-admin/app")'));
  assert.doesNotMatch(source, /\.delete\(|merge:\s*true|setTimeout\(|setInterval\(/);
  assert.match(source, /\.count\(\)\.get\(\)/);
});
