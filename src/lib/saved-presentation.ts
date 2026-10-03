import type { Listing, SavedListing } from '../types/marketplace';
import type { SearchCriteria, SavedSearch } from './services/engagement';

export const SAVED_TABS = ['items', 'auctions', 'sellers', 'searches'] as const;
export type SavedTab = typeof SAVED_TABS[number];
export function savedTab(value: string | null): SavedTab { return SAVED_TABS.includes(value as SavedTab) ? value as SavedTab : 'items'; }
export function savedCollection(items: SavedListing[], tab: 'items' | 'auctions') {
  // Removed records contain no retained private listing data or listing type.
  return items.filter(item => item.listing ? (item.listing.listingType !== 'buy_now') === (tab === 'auctions') : tab === 'items');
}
export function savedAvailability(listing: Listing, now: number) {
  if (listing.status === 'sold') return 'Sold';
  if (listing.status === 'removed' || listing.status === 'draft') return 'Unavailable';
  if (listing.listingType === 'buy_now') return listing.status === 'active' ? 'Available' : 'Unavailable';
  if (listing.auctionStatus === 'cancelled') return 'Auction cancelled';
  if (listing.auctionStatus === 'ended' || listing.status === 'ended') return 'Auction ended';
  if (listing.auctionStatus === 'scheduled') return 'Scheduled';
  const remaining = Date.parse(listing.auctionEndAt ?? '') - now;
  if (now && remaining <= 0) return 'Awaiting finalization';
  return now && remaining <= 300_000 ? 'Ending soon' : 'Live';
}
export function auctionOutcome(listing: Listing): string | null {
  if (listing.auctionStatus === 'cancelled' || listing.auctionStatus !== 'ended' && listing.status !== 'ended') return null;
  if (!(listing.bidCount ?? 0)) return 'No bids';
  if (typeof listing.finalBid !== 'number') return null;
  return `Sold for ${new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(listing.finalBid / 100)}`;
}
export function savedSearchHref(criteria: SearchCriteria) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: criteria.query, category: criteria.category, condition: criteria.condition, type: criteria.type, auction: criteria.auction, price: criteria.price ?? '', location: criteria.location, sort: criteria.sort })) {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value));
  }
  return `/explore?${query}`;
}
export function savedSearchStatus(search: Pick<SavedSearch, 'active' | 'frequency'>) {
  return !search.active ? 'Paused' : search.frequency === 'off' ? 'Alerts off' : search.frequency === 'instant' ? 'In-app alerts on' : 'Daily alerts unavailable';
}
const human = (value: string) => value.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
export function savedSearchCriteria(criteria: SearchCriteria) {
  return [criteria.category && human(criteria.category), criteria.condition, criteria.type && ({ buy_now: 'Fixed price', auction: 'Auction', buy_now_and_auction: 'Fixed price + auction' }[criteria.type] ?? human(criteria.type)), criteria.auction && `${human(criteria.auction)} auctions`, criteria.price !== null ? `Up to RM${criteria.price.toLocaleString('en-MY')}` : '', criteria.location, { newest: 'Newest first', price_low: 'Price: low to high', price_high: 'Price: high to low' }[criteria.sort]].filter(Boolean);
}
