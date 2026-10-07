import { createInFlightRead } from "@/lib/in-flight-read";
import { marketplaceCallable } from "@/lib/services/marketplace-call";
import { auth, functions } from "@/lib/firebase/client";
import { announceFollowChange } from "@/lib/marketplace-state-events";

export type NotificationType = "saved_price_drop" | "saved_unavailable" | "new_matching_listing" | "followed_seller_listing" | "auction_ending" | "outbid" | "auction_lost" | "message_received" | "auction_won" | "offer_received" | "offer_accepted" | "counteroffer" | "transaction_update" | "transaction_completed" | "review_available";
export type Frequency = "instant" | "daily" | "off";
export type SearchCriteria = { query: string; category: string; condition: string; type: string; auction: string; price: number | null; location: string; sort: "newest" | "price_low" | "price_high" };
export type Notification = { id: string; type: NotificationType; title: string; body: string; href: string; createdAt: string; readAt: string | null; openedAt: string | null; listingId?: string; sellerId?: string; transactionId?: string };
export type SavedSearch = { id: string; criteria: SearchCriteria; frequency: Frequency; active: boolean; createdAt: string; updatedAt: string; lastTriggeredAt: string | null };
export type FollowingSeller = { sellerId: string; displayName: string; photoURL: string | null; location: string; sellerTier: string | null; sellerReviewCount: number; sellerAverageRating: number; createdAt: string };

async function call<T>(name: string, payload: Record<string, unknown> = {}, publicCall = false): Promise<T> {
  if (!functions || (!publicCall && !auth?.currentUser)) throw new Error("Sign in to manage engagement.");
  return (await marketplaceCallable<Record<string, unknown>, T>(functions, name)(payload)).data;
}

const unreadReads = createInFlightRead<{ unreadCount: number }>();
export const getUnreadCount = () => unreadReads(auth?.currentUser?.uid ?? "guest", () => call<{ unreadCount: number }>("getUnreadCount"));
export const getNotifications = (cursor?: string | null) => call<{ items: Notification[]; cursor: string | null; hasMore: boolean }>("getNotifications", cursor ? { cursor } : {});
export const markNotificationRead = (notificationId: string) => call<{ read: boolean }>("markNotificationRead", { notificationId });
export const openNotification = (notificationId: string) => call<{ href: string }>("openNotification", { notificationId });
export const markAllNotificationsRead = () => call<{ marked: number; hasMore: boolean }>("markAllNotificationsRead");
export const getNotificationPreferences = () => call<{ preferences: Record<string, Frequency> }>("getNotificationPreferences");
export const setNotificationPreference = (type: string, frequency: Frequency) => call("setNotificationPreference", { type, frequency });
export const getFollowState = (sellerId: string) => call<{ following: boolean; followerCount: number }>("getFollowState", { sellerId }, true);
export async function setSellerFollow(sellerId: string, following: boolean) {
  const uid = auth?.currentUser?.uid;
  const result = await call<{ following: boolean; followerCount: number }>("setSellerFollow", { sellerId, following });
  if (uid) announceFollowChange({ uid, sellerId, ...result });
  return result;
}
export const getFollowing = (cursor?: string | null) => call<{ items: FollowingSeller[]; cursor: string | null; hasMore: boolean }>("getFollowing", cursor ? { cursor } : {});
export const saveSearch = (criteria: SearchCriteria, frequency?: Frequency, searchId?: string, active?: boolean) => call<{ searchId: string }>("saveSearch", { criteria, ...(frequency ? { frequency } : {}), ...(searchId ? { searchId } : { requestId: crypto.randomUUID() }), ...(active === undefined ? {} : { active }) });
export const deleteSavedSearch = (searchId: string) => call("deleteSavedSearch", { searchId });
export const getSavedSearches = () => call<{ items: SavedSearch[] }>("getSavedSearches");
