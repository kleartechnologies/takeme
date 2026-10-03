const assert = require('node:assert/strict');
const test = require('node:test');
const adminApp = require('firebase-admin/app');
const adminFirestore = require('firebase-admin/firestore');
const { initializeStagingPolicyMirror } = require('../lib/account-eligibility');
const { stagingReleasePolicy } = require('../lib/release-policy');
const { stagingEnvironment } = require('../lib/staging-environment');

// Entirely synthetic SDK collaborators: no initialized app, ADC or network request.
async function withStagingRuntime(reference, action) {
  const names = new Set(['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GCP_PROJECT', 'FIREBASE_CONFIG', 'TAKEME_RELEASE_TARGET', 'TAKEME_FIREBASE_PROJECT_ID', 'TAKEME_STORAGE_BUCKETS', 'TAKEME_DELETION_ENVIRONMENT', 'TAKEME_ENABLE_STAGING_DELETION', 'TAKEME_ENABLE_PRODUCTION_DELETION', ...Object.keys(process.env).filter(name => /EMULATOR|EMULATORS/.test(name))]);
  const before = Object.fromEntries([...names].map(name => [name, process.env[name]]));
  const appDescriptor = Object.getOwnPropertyDescriptor(adminApp, 'getApp');
  const firestoreDescriptor = Object.getOwnPropertyDescriptor(adminFirestore, 'getFirestore');
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { GCLOUD_PROJECT: stagingEnvironment.projectId, TAKEME_RELEASE_TARGET: 'staging', TAKEME_FIREBASE_PROJECT_ID: stagingEnvironment.projectId });
    Object.defineProperty(adminApp, 'getApp', { configurable: true, value: () => ({ options: { projectId: stagingEnvironment.projectId, storageBucket: stagingEnvironment.storageBucket } }) });
    Object.defineProperty(adminFirestore, 'getFirestore', { configurable: true, value: () => ({ doc: path => { assert.equal(path, 'releasePolicies/current'); return reference; } }) });
    await action();
  } finally {
    Object.defineProperty(adminApp, 'getApp', appDescriptor);
    Object.defineProperty(adminFirestore, 'getFirestore', firestoreDescriptor);
    for (const name of names) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; }
  }
}

test('explicit staging bootstrap creates the exact mirror and rejects foreign context before writing', async () => {
  const created = [];
  const reference = { create: async data => created.push(data) };
  await withStagingRuntime(reference, async () => {
    await initializeStagingPolicyMirror();
    assert.deepEqual(created, [{ releaseTarget: 'staging', projectId: stagingEnvironment.projectId, ...stagingReleasePolicy }]);
    process.env.GCLOUD_PROJECT = 'takeme-52b80';
    await assert.rejects(initializeStagingPolicyMirror(), { code: 'failed-precondition' });
    assert.equal(created.length, 1);
  });
});

test('create-only bootstrap retries matching mirrors but never overwrites revocation or masks other failures', async () => {
  const current = { releaseTarget: 'staging', projectId: stagingEnvironment.projectId, ...stagingReleasePolicy };
  let saved = current;
  let failure = { code: 6 };
  const reference = { create: async () => { throw failure; }, get: async () => ({ data: () => saved }) };
  await withStagingRuntime(reference, async () => {
    await initializeStagingPolicyMirror();
    for (const patch of [{ publicationApproved: false }, { releaseTarget: 'production' }, { projectId: 'takeme-52b80' }, { termsVersion: '1.0-draft' }]) {
      saved = { ...current, ...patch };
      await assert.rejects(initializeStagingPolicyMirror(), { code: 'failed-precondition' });
      assert.deepEqual(saved, { ...current, ...patch });
    }
    failure = new Error('Synthetic unavailable writer');
    await assert.rejects(initializeStagingPolicyMirror(), error => error === failure);
  });
});
