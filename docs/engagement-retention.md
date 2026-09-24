# Engagement and retention (Phase 13)

Status: implemented locally, not deployed. This document describes the current Firebase-native in-app channel and its release boundaries. The companion [mobile contract](mobile-engagement.md) defines DTOs, commands, offline behavior, and Flutter deep-link expectations.

## Reused product systems

- **Saved listings are the watchlist.** `users/{uid}/saved/{listingId}` and its existing save/unsave and Discovery signal remain the source of truth; no second user watchlist exists. A server-owned `listingWatchers/{listingId}/users/{uid}` mirror makes alert fan-out bounded. The existing saved timestamp is retained, and alert eligibility requires the save to predate the event. Last-notified state is represented by deterministic notification IDs, rather than a client-editable saved-record field.
- **Discovery stays separate.** Phase 6/12 ranking and interests do not generate notifications. Explicitly saved searches match new publications deterministically against current Explore search tokens and filters. Browsing impressions and generic recommendations never create alerts.
- **Transactions and auctions remain authoritative.** Functions observe real bid, offer, finalized listing, and transaction transitions. They do not introduce payment, dispute, or messaging state. The existing `/updates` route is now the persisted notification center; transaction actions remain on transaction pages.

## Following and saved searches

`setSellerFollow` atomically creates/removes a private relationship, user-side following record, and server-derived count. Repeating follow/unfollow is harmless; self-follow is rejected. Seller profiles show only the aggregate count. The Following page fetches one bounded page and enriches it with batched existing public seller/trust projections; follower identities are not publicly enumerable. A follow never notifies the seller. A new active listing from that seller can notify followers.

Users explicitly save an Explore query and supported filters; there is no per-keystroke write or automatic search capture. Searches have a 10-per-user cap, active flag, instant/off preference, created/updated/last-triggered times, stable request ID, and a server-owned criteria fingerprint to deduplicate repeated creation. Edits preserve the search ID and atomically move the fingerprint. The Saved Searches page supports edit, delete, and pause/resume. `daily` is reserved in the type model but rejected until a digest pipeline exists. Matches are based on query, category, condition, listing type, auction flag, Explore's supported maximum price, and location; sort is preserved for reopening results but is not a matching predicate. Existing historical listings are excluded by publication/search timestamps.

## Server events and price history

Fixed-price changes are compared using canonical integer MYR sen. A real decrease creates `listingPriceHistory/{listingId}/changes/{eventId}` with old/new sen, timestamp, listing ID, currency, and actor. An equal or higher price, formatting-only change, invalid price, or auction bid does not generate a price-drop alert. Saved watchers can receive one alert per genuine decrease. Saved listing unavailable alerts use meaningful final availability transitions, not every internal edit.

An auction-ending alert uses the authoritative end time when an active auction enters the next hour; expired auctions are excluded. The scheduled scan is capped at five 100-auction pages per minute with a cursor, and the notification key allows only one ending-soon alert per auction and recipient. Outbid alerts use the previous leader recorded by the authoritative bid transaction. Winner/loser alerts wait for finalization; repeated bids by one loser do not create repeated result alerts. Auction result and status changes are not simulated.

Offer received, counteroffer, offer accepted, transaction created, participant confirmations, cancellation request, and completed/cancelled/disputed transitions map to actual server-owned records. Messages are unavailable, so message alerts do not exist. Reviews and protected-payment updates have no authoritative event adapter in this phase and are not emitted. No live Stripe state is changed and no fake alert events or notifications are seeded.

## Notifications, preferences, and unread state

Each notification stores recipient, typed category, safe title/body, local deep-link path, entity IDs where relevant, created/read/open timestamps, and a dedupe key. Optional categories can be turned on or off. Essential offer, transaction, and auction-win notices are not user-disableable. No private moderation, provider, ranking, or analytics data is embedded. Every actionable alert links to an existing listing or transaction route. The mobile app should map the same entity route after checking current visibility; deleted items require an unavailable state.

Functions alone create notifications and unread summaries. A stable recipient/event key determines the document ID; notification creation and unread increment share a Firestore transaction. Mark-read, open, and mark-all-read are idempotent, with mark-all limited to 40 per command. The Updates page reads newest-first pages of 20 with loading, error, empty, unread-text, and retry states. The nav requests a bounded server-owned unread summary on navigation/visibility; it does not attach a global listener or count the full notification collection. `openedAt` is an in-app open command, not proof that the destination rendered. A cached offline count is informational.

No push tokens, FCM/APNs delivery, email provider, SMS, WhatsApp, or forced permission prompt is active. Future push tokens must be private per device, revocable, and linked to committed notification records through an idempotent delivery adapter. Push and daily digests must not be advertised as working until configured and tested. The in-app notification center works without either channel.

## Security, privacy, scalability, and analytics

Firestore rules deny direct client access to server-owned notifications, summary, follower mirrors/counts, saved searches and fingerprints, price history, jobs, and scheduler cursors. Authenticated callables expose only the caller's private records and the vetted public aggregate follower count. Existing Saved rules and other marketplace rules remain in place. Server-generated events are not creatable through client writes.

Listing publication enqueues jobs for followers and matching saved searches. Each job processes at most 40 recipients per run with a persisted cursor and lease. A listing is evaluated only against indexed saved-search categories or wildcard searches; the worker does not scan all listings or write to thousands of recipients in the listing transaction. Notification dedupe makes trigger retries safe. Saved watchers have a listing-keyed mirror for bounded fan-out. Notifications/follows are paged at 20; saved searches are capped at 10; seller public data is fetched in a batch rather than N+1 calls.

The admin Engagement section uses aggregate Firestore queries for notifications created, opens, mark-reads, active/new searches, current follows, and price/auction/search alert volume without showing notification content. These are activity measures, not conversion claims. A true creation-cohort open rate, historical follow/unfollow volume, and saved-search trigger rate lack durable denominators and are labeled unavailable. Discovery recommendation impressions are not counted as notification events. Notification `openedAt`, `readAt`, follow relationships, and search `lastTriggeredAt` are the current trustworthy signals; no fake analytics were added.

## Release prerequisites

1. Plan a coordinated Functions, Firestore rules, and index deployment; wait for indexes to become ready. This phase performs **no deploy or push**.
2. Backfill existing production Saved records into the watcher mirror in bounded, audited pages. Reconcile unsaves/deletes and verify counts before enabling saved-item alerts.
3. Load/soak-test fan-out, scheduler cost and quotas, retry behavior, lease recovery, event ordering, App Check, retention/TTL, and operational monitoring. Set an explicit production retry/dead-letter policy before launch.
4. Validate deep links and notification wording through real lifecycle states; finish device accessibility QA in addition to the local responsive checks.
5. Configure FCM/APNs and device-token consent/lifecycle only if push is desired. Configure a provider for email only if that channel is approved. Build a genuine digest pipeline before exposing `daily`.
6. Keep Phase 11 protected payments disabled until real provider events and independent release prerequisites exist. No payment, payout, or refund alerts should come from placeholders.
