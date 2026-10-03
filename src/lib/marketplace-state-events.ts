export type SavedChange = { uid: string; listingId: string; saved: boolean };
export type FollowChange = { uid: string; sellerId: string; following: boolean; followerCount: number };
/** Announce successful existing writes to mounted UI. No extra persistence or tracking. */
export function announceSavedChange(detail: SavedChange) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<SavedChange>('takeme:saved-changed', { detail }));
}
export function announceFollowChange(detail: FollowChange) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<FollowChange>('takeme:follow-changed', { detail }));
}
