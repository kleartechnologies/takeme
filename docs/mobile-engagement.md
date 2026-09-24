# TAKEME engagement contract (Phase 13)

This is a product contract for a future Flutter client. The server is authoritative; the web UI is one implementation. No production deployment is part of this phase.

## Reused systems and boundaries

- `users/{uid}/saved/{listingId}` remains the only Saved/watchlist record. The existing save/unsave behavior, saved timestamp, and Discovery `SAVE_LISTING` signal remain unchanged. A server-owned `listingWatchers/{listingId}/users/{uid}` mirror supports bounded fan-out. Existing production saves need a controlled backfill before price/auction alert rollout.
- Phase 6/12 interest and recommendation systems are separate. Browsing and recommendation impressions never create notifications. Saved-search matching uses the same normalized `searchTokens` as Explore.
- Phase 8 transaction and auction state remains authoritative. Notification triggers observe real offer, bid, listing, and transaction changes; clients cannot fabricate them.
- Phase 10 `/updates` is upgraded to the notification center. Current transaction actions remain available in `/profile#transactions`.
- Phase 11 protected payment actions remain disabled. No payment, payout, or refund notification is generated from placeholder state.
- Messaging is not available in this web product (`/messages` is a disabled state), so message alerts and conversation deep links are not activated.

## Data and commands

`Notification` is `{ id, type, title, body, href, createdAt, readAt, openedAt, listingId?, sellerId?, transactionId? }`. Server storage additionally includes `recipientUserId` and `dedupeKey`. Only safe customer-facing copy and local routes are stored. No moderation notes, payment provider IDs, push tokens, ranking data, or private analytics are exposed.

Implemented types: `saved_price_drop`, `saved_unavailable`, `new_matching_listing`, `followed_seller_listing`, `auction_ending`, `outbid`, `auction_won`, `auction_lost`, `offer_received`, `offer_accepted`, `counteroffer`, `transaction_update`, `transaction_completed`. `review_available` and `message_received` are reserved types only; no event generates them yet.

Callables:

| Command | Input | Output / rule |
| --- | --- | --- |
| `getNotifications` | `cursor?` | Newest-first page of 20, `cursor`, `hasMore`; own records only. |
| `getUnreadCount` | none | Server-maintained `{unreadCount}`. No collection scan or global listener. |
| `markNotificationRead` | `notificationId` | Idempotently marks own notification read. |
| `openNotification` | `notificationId` | Idempotently marks own notification opened/read, returns `href`. This is an open command, not verified destination viewing. |
| `markAllNotificationsRead` | none | Marks at most 40 unread, returns `{marked,hasMore}`. Client repeats as needed. |
| `getNotificationPreferences` / `setNotificationPreference` | `{type,frequency}` | Optional categories only; `instant` or `off` in current UI. `daily` is reserved but delivery is not configured. |
| `getFollowState` | `sellerId` | Following state for caller and server-derived public follower count. |
| `setSellerFollow` | `{sellerId,following}` | Idempotent follow/unfollow; cannot follow self. |
| `getFollowing` | `cursor?` | Own 20-seller page with public name, photo URL, location, seller-only trust tier/rating/review count. No buyer trust or public follower identities. |
| `saveSearch` / `deleteSavedSearch` / `getSavedSearches` | Criteria, creation `requestId` or existing `searchId`, frequency, active | Explicitly saved, maximum 10 per user. Owner-only read/write through callables. |

Saved-search criteria: `{query,category,condition,type,auction,price,location,sort}`. `price` is the current Explore maximum in MYR, validated and compared as canonical two-decimal money. The UI does not offer a minimum price, so the saved-search contract does not pretend one exists. A search must contain at least one query/filter and is never saved automatically. Creation uses a client-generated stable `requestId`; a server-owned criteria fingerprint also deduplicates repeated creates. Edit uses the same `saveSearch` command with its existing ID, retaining the ID while atomically changing the fingerprint. Search result deep links rebuild the same Explore parameters.

All actionable notification `href` values are same-origin app paths: `/listings/{id}` for listing/auction/saved-search/follow alerts, `/transactions/{id}` for transaction alerts. Offer alerts link to the listing's existing offer panel. Flutter should map these to equivalent native routes, preserving entity IDs and checking current entity visibility before display. If the entity is gone, show a clear unavailable state; never silently route to unrelated content.

## Event processing and anti-spam

- Listing publication enqueues follower and saved-search jobs. Each job processes at most 40 recipients per run, persists a cursor, and resumes on the scheduler. It does not scan the whole marketplace or synchronously write every follower in the listing transaction. Saved searches are indexed by category or `*` and matched deterministically against real title search tokens and filters in both the publication snapshot and current active listing. Searches created/edited after the listing event are excluded.
- Actual fixed-price decreases create server-owned `listingPriceHistory/{listingId}/changes/{eventId}` records with old/new integer sen, MYR, actor, and Firestore event time. Equal, increased, invalid, and auction bid prices do not create a price-drop alert. Only saved users present before the event are eligible.
- Fixed-price removal/ended/sold transitions can notify existing Saved watchers once. Auction ending-soon uses actual `auctionEndAt` within one hour, a rotating bounded cursor (up to five 100-auction pages per minute), and one dedupe key per auction. Expired auctions are excluded. Outbid uses the previous leader captured in the authoritative bid transaction. Winners use finalized `winnerId`; losers are deduped across bids. No fake countdowns.
- Offer and transaction notifications come from server-owned state transitions only. Their content is intentionally generic; participants inspect the secure transaction detail for more. Protected payment provider events have no adapter yet and therefore generate no alerts.
- Every recipient/type/event combination maps to a deterministic notification document ID. Creation and unread increment occur in one Firestore transaction; retries cannot create duplicates. Read/open and unread decrement are also transactional and idempotent. Summary counts are server-owned and may be eventually consistent while triggers process.
- There is no email provider or FCM token/delivery implementation. Future push tokens should be private per user/device, revocable, and never stored on public profiles. Delivery should subscribe to committed notification records with its own idempotent channel receipt; no client may create a notification or push to another user.

## Preferences, privacy, offline and accessibility

Optional in-app alerts can be turned off by type. Transactional offers, deal updates, disputes, and auction wins stay on. Daily is reserved in the client model, but both UI and server reject selecting it until digest delivery exists; there is no silent no-delivery setting. Do not claim daily, push, or email delivery currently works. There is no forced permission prompt.

Flutter may show cached notification reads offline, but must never fabricate server notifications. Queue `markNotificationRead`/`openNotification` only with authenticated user context and replay idempotently. Follow/unfollow and saved-search upserts are idempotent server commands; show pending state and reconcile after reconnect. A cached unread count is informational until refreshed.

Rows expose type, title, body, timestamp, and explicit unread text—not color alone. Touch targets are at least 44px. Screen readers receive a row label and readable timestamp. Opening an alert calls `openNotification` before native navigation. Loading, empty, error, and retry states are first-class.

## Analytics and admin interpretation

Admin Engagement uses Firestore aggregate counts, not private content: notifications created, unique notification opens, mark-read actions, active/new saved searches, current follow relationships, price-drop alerts, auction alerts, and saved-search alerts. Period opens are **not** a creation-cohort open rate. Historical follow/unfollow counts and saved-search trigger rate are unavailable without durable events/denominators and are labeled so. Browsing recommendations are not counted as alerts. Notification `openedAt` records an in-app open command, not proof the destination rendered.

## Security and performance

Clients have no direct read/write path to notifications, unread summaries, follower mirrors/counts, saved searches/fingerprints/quotas, price history, or alert jobs. Authenticated callables expose only own data and vetted public follower count. Existing Firestore rules are preserved. All lists are capped (20 notifications/follows; 10 searches), background jobs process 40 recipients at a time, and the browser requests an unread summary on navigation/visibility rather than maintaining a global realtime listener. Seller following returns public profiles in one bounded batch, not N+1 profile reads.

## Production prerequisites

1. Review and deploy Functions, rules and indexes together in a planned release; wait for composite indexes to be ready before enabling traffic. This phase does **not** deploy or push.
2. Backfill the existing Saved collection into `listingWatchers` in bounded, audited pages. The new trigger only mirrors future Saved writes. Verify counts and reconcile deletes before enabling watch alerts.
3. Review scheduled job quotas, cost, retry/DLQ handling, App Check, event ordering, monitoring, high-volume fan-out, and retention/TTL. The worker uses a bounded page and a 150-second per-job lease; duplicate delivery remains safe through notification dedupe. Load/soak testing is still required.
4. Confirm transaction/auction deep links against all lifecycle states and product/legal copy. No live payment claims.
5. FCM/APNs and email require provider setup, device consent, token lifecycle, delivery receipts, and channel-specific preference UX. None are active.
6. Daily digests require a real scheduler/queue and migration of existing `daily` preference values before the option is enabled.
7. Run emulator integration, load/soak tests, accessibility and device QA, plus operational alerting before production release.
