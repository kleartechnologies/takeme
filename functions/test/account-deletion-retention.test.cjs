const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { monthsAfter } = require('../lib/account-deletion-retention.js');

test('retention uses calendar months and clamps leap day', () => {
  assert.equal(monthsAfter(Timestamp.fromDate(new Date('2024-02-29T12:34:56.789Z')), 12).toDate().toISOString(), '2025-02-28T12:34:56.789Z');
  assert.equal(monthsAfter(Timestamp.fromDate(new Date('2026-01-31T12:34:56.789Z')), 1).toDate().toISOString(), '2026-02-28T12:34:56.789Z');
});
