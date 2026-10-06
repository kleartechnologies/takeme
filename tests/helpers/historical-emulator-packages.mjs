import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

// Validate reviewed private-package provenance; a dated temp-folder name is not
// evidence. This helper performs no cloud operation and accepts demo only.
export async function assertHistoricalEmulatorPackages(env, names) {
  assert.equal(env.GCLOUD_PROJECT, 'demo-takeme');
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const manifestPath = env.TAKEME_HISTORICAL_REVIEW_MANIFEST;
  assert.ok(manifestPath && path.isAbsolute(manifestPath));
  const resolved = await realpath(manifestPath);
  assert.ok(resolved.startsWith('/private/tmp/'), 'Private outside-Git review manifest required.');
  const manifest = JSON.parse(await readFile(resolved, 'utf8'));
  assert.equal(manifest.purpose, 'historical-maintenance-bridge-review');
  assert.equal(manifest.projectId, 'takeme-52b80');
  for (const flag of ['deployable', 'deploymentApproved', 'cloudAccessed', 'productionModified', 'policyActivated', 'deletionEnabled', 'paymentsEnabled']) assert.equal(manifest[flag], false);
  assert.equal(manifest.protectedNames.length, 35); assert.equal(new Set(manifest.protectedNames).size, 35);
  assert.equal(manifest.groups.length, 6);
  for (const name of names) {
    assert.ok(env[name] && path.isAbsolute(env[name]));
    assert.ok((await realpath(env[name])).startsWith('/private/tmp/'), 'Private isolated compiled package/rule path required.');
  }
  return manifest;
}
