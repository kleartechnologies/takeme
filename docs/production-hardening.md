# Phase 15 production-hardening audit (local code and demo emulators)

This is a source/rules and `demo-takeme` emulator audit, not an assessment of deployed configuration or production data. No production deployment, migration, payment, or test record was made.

## Security model and collection map

Firebase Authentication supplies the caller UID. The only admin authority is the `admin: true` custom claim; profile fields and callable payloads cannot grant it. Firestore rules govern direct SDK access, while Admin SDK Functions bypass rules and must check authorization themselves. Client UI checks are convenience only.

| Firestore path | Direct client boundary |
| --- | --- |
| `users/{uid}` | Public get only when the whole document contains permitted public-profile keys; list denied; owner get. Owner create/update is restricted to the public-profile schema; admin can edit/delete. A legacy document with extra fields is not publicly readable. |
| `users/{uid}/saved/{listingId}` | Owner get and bounded list; owner create/delete under schema and active-listing checks. No update. |
| `listings/{listingId}` | Public get for active/ended/sold and public list for active/ended; owner can see own drafts/removed listings. All writes require the admin claim in direct rules; ordinary create/edit/publish/remove is now via validated callable Functions. Existing public documents must be audited for extra fields because Firestore list rules cannot act as field projections. |
| `listings/{listingId}/bids/{bidId}` | Read with public parent state or owner/admin; all direct writes denied. |
| `transactions/{id}` | Participant/admin get only; no list or direct writes. `reviews/{uid}` is owner-participant/admin get only and server-written. |
| `trustSummaries/{uid}` | Owner/admin get only; no direct writes. Public seller trust is a separate callable projection. |
| `marketplaceEvents`, `userInterests`, `listingTrends` | Events admin-read only; interest/trends admin-get only; no direct writes. `intelligenceQuotas`, `discoverySessions`, `intelligenceCompletions`, `discoveryAttributions` are entirely private. |
| `promotionPackages`, `promotions`, `promotionLocks` | Packages admin-only; promotions seller-own get/admin access but server-written; locks private. Paid placement is separate from organic ranking/reputation. |
| `conversations/{id}/messages/{id}`, `reports` | All direct reads/writes denied; participant/admin projections and actions are callable only. |
| `users/{uid}/notifications`, `notificationSummaries`, `notificationPreferences`, `savedSearches`, `savedSearchQuotas`, `savedSearchFingerprints`, `sellerFollowers`, `sellerFollowSummaries`, `listingWatchers`, `listingPriceHistory`, `engagementJobs`, `engagementSchedulerCursors` | Direct reads/writes denied; server callables/triggers control access, counters, alerts, and history. |
| `offers`, `offerLocks`, `listingDeals`, `publicReviews`, `protectedPayments`, `payouts`, `refunds`, `sellerPaymentProfiles`, `transactionDisputes/evidence`, `transactionEvents`, `paymentProviderEvents` | Direct reads/writes denied; participant/admin or public-safe callable projections only. |
| `categories` | Public read, admin write. |
| Legacy `favorites`, `auctions`, `bids`, `orders`, `reviews`, `messages`, `boosts`, `featuredListings`, `notifications` | Direct reads/writes denied. The formerly public root `reviews` and `featuredListings` reads were closed because no current client uses them and whole-document reads could expose legacy private fields. |

Firestore cannot return a field-level projection under rules. Public documents must contain *only* data intended for public release. In particular, public listing documents contain seller UID and auction state, and public profile documents contain self-declared location. Do not add email, phone, precise private location, payment, moderation, or analytics fields to them. Auth email stays in Firebase Auth; admin email lookup requires the admin claim.

Storage allows public profile images at `users/{uid}/profile/{fileName}` and listing images at `users/{uid}/listings/{listingId}/{fileName}` according to listing state. Only the path owner can write/delete; listing-media writes additionally require matching listing seller and eligible state. Uploads are limited to 8 MiB and declared JPEG/PNG/WebP types. Storage rules check declared metadata, not decoded image content; malware/content scanning and upload quotas are not implemented. Fixed-price and auction publication additionally verify the object path, project bucket, Firebase download token, metadata type, and size server-side.

## Authoritative transitions and callable authorization

- Fixed-price drafts, publication, edits and removal: authenticated seller only; server validates category/condition, 2-decimal MYR price, location/coordinates, owned images, and derives `searchTokens`, `facetKeys`, `locationKey`, seller ID, and timestamps. Publishing requires a draft and images. Replayed publish or edits after an ended/sold/removed state fail. Direct client writes are denied.
- Auction create/update/publish/bid/cancel/finalization: authenticated owner or bidder as appropriate; bid amounts are integer sen, with timing/minimum/self-bid checks in transactions. Bid history and winner are server-owned. Scheduled finalization and deterministic auction transaction IDs provide replay protection.
- Offers: authenticated buyer/seller roles, live fixed-price listing, valid integer-sen amounts, expiry, offer/deal locks and transactional acceptance. An accepted offer has one deterministic transaction ID; repeated acceptance returns it.
- Standard transactions: only both independent participant confirmations complete an in-progress undisputed deal; cancellation requires the other party's consent; completed-only events credit buyer and seller roles once. Reviews require completed deals, appropriate role/tags, and immutable per-participant review IDs. Public seller summaries exclude buyer-private reputation and GMV.
- Messaging: conversation opening derives participants from listing or transaction; reads/sends/seen require participant identity, body length is bounded, and direct message writes are denied. Existing participants retain transaction conversation access after listing inactivity.
- Reports: reporter is Auth UID; target and conversation/message context are verified; draft listings cannot be reported. Admin report updates require the custom claim. Public-review reporting is limited to public seller reviews or the reviewed user's own private review.
- Engagement: notifications, counts, follows, saved searches, price history and alert jobs are server-owned. Callables scope reads/mark-read/follows/searches to Auth UID and use deterministic records/transactions for dedupe. Saved searches cap at 10 per user.
- Intelligence and promotions: accepted client event types are allowlisted and capped at 100/day/user with event-window dedupe; verified discovery sessions constrain recommendation impressions/clicks. Transaction/bid/save/message signals are trigger-derived. Promotion requests stay unpaid; only a verified `paid` active promotion can be served. No payment gateway or Stripe configuration is enabled.
- Protected transaction scaffolding is fail-closed: `createProtectedPayment` cannot create a payment, and no provider webhook or money action is active. Participant/admin projections exclude provider secrets.

The callable groups audited are `index.ts` (fixed/auction), `transactions.ts`, `messaging.ts`, `reports.ts`, `engagement.ts`, `intelligence.ts`, `discovery.ts`, `promotions.ts`, `protected-transactions.ts`, `public-sellers.ts`, and `admin.ts`. There are no general `onRequest` HTTP routes in the audited source; callable, Firestore-trigger and scheduled Functions are exported from `index.ts`.

## Abuse protections, App Check, and unresolved prerequisites

Present controls are per-user intelligence quotas, saved-search count limits, bounded page/query sizes, validated IDs/strings, transactional locks, deterministic IDs, and notification/report dedupe. **General per-user/IP rate limiting is not implemented** for messages, reports, bids, offers, listing creation, or promotion requests. Monitor costs and abuse, define policy and limits, then test enforcement before public launch. Firebase Auth account-creation abuse controls are outside this code audit.

**App Check is not configured or enforced** in the web client, callables, Firestore, or Storage. Before enforcement, register web and future mobile apps, choose providers, observe metrics and false positives, account for emulators/admin jobs, then stage enforcement for callable, Firestore and Storage access. Do not enable it blindly.

**Launch blockers:** deploy the coordinated fixed-price callable/rules/client change in the order below; validate existing public profile/listing documents against public schema and repair any legacy private fields under separately approved migration controls; establish App Check and rate-limit/abuse controls; complete privacy/PDPA, content-safety, monitoring, incident response, TTL and billing reviews; run real-device/cross-browser testing and production-safe authorization smoke checks. Existing auction derived-price reconciliation remains a separately approved production-data procedure. No production data was inspected here, so this audit cannot certify that historical public listings are free of private fields. The profile rule now fails closed for extra fields, but public listing queries still return whole documents. This historical-data exposure risk is **BLOCKING** until the live listing schema is verified or a separate public projection is introduced.

## Eventual deployment order (not executed)

1. Back up and inventory live schema, claims, indexes, Functions, web release and rollback options; obtain separate approval. Do not write migration data during this audit.
2. Deploy new Firestore indexes/configuration and wait for readiness. Deploy compatible new callable Functions **before** rules that deny direct fixed-price writes, because the existing web client still uses those writes.
3. Deploy Firestore and Storage rules together; verify the denied direct-write cases and participant/admin reads. Storage rules are unchanged in this phase, but must be checked against the live bucket configuration.
4. Deploy the matching Next.js web release immediately after the rules, with verified Firebase settings and emulator mode disabled. Monitor listing draft/publish/edit/remove errors and retain a coordinated rollback plan. Do not leave old web code with new rules as a steady state.
5. Separately stage App Check/rate-limit enforcement and any approved data remediation only after telemetry and rollback criteria are met. Protected payments require an independent legal/provider/security release, not this sequence.

Phase 15 itself performed no deployment or push.

The local root and Functions production-dependency `npm audit --omit=dev --audit-level=high` checks reported zero known vulnerabilities at audit time; this is not a substitute for ongoing dependency monitoring.
