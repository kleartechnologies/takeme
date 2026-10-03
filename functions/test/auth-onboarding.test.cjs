const assert = require('node:assert/strict');
const test = require('node:test');
const { AUTH_POLICY_VERSION, hasCurrentAcceptance, validateAcceptance, requireOnboardingDemo } = require('../lib/auth-onboarding');
test('acceptance requires three explicit confirmations and exact stable versions', () => {
  const accepted = { acceptTerms: true, acceptPrivacy: true, confirmAge18: true, termsVersion: AUTH_POLICY_VERSION, privacyVersion: AUTH_POLICY_VERSION };
  validateAcceptance(accepted);
  for (const field of ['acceptTerms', 'acceptPrivacy', 'confirmAge18']) for (const value of [false, undefined, 'true', 1]) assert.throws(() => validateAcceptance({ ...accepted, [field]: value }));
  for (const field of ['termsVersion', 'privacyVersion']) assert.throws(() => validateAcceptance({ ...accepted, [field]: 'wrong' }));
});
test('a boolean or client-looking date cannot establish server acceptance', () => {
  const timestamp = { toMillis: () => 1 };
  const data = { termsVersion: AUTH_POLICY_VERSION, privacyVersion: AUTH_POLICY_VERSION, termsAcceptedAt: timestamp, privacyAcceptedAt: timestamp, age18ConfirmedAt: timestamp, acceptanceSource: 'web' };
  assert.ok(hasCurrentAcceptance(data));
  assert.equal(hasCurrentAcceptance(undefined), false);
  for (const field of ['termsAcceptedAt', 'privacyAcceptedAt', 'age18ConfirmedAt']) assert.equal(hasCurrentAcceptance({ ...data, [field]: '2026-10-03' }), false);
});
test('local draft functions refuse production or incomplete emulator configuration', () => {
  const keys = ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.GCLOUD_PROJECT = 'demo-takeme'; process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    requireOnboardingDemo();
    process.env.GCLOUD_PROJECT = 'not-a-demo'; assert.throws(requireOnboardingDemo);
    process.env.GCLOUD_PROJECT = 'demo-takeme'; delete process.env.FIREBASE_AUTH_EMULATOR_HOST; assert.throws(requireOnboardingDemo);
  } finally { for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } }
});
