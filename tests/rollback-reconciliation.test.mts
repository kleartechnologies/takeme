import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("durable bridge verification and rollback reconciliation pass with synthetic offline evidence", () => {
  const result = spawnSync("python3", ["-B", fileURLToPath(new URL("./rollback_reconciliation_test.py", import.meta.url))], {
    encoding: "utf8", timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 51 tests/);
  assert.match(result.stderr, /\bOK\b/);
});

test("reviewed rollback references preserve history without embedding private bundle contents or authorizing execution", async () => {
  const reference = JSON.parse(await readFile(new URL("../docs/function-rollback-baseline-reference.json", import.meta.url), "utf8"));
  assert.equal(reference.projectId, "takeme-52b80");
  assert.equal(reference.functionCount, 91);
  assert.equal(reference.restoredFunctions.length, 3);
  assert.equal(reference.restoredRevisionChanges, 3);
  assert.equal(reference.deploymentAuthorized, false);
  assert.equal(reference.productionModified, false);
  for (const key of ["publicationApproved", "deletionEnabled", "paymentsEnabled"]) assert.equal(reference[key], false);
  for (const key of ["historicalManifestSha256", "historicalInventorySha256", "reconciledManifestSha256", "reconciledInventorySha256"]) assert.match(reference[key], /^[a-f0-9]{64}$/);
  for (const row of reference.restoredFunctions) {
    assert.notEqual(row.historicalRevision, row.restoredRevision);
    assert.notEqual(row.temporaryBridgeRevision, row.restoredRevision);
  }
  assert.doesNotMatch(JSON.stringify(reference), /\/Users\/|\/private\/tmp\/|environmentVariables|uploadUrl|X-Goog-Signature|AIza/);
});

test("runbook requires durable verification and keeps operational authorization separate", async () => {
  const doc = await readFile(new URL("../docs/v1-production-activation-runbook.md", import.meta.url), "utf8");
  assert.match(doc, /neither equality with the temporary upload object nor its continued availability is a success condition/);
  assert.match(doc, /generation-pinned managed deployment source/);
  assert.match(doc, /missing or mismatched durable evidence still stops the batch/);
  assert.match(doc, /safe maintenance-OFF status\/authentication control paths without customer writes/);
  assert.match(doc, /do not authorize deployment or weaken any freeze, pause, drain, rollback or owner gate/);
});
