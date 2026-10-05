import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  reviewedRuleCaptureHashes, prepareMaintenanceRuleBridge, scanRuleAllows, transformRuleAllows,
} from "../scripts/prepare-maintenance-rule-bridge.mjs";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";

const repository = path.resolve(new URL("../", import.meta.url).pathname);
const captureDirectory = "/private/tmp/takeme-backend-parity-preparation.20261005";
const firestoreInput = path.join(captureDirectory, "live-firestore.rules");
const storageInput = path.join(captureDirectory, "live-storage.rules");
const available = existsSync(firestoreInput) && existsSync(storageInput);
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const invoke = (args: string[]) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "scripts/prepare-maintenance-rule-bridge.mjs", ...args], { cwd: repository, encoding: "utf8" });
const inputs = (output: string) => ["--firestore-input", firestoreInput, "--storage-input", storageInput, "--output", output];

test("parenthesized guards preserve OFF conditions and deny ON even through administrator OR branches", () => {
  const input = "allow update: if owns(uid) && validPublicProfile(data, uid) || isAdmin();";
  const { rules, traces } = transformRuleAllows(input, "firestore");
  assert.equal(rules, "allow update: if maintenanceBridgeWritesAllowed() && (owns(uid) && validPublicProfile(data, uid) || isAdmin());");
  assert.equal(traces[0].behavior, "guarded-write");
  const evaluate = (condition: string, permitted: boolean, owner: boolean, valid: boolean, admin: boolean) =>
    Function("maintenanceBridgeWritesAllowed", "owns", "validPublicProfile", "isAdmin", "uid", "data", `return (${condition});`)(() => permitted, () => owner, () => valid, () => admin, "synthetic", {});
  const previous = scanRuleAllows(input)[0].condition, changed = scanRuleAllows(rules)[0].condition;
  for (const owner of [true, false]) for (const valid of [true, false]) for (const admin of [true, false]) {
    assert.equal(evaluate(changed, true, owner, valid, admin), evaluate(previous, true, owner, valid, admin));
    assert.equal(evaluate(changed, false, owner, valid, admin), false, "Paused writes must not escape through || isAdmin().");
  }
});

test("pure overlay preserves read/denial clauses and only the exact reviewed initial profile create exception", () => {
  const input = `allow get: if owns(uid) || publicProfileSafe(resource.data, uid);
allow list: if false;
allow create: if owns(uid) && validPublicProfile(request.resource.data, uid);
allow delete: if isAdmin();
allow read, write: if false;`;
  const { rules, traces } = transformRuleAllows(input, "firestore");
  const previous = scanRuleAllows(input), changed = scanRuleAllows(rules);
  assert.deepEqual(traces.map((trace: { behavior: string }) => trace.behavior), ["preserved-read", "preserved-deny", "preserved-initial-profile-create", "guarded-write", "preserved-deny"]);
  for (const i of [0, 1, 2, 4]) assert.equal(changed[i].original, previous[i].original);
  const altered = input.replace("validPublicProfile(request.resource.data, uid)", "true");
  assert.equal(transformRuleAllows(altered, "firestore").traces[2].behavior, "guarded-write");
  assert.throws(() => transformRuleAllows("allow read, write: if isAdmin();", "firestore"), /Mixed permissive/);
  assert.throws(() => transformRuleAllows("allow approve: if true;", "firestore"), /Unknown rule operation/);
});

test("Storage freeze changes only create/update while reads and owner cleanup deletes retain original conditions", () => {
  const input = "allow read: if true;\nallow create, update: if isOwner(uid) && validImage();\nallow delete: if isOwner(uid);";
  const { rules, traces } = transformRuleAllows(input, "storage");
  assert.equal(rules, "allow read: if true;\nallow create, update: if false;\nallow delete: if isOwner(uid);");
  assert.deepEqual(traces.map((trace: { behavior: string }) => trace.behavior), ["preserved-read", "frozen-storage-write", "preserved-storage-cleanup"]);
  assert.throws(() => transformRuleAllows("allow write: if true;", "storage"), /Unclassified Storage write/);
});

test("unknown hashes never prepare rules or relax the reviewed capture pin", () => {
  assert.throws(() => prepareMaintenanceRuleBridge(Buffer.from("unreviewed"), Buffer.from("unreviewed")), /reviewed SHA-256/);
  assert.equal(Object.isFrozen(reviewedRuleCaptureHashes), true);
  assert.deepEqual(reviewedRuleCaptureHashes, {
    firestore: "879ed4f732b1f85e1d707e4c75dae0d5eae0637049ecbc770103709a3b890422",
    storage: "f1cc00f8ef675e7b44b9d037b76984817837f22ff2f081d8c8aaea24cd8a9cb2",
  });
});

test("CLI refuses missing captures, mismatched bytes, duplicate/unknown/apply arguments before any output", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "takeme-maintenance-bridge-refusal-"));
  const output = path.join(parent, "review");
  try {
    const unreviewed = path.join(parent, "unreviewed.rules"); await writeFile(unreviewed, "rules_version = '2';\n");
    for (const args of [[], ["--apply"],
      ["--firestore-input", unreviewed, "--storage-input", unreviewed, "--apply", output],
      ["--firestore-input", unreviewed, "--firestore-input", unreviewed, "--output", output],
      ["--firestore-input", unreviewed, "--storage-input", unreviewed, "--output", output],
      ["--firestore-input", path.join(parent, "missing"), "--storage-input", unreviewed, "--output", output],
    ]) {
      assert.notEqual(invoke(args).status, 0);
      assert.equal(existsSync(output), false, "Invalid preparation must not create an output directory.");
    }
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("exact captured overlay accounts for all 95/6 clauses without changing read/bootstrap/cleanup semantics", { skip: !available && "Previously reviewed local captures are not present on this machine." }, async () => {
  const fire = await readFile(firestoreInput), storage = await readFile(storageInput);
  assert.equal(digest(fire), reviewedRuleCaptureHashes.firestore); assert.equal(digest(storage), reviewedRuleCaptureHashes.storage);
  const { outputs, manifest } = prepareMaintenanceRuleBridge(fire, storage);
  const fireReview = outputs["firestore.maintenance-bridge.review.rules"], storageReview = outputs["storage.maintenance-freeze.review.rules"];
  assert.equal(manifest.trace.firestore.length, 95); assert.equal(manifest.trace.storage.length, 6);
  assert.equal(manifest.trace.firestore.filter((trace: { behavior: string }) => trace.behavior === "guarded-write").length, 12);
  assert.equal(manifest.trace.firestore.filter((trace: { behavior: string }) => trace.behavior === "preserved-initial-profile-create").length, 1);
  const oldFire = scanRuleAllows(fire.toString("utf8")), newFire = scanRuleAllows(fireReview);
  assert.equal(newFire.length, 96); assert.equal(newFire[0].original, "allow read, write: if false;");
  for (let i = 0; i < oldFire.length; i++) {
    const trace = manifest.trace.firestore[i], current = newFire[i + 1];
    assert.deepEqual(current.operations, oldFire[i].operations);
    if (trace.behavior === "guarded-write") assert.equal(current.condition, (trace as typeof trace & { additionalGuard?: string }).additionalGuard === "auction-admission"
      ? `(maintenanceBridgeWritesAllowed() && (${oldFire[i].condition})) && auctionAdmissionAllowed()`
      : `maintenanceBridgeWritesAllowed() && (${oldFire[i].condition})`);
    else assert.equal(current.original, oldFire[i].original);
    assert.equal(trace.originalConditionSha256, digest(oldFire[i].condition));
    assert.equal(trace.reviewConditionSha256, digest(current.condition));
  }
  const oldStorage = scanRuleAllows(storage.toString("utf8")), newStorage = scanRuleAllows(storageReview);
  for (let i = 0; i < oldStorage.length; i++) {
    if (manifest.trace.storage[i].behavior === "frozen-storage-write") assert.equal(newStorage[i].condition, "false");
    else assert.equal(newStorage[i].original, oldStorage[i].original);
  }
  assert.match(fireReview, /match \/releaseControls\/\{id\} \{ allow read, write: if false; \}/);
  assert.match(fireReview, /keys\(\)\.hasOnly\(\['releaseTarget', 'projectId', 'protectedWritesPaused'\]\)/);
  // The historical listing schema already uses privacyVersion == 2; preserve
  // that data-safety field without introducing legal acceptance/version gates.
  assert.doesNotMatch(fireReview + storageReview, /releasePolicies|termsVersion|configuredAcceptance|publicationApproved|privacyVersion\s*==\s*['"]1\.0/);
  assert.equal(manifest.deployable, false); assert.equal(manifest.currentRemoteParityVerified, false); assert.equal(manifest.cloudAccessed, false);
});

test("valid preparation writes only private review files outside Git and refuses existing output/in-Git targets", { skip: !available && "Previously reviewed local captures are not present on this machine." }, async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "takeme-maintenance-bridge-output-"));
  const output = path.join(parent, "review");
  const inside = path.join(repository, "maintenance-review-output");
  try {
    assert.notEqual(invoke(inputs(inside)).status, 0); assert.equal(existsSync(inside), false);
    assert.notEqual(invoke(inputs(parent)).status, 0); assert.deepEqual(await readdir(parent), []);
    const result = invoke(inputs(output)); assert.equal(result.status, 0, result.stderr);
    assert.equal((await stat(output)).mode & 0o777, 0o700);
    const files = (await readdir(output)).sort();
    assert.deepEqual(files, ["firestore.maintenance-bridge.review.rules", "maintenance-rule-bridge.review.json", "storage.maintenance-freeze.review.rules"]);
    for (const file of files) assert.equal((await stat(path.join(output, file))).mode & 0o777, 0o600);
    const manifest = JSON.parse(await readFile(path.join(output, "maintenance-rule-bridge.review.json"), "utf8"));
    for (const [file, evidence] of Object.entries(manifest.reviewRules)) assert.equal(digest(await readFile(path.join(output, file))), (evidence as { sha256: string }).sha256);
    assert.equal(manifest.activationApproved, false); assert.equal(manifest.deletionEnabled, false);
    const before = await readFile(path.join(output, files[0]));
    assert.notEqual(invoke(inputs(output)).status, 0); assert.deepEqual(await readFile(path.join(output, files[0])), before);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("bridge generator has no cloud/apply/credential loads and leaves source approval/dates closed", async () => {
  const source = await readFile(new URL("../scripts/prepare-maintenance-rule-bridge.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']firebase|fetch\(|spawn\(|exec\(|process\.env|initializeApp\(|applicationDefault\(|cert\(/);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.effectiveDate, null); assert.equal(legalPublicationReadiness.lastUpdated, null);
});
