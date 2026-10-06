import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { verifyRollbackPackage } from "../scripts/verify-rollback-package.mjs";
test("rollback verifier binds exact bytes/resource safety and cannot turn a guessed baseline into readiness", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "takeme-rollback-test-"));
  try {
    const bytes = "synthetic rollback artifact", file = path.join(root, "artifact.txt"); await writeFile(file, bytes);
    const manifest = { purpose: "v1-rollback-review", component: "frontend", root, projectId: "takeme-52b80", storageBucket: "takeme-52b80.firebasestorage.app", siteUrl: "https://takeme.my",
      deletionEnabled: false, paymentsEnabled: false, publicationApproved: false, deploymentApproved: false, productionModified: false, baselineVerified: false,
      files: [{ path: "artifact.txt", bytes: Buffer.byteLength(bytes), sha256: createHash("sha256").update(bytes).digest("hex") }] };
    const input = path.join(root, "manifest.json"); const put = async (value: unknown) => writeFile(input, JSON.stringify(value));
    await put(manifest); const result = await verifyRollbackPackage(input); assert.equal(result.integrityVerified, true); assert.equal(result.rollbackReady, false);
    await put({ ...manifest, baselineVerified: true }); assert.equal((await verifyRollbackPackage(input)).rollbackReady, true);
    await writeFile(file, "changed"); await assert.rejects(verifyRollbackPackage(input), /mismatch/); await writeFile(file, bytes);
    for (const patch of [{ projectId: "demo-takeme" }, { deletionEnabled: true }, { publicationApproved: true }, { deploymentApproved: true }, { files: [{ ...manifest.files[0], path: "../escape" }] }, { files: [manifest.files[0], manifest.files[0]] }]) {
      await put({ ...manifest, ...patch }); await assert.rejects(verifyRollbackPackage(input));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
