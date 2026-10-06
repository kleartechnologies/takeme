import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assertFirestorePolicyRules, assertStoragePolicyRules, productionReleasePolicy } from "../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";

const repository = path.resolve(new URL("../", import.meta.url).pathname);
function prepare(args: string[]) {
  return spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "scripts/prepare-policy-activation.mjs", ...args], { cwd: repository, encoding: "utf8" });
}

test("activation preparation creates only review outputs with exact future six-field payload and actual closed source", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "takeme-policy-plan-test-"));
  const output = path.join(parent, "review");
  try {
    const result = prepare(["--output", output]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual((await readdir(output)).sort(), ["firestore.production-review.rules", "policy-activation-review.json", "storage.production-review.rules"]);
    const plan = JSON.parse(await readFile(path.join(output, "policy-activation-review.json"), "utf8"));
    assert.equal(plan.deployable, false);
    assert.equal(plan.cloudAccessed, false);
    assert.equal(plan.activationApproved, false);
    assert.equal(plan.futureDocument.written, false);
    assert.equal(plan.deletionEnabled, false);
    assert.equal(plan.paymentsEnabled, false);
    assert.deepEqual(plan.actualSource, { publicationApproved: false, effectiveDate: "2026-10-12", lastUpdated: "2026-10-12" });
    assert.deepEqual(plan.launchDateProposal, { status: "pending", effectiveDate: null, lastUpdated: null });
    assert.deepEqual(plan.futureDocument.record, { releaseTarget: "production", projectId: "takeme-52b80", publicationApproved: true, termsVersion: "1.0", privacyVersion: "1.0", minimumAge: 18 });
    assert.equal(plan.futureDocument.path, "releasePolicies/current");
    assert.ok(plan.legalBlockers.length > 0);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("review rules retain all client rule bodies while ordinary deployment equality checks reject future activation bytes", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "takeme-policy-rules-plan-test-"));
  try {
    const output = path.join(parent, "review");
    const result = prepare(["--output", output]);
    assert.equal(result.status, 0, result.stderr);
    const fire = await readFile(path.join(output, "firestore.production-review.rules"), "utf8");
    const storage = await readFile(path.join(output, "storage.production-review.rules"), "utf8");
    assert.match(fire, /^\/\/ REVIEW ONLY:/);
    assert.match(storage, /^\/\/ REVIEW ONLY:/);
    assert.throws(() => assertFirestorePolicyRules(fire), /differ/);
    assert.throws(() => assertStoragePolicyRules(storage), /differ/);
    const stripGenerated = (raw: string) => raw.replace(/^\/\/ REVIEW ONLY:.*\n/, "").replace(/    \/\/ BEGIN GENERATED RELEASE POLICY[\s\S]*?    \/\/ END GENERATED RELEASE POLICY/, "[generated]");
    assert.equal(stripGenerated(fire), stripGenerated(await readFile(path.join(repository, "firestore.rules"), "utf8")));
    assert.equal(stripGenerated(storage), stripGenerated(await readFile(path.join(repository, "storage.rules"), "utf8")));
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("activation preparation rejects apply, approval overrides, in-Git output and existing output directories", async () => {
  assert.notEqual(prepare(["--apply"]).status, 0);
  assert.notEqual(prepare(["--output", path.join(repository, "review-output")]).status, 0);
  assert.notEqual(prepare(["--output", "/private/tmp", "--publication-approved", "true"]).status, 0);
  const parent = await mkdtemp(path.join(tmpdir(), "takeme-policy-plan-existing-"));
  try { assert.notEqual(prepare(["--output", parent]).status, 0); }
  finally { await rm(parent, { recursive: true, force: true }); }
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.effectiveDate, "2026-10-12");
  assert.equal(legalPublicationReadiness.lastUpdated, "2026-10-12");
});
