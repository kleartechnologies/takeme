# Production backend parity and proposed deployment diff

Read-only control-plane inventory refreshed 5 October 2026, 00:29 UTC, using 11 bounded GETs against the exact owner-confirmed project `takeme-52b80`. No Auth users, Firestore customer documents, Storage objects, SDK download, Function environment or log payloads were read. No resource was changed. Local source is the reviewed staging baseline `de22d45d46ee83dff27a1c4b91e074fd47ffc9c1` plus this uncommitted sprint.

## Recalculated inventory

| Resource | Current reviewed source | Live production | Proposed change |
| --- | ---: | ---: | --- |
| Composite indexes | 49 | 48 READY, all match source | Add one deletion operation index |
| Field overrides | 13 | 3 exact matches | Nine confirmed cleanup overrides; one unused historical candidate below |
| Functions | 101: 77 callables, 17 triggers, 7 schedules | 86 ACTIVE, GEN_2, Node22, asia-southeast1 | Five missing launch callables, four deletion callables with execution OFF, updated existing implementation; omit five payment stubs |
| Schedules | 7 | 6 ENABLED | Preserve existing jobs; deletion maintenance only under separate activation approval |
| Existing TTL groups | 4 expiresAt policies intended | 0 configured | Prepare four; add private receipt expiry separately, none activated |

Both database and intended Functions region are `asia-southeast1`; exact Storage bucket is `takeme-52b80.firebasestorage.app`, location ASIA1, owner project number verified. Email/password and Google provider metadata are enabled and apex/www Auth domains present. No real production OAuth/user mutation was performed. Live Firestore/Storage rules release IDs are from 28 September; bodies were not fetched, so source equivalence remains unverified. Function names/state/runtime are not proof of deployed source version, IAM, environment or behavior.

## Index and field diff

The one missing composite is collection-scope `accountDeletionOperations`, fields `state ASC`, `expiresAt ASC`; maintenance selects expired completed/blocked operation state. No duplicate source composites and no unexpected live composites were found. Keep all 48 matching definitions; do not delete/recreate them.

| Missing collection-group override | Field | Current consumer / decision |
| --- | --- | --- |
| users | userId | Recursive watcher membership cleanup under listingWatchers |
| members | userId | Outward seller-follow membership cleanup |
| bids | bidderId | Outstanding auction obligation discovery and pseudonymisation |
| bids | outbidUserId | Historical outbid identity pseudonymisation |
| bids | retentionExpiresAt | Recursive expired bid-history cleanup query |
| changes | actorId | Listing price-history actor pseudonymisation |
| changes | retentionExpiresAt | Expired price-history cleanup query |
| notifications | sellerId | Retained counterparty notification seller pseudonymisation |
| notifications | href | Remap retained conversation links to UID-free replacement paths |
| notifications | transactionId | No current collection-group query consumer found; historical source entry, not a launch requirement. Preserve source pending review; do not claim necessary or silently remove live metadata. |

All above source definitions retain collection ASC/DESC and collection-group ASC. Live notifications createdAt/readAt/openedAt overrides already match. Deploying the full reviewed `firestore.indexes.json` would add the unused transactionId override as well; approve that small additive preservation or review its removal in source before deployment. Do not feed a missing-only JSON file to Firebase CLI: it may propose removal of omitted existing definitions. Inspect its proposed changes and refuse any deletion.

Future separately approved command: `firebase deploy --project takeme-52b80 --only firestore:indexes`. Wait for READY before cleanup/traffic. This sprint has not run it.

## Missing Function classification

| Functions | Classification | Action |
| --- | --- | --- |
| getAccountSetupStatus, acceptWebPolicies, completeFirstTimeProfile, finishAccountWelcome | LAUNCH REQUIRED | Server-owned acceptance/profile/welcome and bypass protection |
| requestUploadPermits | LAUNCH REQUIRED | New exact-path server upload cadence permit |
| getAccountDeletionAvailability, getAccountDeletionStatus, requestAccountDeletion, retryAccountDeletion | DELETION-ONLY, implementation needed for launch | Deploy only with explicit execution OFF, qualify unavailable path first |
| processAccountDeletions | DELETION-ONLY | Do not deploy/enable schedule until separate activation approval |
| getProtectedPaymentPolicy, getSellerPaymentOnboarding, createProtectedPayment, respondToProtectedDispute, addProtectedDisputeEvidence | PROTECTED-PAYMENT STUB | Exclude from V1 deployment |

Updating only the missing Functions is insufficient: current message, listing, offer/bid/report handlers and derived-event triggers need the reviewed idempotency/cadence/category changes. The exact prepared nonscheduled selector contains 89 Functions, including four gated deletion endpoints and all 17 reviewed triggers, excluding the five payment stubs and all seven schedules. Managed runtime must supply exact platform identity; approved server configuration must explicitly set deletion OFF and payments OFF. No backend credentials are embedded.

```sh
firebase deploy --project takeme-52b80 --only functions:acceptWebPolicies,functions:cancelAuction,functions:cancelPromotionRequest,functions:completeFirstTimeProfile,functions:confirmTransactionCompletion,functions:createAuctionListing,functions:createFixedListingDraft,functions:createPromotionRequest,functions:declineTransactionCancellation,functions:deleteSavedSearch,functions:disputeTransaction,functions:finishAccountWelcome,functions:getAccountDeletionAvailability,functions:getAccountDeletionStatus,functions:getAccountSetupStatus,functions:getAdminMetrics,functions:getAdminPage,functions:getAdminRecord,functions:getAuctionViewerState,functions:getConversation,functions:getConversationMessages,functions:getConversations,functions:getFeaturedPromotions,functions:getFollowState,functions:getFollowing,functions:getListingDealState,functions:getMarketplaceDiscovery,functions:getMarketplaceRecommendations,functions:getMarketplaceSimilar,functions:getMyListingHistory,functions:getMyPromotionRequests,functions:getMyTransactions,functions:getNotificationPreferences,functions:getNotifications,functions:getPromotionPackages,functions:getPromotionPlacements,functions:getPublicListingDetail,functions:getPublicListingPage,functions:getPublicReviews,functions:getPublicSellerSummaries,functions:getReputationPolicy,functions:getSavedSearches,functions:getTransactionDetail,functions:getUnreadCount,functions:markAllNotificationsRead,functions:markConversationSeen,functions:markNotificationRead,functions:onAuctionBidCreated,functions:onAuctionWonCreateTransaction,functions:onBidEngagementCreated,functions:onCompletedTransactionInterest,functions:onConversationMessageCreated,functions:onConversationStarted,functions:onListingEngagementChanged,functions:onMessageEngagementCreated,functions:onOfferEngagementCreated,functions:onOfferEngagementUpdated,functions:onPromotedListingUpdated,functions:onSavedListingCreated,functions:onSavedListingDeleted,functions:onSavedWatchChanged,functions:onTransactionConversationCreated,functions:onTransactionEngagementCreated,functions:onTransactionEngagementUpdated,functions:openListingConversation,functions:openNotification,functions:openTransactionConversation,functions:placeBid,functions:publishAuctionListing,functions:publishFixedListing,functions:removeFixedListing,functions:reportPublicReview,functions:requestAccountDeletion,functions:requestTransactionCancellation,functions:requestUploadPermits,functions:respondToOffer,functions:retryAccountDeletion,functions:saveSearch,functions:sendConversationMessage,functions:setNotificationPreference,functions:setSellerFollow,functions:submitMarketplaceReport,functions:submitOffer,functions:submitTransactionReview,functions:trackMarketplaceEvent,functions:trackPromotionEngagement,functions:updateAdminReport,functions:updateAuctionListing,functions:updateFixedListing
```

This is a future approval command, not an action performed. Review IAM/API/billing/instance changes first; schedules are deliberately handled separately.

## Schedules

| Job | Live state | Decision |
| --- | --- | --- |
| advanceAuctionLifecycle, every minute | ENABLED | LAUNCH REQUIRED, start/end/winner finalization |
| processEngagementJobs, every minute | ENABLED | LAUNCH REQUIRED, Updates/follow/search notifications |
| expireOffers, hourly | ENABLED | LAUNCH REQUIRED, negotiation expiry and locks |
| releaseExpiredReviews, hourly | ENABLED | LAUNCH REQUIRED, double-blind review release |
| queueEndingAuctionAlerts, every minute | ENABLED | OPTIONAL, retain existing behavior until owner decides |
| expirePromotions, hourly | ENABLED | POST-LAUNCH unless unpaid/verified active promotion lifecycle requires it; recommend pausing only after approval |
| processAccountDeletions, every five minutes | Not created | DELETION-ONLY; separate execution/maintenance approval |

Future launch-job update: `firebase deploy --project takeme-52b80 --only functions:advanceAuctionLifecycle,functions:processEngagementJobs,functions:expireOffers,functions:releaseExpiredReviews`. Optional jobs are neither disabled nor redeployed by this sprint. Emulator tests invoke maintenance directly; they do not certify Scheduler delivery.

## Prepared TTL changes

TTL fields must be timestamps. Expiry is asynchronous, not access revocation and does not recurse into subcollections. No TTL policy was enabled and no timestamp was backfilled.

| Collection group | Field | Source lifetime |
| --- | --- | --- |
| marketplaceEvents | expiresAt | 90 days |
| intelligenceQuotas | expiresAt | 3 days |
| discoverySessions | expiresAt | 2-hour validity |
| discoveryAttributions | expiresAt | 7-day validity |
| messageSendReceipts | expiresAt | New private retry metadata, 24 hours; deterministic logical-message lookup keeps dedupe afterward |

After explicit approval, run one exact command per group:

```sh
gcloud firestore fields ttls update expiresAt --collection-group=marketplaceEvents --database='(default)' --project=takeme-52b80 --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=intelligenceQuotas --database='(default)' --project=takeme-52b80 --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=discoverySessions --database='(default)' --project=takeme-52b80 --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=discoveryAttributions --database='(default)' --project=takeme-52b80 --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=messageSendReceipts --database='(default)' --project=takeme-52b80 --enable-ttl

```

The first four are existing expiry intent; the fifth is newly proposed receipt expiry, separate from retained messages. Cadence/permit state is bounded and pruned on use, under recursive user cleanup. No overall account Storage/product quota is introduced.

## Approved-future order

1. Add one composite and reviewed field overrides; wait READY, no index deletions.
2. Deploy reviewed nonscheduled V1 Functions/triggers with deletion OFF and payments OFF, after server runtime/IAM qualification.
3. Only after actual final legal approval regenerate/review and deploy matching Firestore/Storage rules. New upload permits must be deployed together with compatible clients; old upload clients will otherwise fail closed.
4. Review the default no-cloud production policy bootstrap plan; separately authorize create-only releasePolicies/current initialization.
5. Update/verify the four launch-required schedules; decide optional jobs separately.
6. Activate TTL only under independent approval and verify state/expiry in an approved data plan.
7. Qualify and authorize deletion execution/maintenance separately, preserving obligations, retries, retention and audit safeguards.
8. Rebuild/check the exact final frontend; pass strict launch qualification; then obtain separate Worker/domain/cutover approval with Netlify rollback preserved.

No step here is deployment authorization. Live parity, operational alerts, final legal and deletion activation remain launch blockers.
