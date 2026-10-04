import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionOutcome, savedAvailability, savedCollection, savedSearchCriteria, savedSearchHref, savedSearchStatus, savedTab } from '../src/lib/saved-presentation.ts';
import type { Listing, SavedListing } from '../src/types/marketplace.ts';
import type { SearchCriteria } from '../src/lib/services/engagement.ts';
const now = Date.parse('2026-10-03T00:00:00Z');
const listing = (patch: Partial<Listing> = {}): Listing => ({ id: 'example', sellerId: 'seller', title: 'Example', description: 'Demo', categoryId: 'electronics', condition: 'Good', price: 180, listingType: 'buy_now', location: 'Jitra, Kedah', imageUrls: [], status: 'active', createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), ...patch });
const saved = (id: string, value: Listing | null): SavedListing => ({ listingId: id, listing: value, savedAt: new Date(now).toISOString() });
test('saved collections keep sold/ended records, partition auction types and do not invent a removed record type', () => {
  const items = [saved('fixed', listing()), saved('sold', listing({status:'sold'})), saved('auction', listing({listingType:'auction',status:'ended'})), saved('hybrid', listing({listingType:'buy_now_and_auction'})), saved('removed', null)];
  assert.deepEqual(savedCollection(items, 'items').map(item => item.listingId), ['fixed','sold','removed']);
  assert.deepEqual(savedCollection(items, 'auctions').map(item => item.listingId), ['auction','hybrid']);
  assert.equal(savedTab('private-email'), 'items');
});
test('statuses never describe sold, ended, cancelled or expired records as available/live', () => {
  assert.equal(savedAvailability(listing({status:'sold'}), now), 'Sold');
  assert.equal(savedAvailability(listing({status:'ended'}), now), 'Unavailable');
  assert.equal(savedAvailability(listing({listingType:'auction',auctionStatus:'scheduled'}),now),'Scheduled');
  const auction = listing({ listingType:'auction', auctionStatus:'active', auctionEndAt:new Date(now+240_000).toISOString() });
  assert.equal(savedAvailability(auction, now), 'Ending soon');
  assert.equal(savedAvailability(auction, now+300_000), 'Awaiting finalization');
  assert.equal(savedAvailability({...auction,auctionStatus:'cancelled'},now),'Auction cancelled');
  assert.equal(savedAvailability({...auction,auctionStatus:'ended'},now),'Auction ended');
});
test('ended auction outcomes show actual final bids without claiming a completed sale', () => {
  const ended = listing({listingType:'auction',status:'ended',auctionStatus:'ended',bidCount:2,currentBid:95000,finalBid:98000});
  assert.equal(auctionOutcome(ended)?.replace(/\s/g, ''),'FinalbidRM980.00');
  assert.equal(auctionOutcome({...ended,status:'sold',finalBid:235000})?.replace(/\s/g, ''),'FinalbidRM2,350.00');
  assert.equal(auctionOutcome({...ended,finalBid:null}),null);
  assert.equal(auctionOutcome({...ended,bidCount:0,finalBid:null}),'No bids');
  assert.equal(auctionOutcome({...ended,status:'active',auctionStatus:'active'}),null);
  assert.equal(auctionOutcome({...ended,status:'active',auctionStatus:'scheduled'}),null);
  assert.equal(auctionOutcome({...ended,auctionStatus:'cancelled'}),null);
});
test('saved search destinations round-trip every actual filter, encoded text and zero maximum price', () => {
  const criteria: SearchCriteria = {query:'camera & lens',category:'electronics',condition:'Like new',type:'auction',auction:'active',price:0,location:'Jitra, Kedah',sort:'price_low'};
  const url = new URL(savedSearchHref(criteria),'https://example.test');
  assert.deepEqual(Object.fromEntries(url.searchParams),{q:'camera & lens',category:'electronics',condition:'Like new',type:'auction',auction:'active',price:'0',location:'Jitra, Kedah',sort:'price_low'});
  const labels = savedSearchCriteria(criteria);
  assert.ok(labels.includes('Up to RM0'));
  assert.ok(labels.includes('Price: low to high'));
  assert.ok(labels.includes('Electronics'));
  assert.ok(!labels.some(label => label.includes('buy_now') || label.includes('price_low')));
  assert.ok(!savedSearchCriteria({...criteria,price:null,condition:'',category:'',type:'',auction:'',location:''}).some(label=>label.includes('RM')));
  assert.equal(savedSearchStatus({active:true,frequency:'daily'}),'Daily alerts unavailable');
  assert.equal(savedSearchStatus({active:true,frequency:'instant'}),'In-app alerts on');
  assert.equal(savedSearchStatus({active:false,frequency:'instant'}),'Paused');
});
