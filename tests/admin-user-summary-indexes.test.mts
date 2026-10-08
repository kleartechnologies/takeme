import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8')).indexes;
for (const role of ['buyerId', 'sellerId']) {
  test(`Admin user completed-value aggregate has ${role} equality and amount coverage`, () => {
    const matches = indexes.filter((index: { collectionGroup: string; queryScope: string; fields: unknown[] }) =>
      index.collectionGroup === 'transactions' && index.queryScope === 'COLLECTION' &&
      JSON.stringify(index.fields) === JSON.stringify([
        { fieldPath: role, order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'amountSen', order: 'ASCENDING' },
      ]));
    assert.equal(matches.length, 1);
  });
}
