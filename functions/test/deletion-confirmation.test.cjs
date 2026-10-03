const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDeletionOwnerBinding } = require('../lib/deletion-confirmation.js');

test('deletion confirmation is valid only for the same authenticated owner', () => {
  assert.doesNotThrow(() => assertDeletionOwnerBinding('account-A', 'account-A'));
  for (const expected of [undefined, null, '', 'account-B', ' account-A ', 1, ['account-A'], { uid: 'account-A' }]) {
    assert.throws(() => assertDeletionOwnerBinding('account-A', expected), error =>
      error.code === 'failed-precondition' && error.details?.reason === 'account-changed');
  }
  // A newly authenticated B must not execute A's previously displayed confirmation.
  assert.throws(() => assertDeletionOwnerBinding('account-B', 'account-A'), error => error.details?.reason === 'account-changed');
});
