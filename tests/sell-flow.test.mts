import assert from 'node:assert/strict';
import test from 'node:test';
import { sellInput, validateSellStep, type SellValues } from '../src/lib/sell-flow.ts';
const now = Date.parse('2026-10-03T10:00:00Z');
const values: SellValues = { title: 'Console with two controllers', categoryId: 'electronics', description: 'Synthetic local listing. No real goods or exchange.', condition: 'Like new', price: '980.50', listingType: 'buy_now', districtOrCity: 'Jitra', state: 'Kedah', meetupLocationId: '', saveLocationToProfile: false, startingBid: '500.25', minimumBidIncrement: '10.50', auctionStartAt: new Date(now + 600000).toISOString(), auctionEndAt: new Date(now + 1200000).toISOString(), startMode: 'scheduled' };
test('normal branch excludes auction and unsupported fields; trims text and preserves money/location', () => {
  for (let step = 0; step < 7; step++) assert.deepEqual(validateSellStep(values, step, now), {});
  const input = sellInput({ ...values, title: '  Console with two controllers  ' }, now);
  assert.equal(input.title, values.title);
  assert.equal(input.listingType, 'buy_now');
  assert.equal('price' in input && input.price, 980.5);
  for (const unsupported of ['startingBid', 'auctionStartAt', 'negotiable', 'stock', 'delivery', 'video']) assert.ok(!(unsupported in input));
  assert.equal(input.meetupLocationId, null);
});
test('auction branch uses whole sen and publishes Start now at submission time, without fixed price', () => {
  const auction = { ...values, listingType: 'auction' as const, startMode: 'now' as const };
  const input = sellInput(auction, now);
  assert.equal('startingBid' in input && input.startingBid, 50025);
  assert.equal('minimumBidIncrement' in input && input.minimumBidIncrement, 1050);
  assert.equal('auctionStartAt' in input && input.auctionStartAt, new Date(now).toISOString());
  assert.ok(!('price' in input));
  assert.deepEqual(validateSellStep(auction, 5, now), {});
  assert.ok(validateSellStep({ ...auction, auctionEndAt: new Date(now + 599999).toISOString() }, 5, now).auctionEndAt);
});
test('required details and supported boundaries fail beside their actual fields', () => {
  assert.ok(validateSellStep({ ...values, title: '     ok' }, 3, now).title);
  assert.ok(validateSellStep({ ...values, description: ' too short ' }, 3, now).description);
  assert.ok(validateSellStep({ ...values, categoryId: 'fake' }, 2, now).categoryId);
  for (const price of ['0', '-1', '1.001', '1e3', '10000000.01']) assert.ok(validateSellStep({ ...values, price }, 5, now).price);
  assert.deepEqual(validateSellStep({ ...values, price: '10000000.00' }, 5, now), {});
  assert.ok(validateSellStep({ ...values, districtOrCity: '12 Jalan Example' }, 6, now).districtOrCity);
});
test('scheduled auctions enforce the existing lead and duration limits, including stale drafts', () => {
  const auction = { ...values, listingType: 'auction' as const };
  assert.ok(validateSellStep({ ...auction, auctionStartAt: new Date(now - 60001).toISOString() }, 5, now).auctionStartAt);
  assert.ok(validateSellStep({ ...auction, auctionStartAt: new Date(now + 91 * 86400000).toISOString() }, 5, now).auctionStartAt);
  assert.ok(validateSellStep({ ...auction, auctionEndAt: new Date(now + 31 * 86400000).toISOString() }, 5, now).auctionEndAt);
  assert.ok(validateSellStep({ ...auction, auctionEndAt: auction.auctionStartAt }, 5, now).auctionEndAt);
  assert.ok(validateSellStep({ ...auction, minimumBidIncrement: '0' }, 5, now).minimumBidIncrement);
});

test('location errors stay attached to the invalid field', () => {
  assert.deepEqual(validateSellStep({ ...values, state: '' }, 6, now), { state: 'Choose a Malaysian state.' });
  assert.deepEqual(validateSellStep({ ...values, districtOrCity: '' }, 6, now), { districtOrCity: 'Add your district or city.' });
});
