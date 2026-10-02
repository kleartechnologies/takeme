import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUpdates, filterUpdates, groupUpdates, notificationPresentation, updateDay, updateTime } from '../src/lib/notification-presentation.ts';
import type { Notification, NotificationType } from '../src/lib/services/engagement.ts';

const notice = (id: string, type: NotificationType, createdAt = new Date(2026, 9, 3, 12).toISOString()): Notification => ({ id, type, title: 'Marketplace event', body: 'An actual update', href: '/listings/example', createdAt, readAt: null, openedAt: null });
test('filters partition the existing events and preserve server order and destinations', () => {
  const items = [notice('message', 'message_received'), notice('offer', 'offer_received'), notice('counter', 'counteroffer'), notice('accepted', 'offer_accepted'), notice('outbid', 'outbid'), notice('won', 'auction_won'), notice('lost', 'auction_lost'), notice('ending', 'auction_ending'), notice('deal', 'transaction_update'), notice('completed', 'transaction_completed'), notice('saved', 'saved_price_drop'), notice('unavailable', 'saved_unavailable'), notice('match', 'new_matching_listing'), notice('seller', 'followed_seller_listing')];
  assert.equal(filterUpdates(items, 'All'), items);
  assert.deepEqual(filterUpdates(items, 'Offers').map(n => n.id), ['offer', 'counter', 'accepted']);
  assert.deepEqual(filterUpdates(items, 'Messages').map(n => n.id), ['message']);
  assert.equal(filterUpdates(items, 'Auctions').length, 4);
  assert.equal(filterUpdates(items, 'Activity').length, 6);
  assert.ok(items.every(n => n.href === '/listings/example' && n.readAt === null));
});
test('time groups follow local calendar boundaries, not elapsed 24-hour buckets', () => {
  const now = new Date(2026, 9, 3, 0, 5).getTime();
  const today = notice('today', 'outbid', new Date(2026, 9, 3, 0, 1).toISOString());
  const yesterday = notice('yesterday', 'offer_received', new Date(2026, 9, 2, 23, 59).toISOString());
  const earlier = notice('earlier', 'message_received', new Date(2026, 9, 1, 23, 59).toISOString());
  assert.deepEqual(groupUpdates([today, yesterday, earlier], now).map(g => [g.label, g.items[0].id]), [['Today', 'today'], ['Yesterday', 'yesterday'], ['Earlier', 'earlier']]);
  assert.equal(updateDay('invalid', now), 'Earlier');
  assert.equal(updateTime(today.createdAt, now), '4 min ago');
  assert.equal(updateTime('invalid', now), 'Time unavailable');
});
test('pagination deduplicates overlap without losing prior read state or sorting a page locally', () => {
  const read = { ...notice('same', 'offer_accepted'), readAt: '2026-10-03T00:00:00Z' };
  const next = notice('older', 'auction_lost');
  assert.deepEqual(appendUpdates([read], [notice('same', 'offer_accepted'), next, next]), [read, next]);
});
test('actions describe supported destinations without promising payment or a live bid', () => {
  assert.equal(notificationPresentation('message_received').action, 'Open Chat');
  assert.equal(notificationPresentation('offer_accepted').action, 'View deal');
  for (const type of ['auction_won', 'outbid', 'auction_lost']) assert.equal(notificationPresentation(type).action, 'View auction');
  assert.equal(notificationPresentation('future-event').icon, 'bell');
  assert.equal(notificationPresentation('future-event').label, 'Update');
});
