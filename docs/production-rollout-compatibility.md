# Production rollout compatibility resolution

5 October 2026. Local, uncommitted changes on reviewed checkpoint `2e701e2e38641380878e99242b5b573b060af7db`. No cloud calls, deployment, source-policy activation, deletion activation, DNS change or customer-data access in this resolution. The prior bounded control-plane inventory is evidence of resource names and configuration, not of deployed Function code, IAM, runtime environment or successful production requests.

## Additive index preparation

Source retains all 49 composites. The only missing live composite in the captured inventory is collection-scope `accountDeletionOperations` with `state ASCENDING`, `expiresAt ASCENDING`, used for expired completed-operation maintenance. It is an account-deletion activation prerequisite, not an ordinary marketplace query gap.

Each of these nine fields now declares **collection ASC, collection DESC, collection ARRAY_CONTAINS and collection-group ASC**:

| Group | Fields |
| --- | --- |
| users | userId |
| members | userId |
| bids | bidderId, outbidUserId, retentionExpiresAt |
| changes | actorId, retentionExpiresAt |
| notifications | sellerId, href |

This preserves the inherited modes captured on 5 October. The three existing notification time overrides are unchanged; no TTL setting is added, removed or activated. There are now 12 field overrides. `notifications.transactionId` is **removed from source**: the TypeScript query audit finds the actual current notification group consumers but no group query on that field. Notification payloads and transaction links remain unchanged. Captured live metadata also had no such explicit override; this does not authorize deleting an override introduced subsequently.

Before a separately approved apply, refresh metadata and compare effective inheritance and TTL again. Apply only the missing composite and exact nine-field index union, with field PATCH `updateMask=indexConfig` where applicable; do not include TTL in that update. Preserve every existing resource. A full `firebase deploy --project takeme-52b80 --only firestore:indexes` is only suitable after inspecting its complete proposed diff and refusing removals/replacements. Do not use a missing-only Firebase index file: omission can imply deletion. Wait for READY. The prior private index plan reflects the old source and must be regenerated before any apply.

## Bounded messaging transition

New clients continue sending explicit sender/conversation/action-scoped keys. Retries share a deterministic message ID and private receipt; they do not repeat quota consumption, unread changes, notification creation or engagement effects. Invalid, empty or null keys are refused.

Only an **absent** key can use the server fallback. It is OFF by default and requires the exact managed/Admin/configured project to agree with the selected release target, plus:

```text
TAKEME_ENABLE_LEGACY_MESSAGE_SEND=true
TAKEME_LEGACY_MESSAGE_SEND_UNTIL=<owner-approved canonical UTC deadline>
```

The window is active only during the seven days preceding that deadline and expires automatically. No production deadline was chosen or stored in this sprint. Non-demo runtimes reject emulator overrides. A legacy invocation gets one random server identity before transaction retries; expiry is rechecked after the transaction's last asynchronous read, before message writes. Separate legacy HTTP retries are separate sends because there is no client key distinguishing a retry from an intentional repeated message. Do not claim exactly-once legacy delivery. Authentication, participants, deletion lifecycle and policy/18+ checks remain mandatory.

Future migration: qualify keyed frontend requests and retry behavior; separately approve the exact finite server window; deploy the compatible message handler only after eligible-account/policy readiness; release the keyed frontend; verify old-keyless and new-keyed traffic with safe aggregate monitoring; expire/disable the window after refresh/adoption. If the window is absent or expired, the keyed frontend must arrive before this handler update for active old clients. Reopening or extending a window needs a new review. Retain final idempotency and authorization after the transition.

## Upload phases

| Phase | Backend / rules | Client and exit condition |
| --- | --- | --- |
| A: additive preparation | Deploy `requestUploadPermits` and setup endpoints with deletion OFF. Keep existing Storage rules. Before the approved policy record exists, permits/acceptance fail closed. | Old owned uploads continue only because the historical production rules still permit them; no temporary permissive branch is added to final rules. |
| B: compatible frontend | After actual legal approval and bootstrap, permit issuance works for current accepted, active owners. Retain existing Storage rules during adoption. | New frontend requests exact-path/type/size permits, uploads to fresh UUID paths and attaches permit metadata. Avatar and listing flows work under old rules and final rules. Verify adoption, readback, cleanup and refresh/rollback compatibility. |
| C: final enforcement | Deploy approved final-version Storage rules after the compatible frontend is live and qualified. Require permits, owner/lifecycle/current acceptance, editable listing and absent object. | Permitless uploads and overwrites are denied. Refresh stale clients or use an approved bounded pause of affected writes; do not loosen the final rules to accommodate them. |

The historical Storage rules fixture is tracked source from `1c346f09ca4caad5ce674c1883e9c807f89ed7c1`, matched to the captured legacy rules. It is for loopback demo integration only. `firebase.json` still points at root `storage.rules`, not the fixture. It is not a recommended production rollback ruleset.

Permits are short leases, not physical single-use upload counters. Mirror revocation immediately blocks new permits and protected Function writes; it does not independently revoke already minted Storage permits because Storage uses the existing two-document lookup budget. Acceptance/lifecycle removal and final rules still gate them. No content scanning or App Check rollout is introduced.

## Policy runtime separation

`release-policy.ts` remains the approved source for legal pages, frontend proof/versions, generated rules, bootstrap and deletion qualification. Actual production source stays unpublished with null Terms/Privacy identifiers. No final version is invented or activated.

Serving Functions resolve current production versions from the **trusted server-owned** `releasePolicies/current` record. Firestore permits a public get of its nonpersonal release metadata; public writes/list are denied. The exact six-field record must identify production and `takeme-52b80`, publication=true, final non-draft Terms/Privacy identifiers and age 18. Missing, null, revoked, malformed, additional-field or wrong-target/project records deny acceptance and protected activity. Exact managed project and default Admin bucket must also match the confirmed production resources; neither clients nor environment approval/version flags can substitute a policy record. Demo/staging remain pinned to their respective source versions.

Policy activation therefore does not require rebuilding already prepared **unrelated serving Functions**. Setup status returns resolved versions and acceptance validates them in the guarded transaction. Source and generated rules/frontend must still use the legally approved exact versions and be requalified; legal route publication still needs its independent approvals. Source-compiled deletion qualification stays separate and may require a related Function rebuild at a future authorized activation.

The existing bootstrap still checks real source/legal approvals, exact resources and generated rule equality before initializing Admin/credentials. It remains create-only/idempotent. An existing revoked, mismatched or additional-field record is not repaired or re-enabled; any replacement/version revision needs a separately reviewed operation. The runtime resolver is not an alternative policy-publication endpoint.

## Five preparation Functions

| Export | Before bootstrap | After separately approved bootstrap |
| --- | --- | --- |
| getAccountSetupStatus | Authenticated active owner receives acceptance step, policyAvailable=false, null versions; pending lifecycle returns deletion | Authoritative acceptance/profile/welcome/ready state |
| acceptWebPolicies | Refuses without changing acceptance | Requires current Terms, Privacy and explicit 18+ confirmation; idempotent acceptance |
| completeFirstTimeProfile | Refuses | Requires current acceptance and saved valid name |
| finishAccountWelcome | Refuses | Requires current acceptance and completed profile; idempotent welcome |
| requestUploadPermits | Refuses | Requires current eligibility, active lifecycle, exact owned editable paths, type/size and bounded upload cadence |

These can be deployed as isolated preparation endpoints before legal activation without replacing old serving endpoints. Exact Node22/asia-southeast1 runtime, managed project/bucket and least-privilege IAM still require deployment preflight. Existence is not permission to use them and is not proof of production availability.

Future separately approved selector:

```sh
firebase deploy --project takeme-52b80 --only functions:getAccountSetupStatus,functions:acceptWebPolicies,functions:completeFirstTimeProfile,functions:finishAccountWelcome,functions:requestUploadPermits
```

No Firebase CLI command in this document was executed.

## Serving classification

The separate per-export inventory below covers 80 existing nonscheduled update candidates and five preparation endpoints. The old 89-export blanket selector is superseded: the general set is **85** (80 existing + five preparation; 68 callables + 17 triggers). Four deletion callables, deletion maintenance, five payment stubs and all schedules are separate. Twelve existing admin/promotion exports are conditional parity, not new launch feature requirements.

Classification reflects the captured live name inventory plus current source and known older request contracts. Deployed source was not recovered, so it does not certify exact live equivalence. Read/lifecycle changes still deliberately deny deleted/disabled accounts. Cadence may intentionally reject excessive traffic. Preserve idempotent derived IDs when updating event handlers; snapshot names alone do not prove that old side effects were idempotent.

An endpoint classified BACKWARD COMPATIBLE has no newly required ordinary caller input or acceptance prerequisite in the inspected source. It still needs normal contract/IAM preflight. A coordinated row is not approved for an early blanket update: missing policy/current account acceptance would deny old active-user writes or skip policy-gated derived events. There is no permission to create synthetic acceptance for production users.

## Exact gated rollout order

1. **Additive preparation:** separately approve source, refresh identity/resource metadata and confirm no drift; add the composite and nine fields, preserving modes/TTL; wait READY. Deploy only the five preparation endpoints with execution/payments OFF. Keep existing serving Functions, schedules, Firestore and Storage rules, Netlify and DNS intact.
2. **Real legal readiness:** obtain the outstanding final English/BM/address/retention/publication decisions and exact final identifiers. Update actual approved source, regenerate both marked rule blocks and requalify. Prepare the compatible frontend artifact/rollback artifact and publish only actually approved policy information. Do not install currently false-production generated rules: they intentionally deny production writes.
3. **Acceptance becomes available:** under separate approval create the exact server-owned policy record using the checked create-only bootstrap. Keep legacy rules for the upload transition. Confirm the five endpoints and current-version acceptance; runtime versions need no unrelated Functions rebuild. Policy/legal activation must precede reliance on eligibility-enforcing serving updates, rather than being postponed until after them.
4. **Compatible frontend/adoption:** separately authorize the compatible website release, without this document authorizing domain/DNS cutover. Verify current acceptance, profile/welcome, keyed messages, permit-bearing fresh-path uploads and ordinary browsing against still compatible serving/rules. Verify any new frontend API dependency before releasing it; unchanged names alone are insufficient. Old upload paths still work under legacy rules. Offer users genuine reacceptance; do not fabricate timestamps or bypass 18+.
5. **Serving update:** require a reviewed accepted-user/refresh transition and exact bounded legacy message window. Deploy coordinated guarded writes and gated intelligence handlers as reviewed subsets; qualifying account traffic must already have current acceptance. Other reviewed read/derived subsets can be approved independently. Observe safe aggregated errors/deduplication/cadence and validate the four launch schedules separately. Do not deploy all seven schedules, payment stubs or deletion execution through a broad Functions selector.
6. **Final rules / upload phase C:** after permit/keyed client adoption and a compatible rollback are verified, separately approve final generated Firestore/Storage rules. Refuse any stale-client requirement that would weaken final protection. Qualify reads, owned/private projections, direct-write denial, permits and lifecycle/eligibility immediately. Keep TTL/deletion/optional schedules under separate approvals.
7. **Final production qualification:** verify actual backend artifact/version/configuration, telemetry/operational owners, legal/rules/mirror parity and the production release artifact. Deletion status/request/retry deployment OFF, IAM/retention/TTL readiness and separately approved deletion activation remain distinct prerequisites of the existing final launch checker. Only a later owner decision can authorize website cutover or DNS. Preserve Netlify until its compatible rollback has been tested.

**A zero-downtime write transition is not established.** Old browser sessions without accepted policies must be denied by the new guards, and old permitless uploads must be denied by final rules. Prefer staged adoption and refresh; if that cannot cover active clients, request an explicitly scoped write pause/coordinated cutover. Public reads can remain available subject to deployed contract verification. There is no supported sequence that both keeps unaccepted old-client writes working indefinitely and enforces Terms/Privacy/18+ fail-closed. Do not claim the proposed legal-last order achieves that.

Rollback is phase-dependent. Capture exact compatible Functions/frontend artifacts, ruleset IDs, identity/configuration and schedule state before each approved phase. Before phase C the legacy frontend may still upload but has no new eligibility UI; after guarded serving/rules enforcement, keep a compatible keyed/permit-aware acceptance-capable rollback frontend. Expire the legacy key window on schedule. Do not automatically restore weaker rules, reactivate a revoked policy record, delete additive indexes, enable deletion or restore deleted accounts. If acceptance is unavailable, deny affected writes and involve the owner rather than bypassing it.

## Qualification and decision scope

App/Functions tests, TypeScript, ESLint, query/mode checks and isolated demo integrations qualify the local source. Production readiness requires later approved deployment and live checks; no production requests were made here. The complete test results and per-export table follow below. Private output and test-generated synthetic credentials stay outside Git; no SDK config, environment file, production client value or deployment output is added to source.

The **plan is ready for owner review as a gated sequence**. Composite, nine field unions and five inactive preparation endpoints are technically safe for separately approved preflight/apply. The **entire serving update set is not safe to deploy now**, before actual legal/bootstrap/accepted-user transition and runtime/contract verification. This distinction does not activate Group 2 or approve cutover.

## Per-export inventory

All source symbols are covered once: 80 existing nonscheduled updates, five preparation exports and 16 separate exclusions. `Optional` marks the 12 existing admin/promotion exports. Lines identify current source, not deployed source. Categories below are technical planning classifications, not deployment authorization.

| Export | Kind / wrapper | Classification | Source | Scope |
| --- | --- | --- | --- | --- |
| acceptWebPolicies | callable / marketplaceCall | REQUIRES BACKEND FIRST | `functions/src/auth-onboarding.ts:54` | Preparation |
| cancelAuction | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:426` | Core update |
| cancelPromotionRequest | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/promotions.ts:93` | Optional |
| completeFirstTimeProfile | callable / marketplaceCall | REQUIRES BACKEND FIRST | `functions/src/auth-onboarding.ts:74` | Preparation |
| confirmTransactionCompletion | callable / resolutionMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:186` | Core update |
| createAuctionListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:305` | Core update |
| createFixedListingDraft | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:183` | Core update |
| createPromotionRequest | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/promotions.ts:59` | Optional |
| declineTransactionCancellation | callable / resolutionMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:255` | Core update |
| deleteSavedSearch | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:235` | Core update |
| disputeTransaction | callable / resolutionMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:269` | Core update |
| finishAccountWelcome | callable / marketplaceCall | REQUIRES BACKEND FIRST | `functions/src/auth-onboarding.ts:89` | Preparation |
| getAccountSetupStatus | callable / onCall | REQUIRES BACKEND FIRST | `functions/src/auth-onboarding.ts:25` | Preparation |
| getAdminMetrics | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/admin.ts:238` | Optional |
| getAdminPage | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/admin.ts:271` | Optional |
| getAdminRecord | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/admin.ts:289` | Optional |
| getAuctionViewerState | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/public-listings.ts:56` | Core update |
| getConversation | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/messaging.ts:65` | Core update |
| getConversationMessages | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/messaging.ts:89` | Core update |
| getConversations | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/messaging.ts:75` | Core update |
| getFeaturedPromotions | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/promotions.ts:137` | Optional |
| getFollowState | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:149` | Core update |
| getFollowing | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:184` | Core update |
| getListingDealState | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/transactions.ts:297` | Core update |
| getMarketplaceDiscovery | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/discovery.ts:77` | Core update |
| getMarketplaceRecommendations | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/intelligence.ts:256` | Core update |
| getMarketplaceSimilar | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/discovery.ts:109` | Core update |
| getMyListingHistory | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/public-listings.ts:78` | Core update |
| getMyPromotionRequests | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/promotions.ts:112` | Optional |
| getMyTransactions | callable / resolutionCall | BACKWARD COMPATIBLE | `functions/src/transactions.ts:314` | Core update |
| getNotificationPreferences | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:134` | Core update |
| getNotifications | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:70` | Core update |
| getPromotionPackages | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/promotions.ts:57` | Optional |
| getPromotionPlacements | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/promotions.ts:121` | Optional |
| getPublicListingDetail | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/public-listings.ts:37` | Core update |
| getPublicListingPage | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/public-listings.ts:142` | Core update |
| getPublicReviews | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/transactions.ts:407` | Core update |
| getPublicSellerSummaries | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/public-sellers.ts:10` | Core update |
| getReputationPolicy | callable / resolutionCall | BACKWARD COMPATIBLE | `functions/src/transactions.ts:35` | Core update |
| getSavedSearches | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:252` | Core update |
| getTransactionDetail | callable / resolutionCall | BACKWARD COMPATIBLE | `functions/src/transactions.ts:324` | Core update |
| getUnreadCount | callable / marketplaceCall (local alias onCall) | BACKWARD COMPATIBLE | `functions/src/engagement.ts:64` | Core update |
| markAllNotificationsRead | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:117` | Core update |
| markConversationSeen | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/messaging.ts:139` | Core update |
| markNotificationRead | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:81` | Core update |
| onAuctionBidCreated | firestore-trigger / onDocumentCreated | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:205` | Core update |
| onAuctionWonCreateTransaction | firestore-trigger / onDocumentUpdated | BACKWARD COMPATIBLE | `functions/src/transactions.ts:161` | Core update |
| onBidEngagementCreated | firestore-trigger / onDocumentCreated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:308` | Core update |
| onCompletedTransactionInterest | firestore-trigger / onDocumentCreated | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:233` | Core update |
| onConversationMessageCreated | firestore-trigger / onDocumentCreated | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:221` | Core update |
| onConversationStarted | firestore-trigger / onDocumentCreated | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:213` | Core update |
| onListingEngagementChanged | firestore-trigger / onDocumentWritten | BACKWARD COMPATIBLE | `functions/src/engagement.ts:277` | Core update |
| onMessageEngagementCreated | firestore-trigger / onDocumentCreated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:51` | Core update |
| onOfferEngagementCreated | firestore-trigger / onDocumentCreated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:315` | Core update |
| onOfferEngagementUpdated | firestore-trigger / onDocumentUpdated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:320` | Core update |
| onPromotedListingUpdated | firestore-trigger / onDocumentUpdated | BACKWARD COMPATIBLE | `functions/src/promotions.ts:189` | Optional |
| onSavedListingCreated | firestore-trigger / onDocumentCreated | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:186` | Core update |
| onSavedListingDeleted | firestore-trigger / onDocumentDeleted | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:198` | Core update |
| onSavedWatchChanged | firestore-trigger / onDocumentWritten | BACKWARD COMPATIBLE | `functions/src/engagement.ts:269` | Core update |
| onTransactionConversationCreated | firestore-trigger / onDocumentCreated | BACKWARD COMPATIBLE | `functions/src/messaging.ts:145` | Core update |
| onTransactionEngagementCreated | firestore-trigger / onDocumentCreated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:327` | Core update |
| onTransactionEngagementUpdated | firestore-trigger / onDocumentUpdated | BACKWARD COMPATIBLE | `functions/src/engagement.ts:331` | Core update |
| openListingConversation | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/messaging.ts:24` | Core update |
| openNotification | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:96` | Core update |
| openTransactionConversation | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/messaging.ts:40` | Core update |
| placeBid | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:381` | Core update |
| publishAuctionListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:334` | Core update |
| publishFixedListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:199` | Core update |
| removeFixedListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:236` | Core update |
| reportPublicReview | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:417` | Core update |
| requestTransactionCancellation | callable / resolutionMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:228` | Core update |
| requestUploadPermits | callable / marketplaceMutationCall | REQUIRES BACKEND FIRST | `functions/src/upload-permits.ts:11` | Preparation |
| respondToOffer | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:88` | Core update |
| saveSearch | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:201` | Core update |
| sendConversationMessage | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/messaging.ts:104` | Core update |
| setNotificationPreference | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:139` | Core update |
| setSellerFollow | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/engagement.ts:155` | Core update |
| submitMarketplaceReport | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/reports.ts:15` | Core update |
| submitOffer | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:56` | Core update |
| submitTransactionReview | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/transactions.ts:343` | Core update |
| trackMarketplaceEvent | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/intelligence.ts:135` | Core update |
| trackPromotionEngagement | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/promotions.ts:158` | Optional |
| updateAdminReport | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/admin.ts:354` | Optional |
| updateAuctionListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:357` | Core update |
| updateFixedListing | callable / marketplaceMutationCall | REQUIRES COORDINATED CUTOVER | `functions/src/index.ts:216` | Core update |

The 40 BACKWARD COMPATIBLE rows comprise 29 read callables and 11 event handlers; eight are optional. Forty coordinated rows comprise 34 mutations and six eligibility-gated intelligence handlers; four are optional. Five preparation rows require backend first. None has FRONTEND FIRST as its overall category; `sendConversationMessage` has a separate request-contract requirement for frontend first when the bounded legacy window is disabled/expired. The eligibility/readiness requirement still makes its overall rollout coordinated.

The five-endpoint exact preparation selector appears above. Construct each later approved selector from only its reviewed rows; do not deploy all 85 as preparation. Review existing optional admin/promotion modules separately; do not add launch dependencies just because those exports already exist.

| Separate export | Treatment | Source |
| --- | --- | --- |
| addProtectedDisputeEvidence | PAYMENT_STUB_EXCLUDED | `functions/src/protected-transactions.ts:96` |
| advanceAuctionLifecycle | V1_REQUIRED_EXISTING_SCHEDULE_SEPARATE | `functions/src/index.ts:479` |
| createProtectedPayment | PAYMENT_STUB_EXCLUDED | `functions/src/protected-transactions.ts:45` |
| expireOffers | V1_REQUIRED_EXISTING_SCHEDULE_SEPARATE | `functions/src/transactions.ts:143` |
| expirePromotions | OPTIONAL_EXISTING_SCHEDULE | `functions/src/promotions.ts:170` |
| getAccountDeletionAvailability | DELETION_SEPARATE_APPROVAL | `functions/src/account-deletion.ts:29` |
| getAccountDeletionStatus | DELETION_SEPARATE_APPROVAL | `functions/src/account-deletion.ts:48` |
| getProtectedPaymentPolicy | PAYMENT_STUB_EXCLUDED | `functions/src/protected-transactions.ts:20` |
| getSellerPaymentOnboarding | PAYMENT_STUB_EXCLUDED | `functions/src/protected-transactions.ts:28` |
| processAccountDeletions | DELETION_SEPARATE_APPROVAL | `functions/src/account-deletion.ts:438` |
| processEngagementJobs | V1_REQUIRED_EXISTING_SCHEDULE_SEPARATE | `functions/src/engagement.ts:382` |
| queueEndingAuctionAlerts | OPTIONAL_EXISTING_SCHEDULE | `functions/src/engagement.ts:396` |
| releaseExpiredReviews | V1_REQUIRED_EXISTING_SCHEDULE_SEPARATE | `functions/src/transactions.ts:385` |
| requestAccountDeletion | DELETION_SEPARATE_APPROVAL | `functions/src/account-deletion.ts:58` |
| respondToProtectedDispute | PAYMENT_STUB_EXCLUDED | `functions/src/protected-transactions.ts:74` |
| retryAccountDeletion | DELETION_SEPARATE_APPROVAL | `functions/src/account-deletion.ts:74` |

Existing six schedule resources remain as captured. `advanceAuctionLifecycle`, `processEngagementJobs`, `expireOffers` and `releaseExpiredReviews` are separate launch-job verification/update candidates. `queueEndingAuctionAlerts` is optional; `expirePromotions` is conditional on verified promotion lifecycle. `processAccountDeletions` is a separate activation-only schedule. No schedule was created, disabled or enabled here.

## Verified local results

| Check | Result |
| --- | --- |
| App tests | 226/226 PASS, including 12 new index/query preservation cases and existing auth/staging/release safeguards |
| Functions compile and tests | 103/103 PASS; eight message identity/window cases and nine new policy-runtime cases included |
| Frontend TypeScript | PASS, no diagnostics |
| Full ESLint | PASS, no warnings/errors |
| Demo integration suites | 19/19 PASS |
| Messaging integration | 9 groups PASS, including old missing-key invocation during synthetic server window, keyed concurrent retry, deduped effects and ownership/eligibility/lifecycle denials |
| New rollout integration | 7 groups PASS: historical owner upload, permit-aware legacy-rule upload, strict-rule permitless/overwrite refusal, new avatar/listing permit readback, inactive-policy refusal, restored demo-only onboarding, pending-lifecycle permit refusal |
| Eligibility / onboarding integrations | 9 and 12 groups, all PASS, including acceptance/18+ bypass refusal and real server-owned onboarding |
| Remaining demo regression | Offers/transactions, auctions, Saved/follow/Updates, Settings/admin, seller/location privacy, deletion, abuse/cadence and legacy category handling PASS |
| Diff/source review | PASS; final production policy false/null, final rules unchanged, no SDK config/environment/credential/generated artifact introduced |
| Credential and transport isolation | PASS; fresh empty CLI config, no ADC/user tokens, loopback-only Node transport; no production/staging network allowed |

The private reversible test harness used demo-takeme only on 8180/9098/9299/5101 with installed Node22.23.2 and Java21. Port normalization affected private copies only and reverses to source exactly. The legacy message deadline was synthetic demo-only, not a configured production date. The historical rules and demo mirror were restored in test finally blocks. No final production policy was activated by the pure final-shaped unit-test record or restored demo policy. Tests do not certify production IAM, actual old browser adoption, Scheduler delivery or live Function behavior.

All emulators started for this audit were stopped. The pre-existing Firestore process on 8080 remained untouched. Main and its prior five review/probe files are unchanged. Changes remain local and uncommitted in the qualification worktree. No commit, push or deployment occurred.
