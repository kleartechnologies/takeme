const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDeletionConfig, qualifyDeletionExecution, ownedDeletionMedia, DeletionConfigurationError } = require('../lib/deletion-config.js');

const demo = () => ({ env: { GCLOUD_PROJECT: 'demo-takeme', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' }, appProjectId: 'demo-takeme', appStorageBucket: 'demo-takeme.firebasestorage.app' });
const production = () => ({ env: { GCLOUD_PROJECT: 'takeme-qualified-123', TAKEME_FIREBASE_PROJECT_ID: 'takeme-qualified-123', TAKEME_RELEASE_TARGET: 'production', TAKEME_DELETION_ENVIRONMENT: 'production', TAKEME_ENABLE_PRODUCTION_DELETION: 'true', TAKEME_STORAGE_BUCKETS: 'takeme-qualified-123.firebasestorage.app,takeme-qualified-123.appspot.com' }, appProjectId: 'takeme-qualified-123', appStorageBucket: 'takeme-qualified-123.firebasestorage.app' });
const rejected = config => assert.throws(() => validateDeletionConfig(config), DeletionConfigurationError);

test('explicit demo resources require all exact loopback services and reject mixed release intent', () => {
  const resources = validateDeletionConfig(demo());
  assert.equal(resources.environment, 'demo');
  assert.deepEqual(resources.storageBuckets, ['demo-takeme.firebasestorage.app', 'demo-takeme.appspot.com']);
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    const missing = demo(); delete missing.env[key]; rejected(missing);
    const remote = demo(); remote.env[key] = 'emulator.example.test:9099'; rejected(remote);
  }
  for (const key of ['TAKEME_RELEASE_TARGET', 'TAKEME_DELETION_ENVIRONMENT']) { const config = demo(); config.env[key] = 'production'; rejected(config); }
  const enabled = demo(); enabled.env.TAKEME_ENABLE_PRODUCTION_DELETION = 'true'; rejected(enabled);
});

test('unknown or incomplete production context stays disabled; no inference from missing emulator flags', () => {
  rejected({ env: {} });
  rejected({ env: { GCLOUD_PROJECT: 'takeme-qualified-123' }, appProjectId: 'takeme-qualified-123' });
  for (const key of ['GCLOUD_PROJECT', 'TAKEME_FIREBASE_PROJECT_ID', 'TAKEME_RELEASE_TARGET', 'TAKEME_DELETION_ENVIRONMENT', 'TAKEME_ENABLE_PRODUCTION_DELETION', 'TAKEME_STORAGE_BUCKETS']) {
    const config = production(); delete config.env[key]; rejected(config);
  }
  for (const value of ['false', '', '1', 'TRUE']) { const config = production(); config.env.TAKEME_ENABLE_PRODUCTION_DELETION = value; rejected(config); }
  for (const key of ['appProjectId', 'appStorageBucket']) { const config = production(); delete config[key]; rejected(config); }
});

test('synthetic qualified production config is pure, immutable and uses no demo resources', () => {
  const resources = validateDeletionConfig(production());
  assert.equal(resources.environment, 'production');
  assert.equal(resources.projectId, 'takeme-qualified-123');
  assert.ok(resources.storageBuckets.every(bucket => bucket.startsWith('takeme-qualified-123.')));
  assert.ok(Object.isFrozen(resources)); assert.ok(Object.isFrozen(resources.storageBuckets));
  const alternate = production(); alternate.env.TAKEME_STORAGE_BUCKETS = 'takeme-qualified-123.appspot.com'; alternate.appStorageBucket = 'takeme-qualified-123.appspot.com';
  assert.deepEqual(validateDeletionConfig(alternate).storageBuckets, ['takeme-qualified-123.appspot.com']);
});

test('production execution qualification remains closed under the actual unpublished central policy', () => {
  assert.throws(() => qualifyDeletionExecution(production()), error => error instanceof DeletionConfigurationError && error.reason === 'production-policy-unapproved');
  assert.equal(qualifyDeletionExecution(demo()).environment, 'demo');
  const finalPolicy = { publicationApproved: true, termsVersion: '1.0-2026-10-05', privacyVersion: '1.0-2026-10-05', minimumAge: 18 };
  // Synthetic metadata validation only: no SDK, credentials, network or cleanup execution.
  assert.equal(qualifyDeletionExecution(production(), finalPolicy).environment, 'production');
  for (const policy of [{ ...finalPolicy, publicationApproved: false }, { ...finalPolicy, termsVersion: '1.0-draft' }, { ...finalPolicy, privacyVersion: null }]) {
    assert.throws(() => qualifyDeletionExecution(production(), policy), DeletionConfigurationError);
  }
});

test('runtime, Admin app, configured project and same-project bucket must all agree', () => {
  for (const key of ['GOOGLE_CLOUD_PROJECT', 'GCP_PROJECT', 'TAKEME_FIREBASE_PROJECT_ID']) { const config = production(); config.env[key] = 'other-project-123'; rejected(config); }
  const app = production(); app.appProjectId = 'other-project-123'; rejected(app);
  for (const bucket of ['other-project-123.appspot.com', 'demo-takeme.firebasestorage.app', 'gs://takeme-qualified-123.appspot.com', 'takeme-qualified-123.appspot.com,', 'takeme-qualified-123.appspot.com,takeme-qualified-123.appspot.com', '']) {
    const config = production(); config.env.TAKEME_STORAGE_BUCKETS = bucket; rejected(config);
  }
  const bucket = production(); bucket.appStorageBucket = 'other-project-123.appspot.com'; rejected(bucket);
  const omitted = production(); omitted.env.TAKEME_STORAGE_BUCKETS = 'takeme-qualified-123.appspot.com'; rejected(omitted);
  for (const project of ['demo-takeme', 'demo-another', 'localhost', 'invalid_project']) { const config = production(); config.env.GCLOUD_PROJECT = config.env.TAKEME_FIREBASE_PROJECT_ID = config.appProjectId = project; rejected(config); }
});

test('every emulator override is rejected in otherwise qualified production context', () => {
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'PUBSUB_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB', 'FUNCTIONS_EMULATOR']) {
    for (const value of ['127.0.0.1:8080', 'false', '']) { const config = production(); config.env[key] = value; rejected(config); }
  }
  const flag = production(); flag.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true'; rejected(flag);
});

test('owned Firebase media uses the qualified bucket and correct environment endpoint', () => {
  const object = 'users/account-123/listings/item-123/image.png';
  const encoded = encodeURIComponent(object);
  const prod = validateDeletionConfig(production()), local = validateDeletionConfig(demo());
  assert.deepEqual(ownedDeletionMedia(`https://firebasestorage.googleapis.com/v0/b/${prod.storageBuckets[0]}/o/${encoded}?alt=media&token=synthetic`, 'account-123', prod), { bucket: prod.storageBuckets[0], object });
  assert.deepEqual(ownedDeletionMedia(`http://127.0.0.1:9199/v0/b/${local.storageBuckets[0]}/o/${encoded}`, 'account-123', local), { bucket: local.storageBuckets[0], object });
  assert.equal(ownedDeletionMedia(`http://127.0.0.1:9199/v0/b/${prod.storageBuckets[0]}/o/${encoded}`, 'account-123', prod), null);
  assert.equal(ownedDeletionMedia(`https://firebasestorage.googleapis.com/v0/b/${local.storageBuckets[0]}/o/${encoded}`, 'account-123', local), null);
});

test('media parser rejects external/lookalike hosts, foreign ownership, malformed or ambiguous paths', () => {
  const resources = validateDeletionConfig(production()), bucket = resources.storageBuckets[0];
  const base = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
  const object = encodeURIComponent('users/account-123/profile/photo.png');
  for (const url of [
    `https://evil.example.test/v0/b/${bucket}/o/${object}`,
    `https://firebasestorage.googleapis.com.evil.example.test/v0/b/${bucket}/o/${object}`,
    `https://user:password@firebasestorage.googleapis.com/v0/b/${bucket}/o/${object}`,
    `https://firebasestorage.googleapis.com:9199/v0/b/${bucket}/o/${object}`,
    `https://firebasestorage.googleapis.com/v0/b/other-project-123.appspot.com/o/${object}`,
    `${base}${object}#fragment`, `${base}%ZZ`, `${base}${encodeURIComponent('users/other-account/profile/photo.png')}`,
    `${base}${encodeURIComponent('users/account-123/../other/profile.png')}`,
    `${base}${encodeURIComponent('users/account-123/profile/%2fother')}`,
    `${base}${encodeURIComponent('users/account-123/profile/\u0000photo.png')}`,
    `${base}${encodeURIComponent('users/account-123/profile\\photo.png')}`,
    `${base}${encodeURIComponent('users/account-123//photo.png')}`,
  ]) assert.equal(ownedDeletionMedia(url, 'account-123', resources), null);
  assert.equal(ownedDeletionMedia(`${base}${object}`, 'account-123/other', resources), null);
});
