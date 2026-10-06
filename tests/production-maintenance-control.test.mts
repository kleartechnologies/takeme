import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  applyProductionMaintenance, planProductionMaintenance, productionMaintenanceRecordMatches,
  type MaintenanceControlRecord, type MaintenanceControlStore, type MaintenanceSnapshot,
  type MaintenanceAction, type ExpectedMaintenanceState,
} from "../functions/src/production-maintenance-control.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";

const runtime = () => ({ env: { GCLOUD_PROJECT: "takeme-52b80", TAKEME_RELEASE_TARGET: "production", TAKEME_FIREBASE_PROJECT_ID: "takeme-52b80",
  TAKEME_STORAGE_BUCKETS: "takeme-52b80.firebasestorage.app", TAKEME_ENABLE_PRODUCTION_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false" },
  appProjectId: "takeme-52b80", appStorageBucket: "takeme-52b80.firebasestorage.app" });
const record = (paused: boolean): MaintenanceControlRecord => ({ releaseTarget: "production", projectId: "takeme-52b80", protectedWritesPaused: paused });
const plan = (action: MaintenanceAction, state: ExpectedMaintenanceState = "absent", token: string | null = state === "absent" ? null : "100.000000001") => planProductionMaintenance(runtime(), action, state, token);
const futurePolicy = { publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 as const };
const futureLegal = { publicationApproved: true, finalContentApproved: true, bmPrivacyNoticeApproved: true, registration: "approved" as const,
  address: "approved" as const, productionRoutesReviewed: true, effectiveDate: "2099-01-01", lastUpdated: "2099-01-01" };
const mirror = { releaseTarget: "production", projectId: "takeme-52b80", ...futurePolicy };

function store(initial?: unknown, policy: unknown = mirror) {
  let current: MaintenanceSnapshot = { exists: initial !== undefined, data: initial, updateTime: initial === undefined ? null : "100.000000001" };
  let writes = 0, controlReads = 0, policyReads = 0;
  const db: MaintenanceControlStore = {
    transaction: async operation => {
      const pending: Readonly<MaintenanceControlRecord>[] = [];
      const result = await operation({
        readControl: async () => { controlReads++; return current; },
        readPolicy: async () => { policyReads++; return policy; },
        createControl: value => { assert.equal(current.exists, false); pending.push(value); },
        replaceControl: value => { assert.equal(current.exists, true); pending.push(value); },
      });
      if (pending.length) { assert.equal(pending.length, 1); current = { exists: true, data: { ...pending[0] }, updateTime: "101.000000002" }; writes++; }
      return result;
    },
    readControl: async () => current,
  };
  return { db, stats: () => ({ writes, controlReads, policyReads }), snapshot: () => current };
}

test("operator planning is fixed-resource, exact three-field and does not activate policy or dates", () => {
  const proposed = plan("enable");
  assert.deepEqual(proposed.record, record(true));
  assert.equal(proposed.path, "releaseControls/current");
  assert.equal(Object.isFrozen(proposed), true);
  assert.equal(Object.isFrozen(proposed.record), true);
  assert.deepEqual(Object.keys(proposed.record).sort(), ["releaseTarget", "projectId", "protectedWritesPaused"].sort());
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.effectiveDate, "2026-10-12");
  assert.equal(legalPublicationReadiness.lastUpdated, "2026-10-12");
});

test("operator rejects wrong or mixed resources, emulator flags and deletion/payment activation", () => {
  for (const patch of [{ GCLOUD_PROJECT: "demo-takeme" }, { GOOGLE_CLOUD_PROJECT: "foreign-project" }, { TAKEME_RELEASE_TARGET: "staging" },
    { TAKEME_FIREBASE_PROJECT_ID: "takeme-staging-822a5" }, { TAKEME_STORAGE_BUCKETS: "takeme-52b80.appspot.com" },
    { FIRESTORE_EMULATOR_HOST: "" }, { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" }, { TAKEME_ENABLE_PRODUCTION_DELETION: "true" },
    { PROTECTED_PAYMENTS_ENABLED: "true" }, { FIREBASE_CONFIG: "{}" }, { FIREBASE_CONFIG: "not-json" }]) {
    assert.throws(() => planProductionMaintenance({ ...runtime(), env: { ...runtime().env, ...patch } }, "enable", "absent"));
  }
  assert.throws(() => planProductionMaintenance({ ...runtime(), appProjectId: "foreign" }, "enable", "absent"));
  assert.throws(() => planProductionMaintenance({ ...runtime(), appStorageBucket: "foreign" }, "enable", "absent"));
});

test("existing state needs an exact compare-and-set token; reopen cannot create an absent record", () => {
  for (const token of [null, "", "100", "100.1", " 100.000000001", "100.000000001 "]) assert.throws(() => plan("enable", "off", token));
  assert.throws(() => plan("enable", "absent", "100.000000001"));
  assert.throws(() => plan("disable", "absent"));
});

test("enable can pause before legal bootstrap; CAS repeat changes nothing and always reads back", async () => {
  const first = store();
  const receipt = await applyProductionMaintenance(first.db, plan("enable"));
  assert.equal(receipt.protectedWritesPaused, true);
  assert.equal(receipt.source, "owner-operator-script");
  assert.equal(first.stats().writes, 1);
  assert.equal(first.stats().policyReads, 0);
  const repeated = await applyProductionMaintenance(first.db, plan("enable", "on", receipt.updateTime));
  assert.equal(repeated.result, "already-current");
  assert.equal(first.stats().writes, 1);
});

test("stale token, wrong state, malformed or foreign control is never repaired", async () => {
  for (const value of [record(true), { ...record(false), extra: true }, { ...record(false), projectId: "foreign" }, null, { protectedWritesPaused: false }]) {
    const subject = store(value);
    await assert.rejects(applyProductionMaintenance(subject.db, plan("enable", "off")), /differs|changed/);
    assert.equal(subject.stats().writes, 0);
  }
  const stale = store(record(false));
  await assert.rejects(applyProductionMaintenance(stale.db, plan("enable", "off", "99.000000001")));
  assert.equal(stale.stats().writes, 0);
});

test("reopen refuses before SDK/store access when actual final source is closed", async () => {
  const subject = store(record(true));
  await assert.rejects(applyProductionMaintenance(subject.db, plan("disable", "on")), /separately approved/);
  assert.deepEqual(subject.stats(), { writes: 0, controlReads: 0, policyReads: 0 });
});

test("future approved reopen checks the exact live policy in the same transaction", async () => {
  const subject = store(record(true));
  const receipt = await applyProductionMaintenance(subject.db, plan("disable", "on"), futurePolicy, futureLegal);
  assert.equal(receipt.protectedWritesPaused, false);
  assert.equal(subject.stats().writes, 1);
  assert.equal(subject.stats().policyReads, 1);
  for (const policy of [undefined, null, { ...mirror, publicationApproved: false }, { ...mirror, extra: true }, { ...mirror, termsVersion: "old" }]) {
    const denied = store(record(true), policy === undefined ? null : policy);
    await assert.rejects(applyProductionMaintenance(denied.db, plan("disable", "on"), futurePolicy, futureLegal), /Runtime policy/);
    assert.equal(denied.stats().writes, 0);
  }
});

test("readback mismatch or failure is an unknown outcome, never automatically repaired", async () => {
  const subject = store();
  const bad = { ...subject.db, readControl: async () => ({ exists: true, data: record(false), updateTime: "101.000000002" }) };
  await assert.rejects(applyProductionMaintenance(bad, plan("enable")), /Outcome is unknown/);
  assert.equal(subject.stats().writes, 1);
  assert.equal(productionMaintenanceRecordMatches({ ...record(true), extra: true }, record(true)), false);
  const inherited = Object.assign(Object.create(record(true)), { one: 1, two: 2, three: 3 });
  assert.equal(productionMaintenanceRecordMatches(inherited, record(true)), false, "The exact schema requires own fields, not inherited identity/state.");
});

test("forged control plan is refused before any store access", async () => {
  const subject = store();
  await assert.rejects(applyProductionMaintenance(subject.db, { ...plan("enable"), path: "releasePolicies/current" } as never));
  await assert.rejects(applyProductionMaintenance(subject.db, { ...plan("enable"), record: record(false) }));
  assert.equal(subject.stats().controlReads, 0);
});

test("CLI plan stays offline and malformed/reopen apply refuses before credential loading", async () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...runtime().env };
  const run = (args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/control-production-maintenance.mjs", ...args],
    { cwd: new URL("../", import.meta.url), env, encoding: "utf8" });
  const planned = run(["--plan", "--action", "enable", "--expected-state", "absent", "--project", "takeme-52b80"]);
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).cloudAccessed, false);
  assert.notEqual(run(["--apply", "--action", "disable", "--expected-state", "on", "--expected-update-time", "100.000000001", "--project", "takeme-52b80", "--owner-approved-reopen"]).status, 0);
  assert.notEqual(run(["--apply", "--action", "enable", "--expected-state", "absent", "--project", "foreign", "--owner-approved-maintenance"]).status, 0);
  const script = await readFile(new URL("../scripts/control-production-maintenance.mjs", import.meta.url), "utf8");
  assert.ok(script.indexOf("assertMaintenanceApplySource(plan)") < script.indexOf('require("firebase-admin/app")'));
  assert.doesNotMatch(script, /tx\.delete\(|merge:\s*true|setTimeout\(|setInterval\(/);
});
