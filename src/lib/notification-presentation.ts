import type { Notification, NotificationType } from './services/engagement';

export const UPDATE_FILTERS = ['All', 'Messages', 'Offers', 'Auctions', 'Activity'] as const;
export type UpdateFilter = typeof UPDATE_FILTERS[number];
type EventStyle = { category: Exclude<UpdateFilter, 'All'>; icon: 'message' | 'offer' | 'counter' | 'accepted' | 'auction' | 'outbid' | 'won' | 'saved' | 'seller' | 'deal' | 'review' | 'bell'; action: string; label: string };
const events: Record<NotificationType, EventStyle> = {
  message_received: { category: 'Messages', icon: 'message', label: 'Message', action: 'Open Chat' },
  offer_received: { category: 'Offers', icon: 'offer', label: 'Offer', action: 'View request' },
  counteroffer: { category: 'Offers', icon: 'counter', label: 'Counteroffer', action: 'Review offer' },
  offer_accepted: { category: 'Offers', icon: 'accepted', label: 'Offer accepted', action: 'View deal' },
  outbid: { category: 'Auctions', icon: 'outbid', label: 'Outbid', action: 'View auction' },
  auction_ending: { category: 'Auctions', icon: 'auction', label: 'Ending soon', action: 'View auction' },
  auction_won: { category: 'Auctions', icon: 'won', label: 'Auction won', action: 'View auction' },
  auction_lost: { category: 'Auctions', icon: 'auction', label: 'Auction ended', action: 'View auction' },
  saved_price_drop: { category: 'Activity', icon: 'saved', label: 'Saved item', action: 'View item' },
  saved_unavailable: { category: 'Activity', icon: 'saved', label: 'Saved item', action: 'View item' },
  new_matching_listing: { category: 'Activity', icon: 'saved', label: 'Saved search', action: 'View item' },
  followed_seller_listing: { category: 'Activity', icon: 'seller', label: 'Following', action: 'View item' },
  transaction_update: { category: 'Activity', icon: 'deal', label: 'Deal update', action: 'View deal' },
  transaction_completed: { category: 'Activity', icon: 'accepted', label: 'Deal completed', action: 'View deal' },
  review_available: { category: 'Activity', icon: 'review', label: 'Review', action: 'View details' },
};

export function notificationPresentation(type: string): EventStyle {
  return events[type as NotificationType] ?? { category: 'Activity', icon: 'bell', label: 'Update', action: 'View update' };
}
export function filterUpdates(items: Notification[], filter: UpdateFilter) {
  return filter === 'All' ? items : items.filter(item => notificationPresentation(item.type).category === filter);
}
export function updateDay(createdAt: string, now: number): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(createdAt), today = new Date(now);
  if (!Number.isFinite(date.getTime()) || !now) return 'Earlier';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}
export function groupUpdates(items: Notification[], now: number) {
  return (['Today', 'Yesterday', 'Earlier'] as const).map(label => ({ label, items: items.filter(item => updateDay(item.createdAt, now) === label) })).filter(group => group.items.length);
}
export function updateTime(createdAt: string, now: number) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  const elapsed = Math.max(0, now - date.getTime());
  if (now && elapsed < 60_000) return 'Just now';
  if (now && elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (now && elapsed < 86_400_000 && updateDay(createdAt, now) === 'Today') return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (updateDay(createdAt, now) === 'Yesterday') return `Yesterday, ${date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: date.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined, hour: 'numeric', minute: '2-digit' });
}

/** The server supplies newest-first pages. Keep their order and avoid duplicate rows on refresh. */
export function appendUpdates(current: Notification[], next: Notification[]) {
  const seen = new Set(current.map(item => item.id));
  const additions = next.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
  return [...current, ...additions];
}
