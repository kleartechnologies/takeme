const assert = require('node:assert/strict');
const test = require('node:test');
const identity = require('../lib/staging-environment');

test('shared staging identity is immutable, internally consistent and distinct from production/demo', () => {
  const { stagingEnvironment: env } = identity;
  assert.ok(Object.isFrozen(env));
  assert.equal(env.projectId, 'takeme-staging-822a5');
  assert.equal(env.projectNumber, '887697506010');
  assert.equal(env.authDomain, env.projectId + '.firebaseapp.com');
  assert.equal(env.storageBucket, env.projectId + '.firebasestorage.app');
  assert.equal(env.siteUrl, 'https://takeme-web-preview.takeme-technologies.workers.dev');
  assert.equal(env.policyVersion, '1.0-staging');
  assert.notEqual(env.projectId, 'demo-takeme');
  assert.notEqual(env.projectId, 'takeme-52b80');
  assert.equal(identity.stagingFirebaseProjectId, env.projectId);
  assert.equal(identity.stagingFirebaseProjectNumber, env.projectNumber);
  assert.equal(identity.stagingAuthDomain, env.authDomain);
  assert.equal(identity.stagingStorageBucket, env.storageBucket);
  assert.equal(identity.stagingSiteUrl, env.siteUrl);
  assert.equal(identity.stagingPolicyVersion, env.policyVersion);
});
