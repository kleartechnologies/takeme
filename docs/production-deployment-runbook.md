# Phase 15B: production deployment preparation (not an approval to deploy)

This runbook describes a **candidate** rollout for `takeme-52b80`. Phase 15B changes local documentation only. The separate Phase 15A read-only audit observed no root Firestore collections, no Storage objects, zero deployed Functions, eight deployed composite indexes, old rules, and a live Netlify site on older commit `53d4c2a21009962ffaa69ca393f758546067d5c3`. It did not prove that every orphaned subcollection is absent or that future public documents will be safe. No deployment step below has been executed.

## Environment and artifact mapping

| Surface | Production target | Local/demo distinction |
| --- | --- | --- |
| Firebase | `takeme-52b80`; `.firebaserc` default; Web App `TAKEME Web`; Firestore `(default)` in `asia-southeast1`; Storage bucket `takeme-52b80.firebasestorage.app`; Functions runtime Node 22 in `asia-southeast1` | `demo-takeme` and `demo-takeme-engagement` are emulator-only IDs. Never use them for deployment or Netlify variables. |
| Firebase deployment inputs | `firebase.json` selects `firestore.rules`, `firestore.indexes.json`, `storage.rules`, and `functions/` | Firebase CLI default is **not** sufficient authorization to deploy; use explicit project, resource selection, review and Gate 9 approval. |
| Web | Netlify site `mytakeme`, `takeme.my`; `www.takeme.my` currently redirects to apex over HTTPS | This checkout has no `.netlify` link and no `netlify.toml`. The site reports zero production environment variables and serves older commit `53d4c2a…`; repository-to-site mapping must be revalidated before release. |
| Payments | `PROTECTED_PAYMENTS_ENABLED=false` is the fail-closed state; the Stripe provider is a non-operational stub | No Stripe key, payment provider, webhook, payout, or money movement belongs in this release. |

The Web SDK configuration was retrieved read-only for a local test; all six Firebase client fields were present and its project/bucket matched `takeme-52b80`. Values were not saved to the repository or this document. This confirms available configuration, **not** Netlify configuration.

## Index readiness

`firestore.indexes.json` has **45** composite definitions: 40 `COLLECTION`, five `COLLECTION_GROUP`, no field overrides. A local structural check found no malformed entries or exact duplicates. The five collection-group indexes target `notifications` (four) and `members` (one), matching `db.collectionGroup` queries in admin/engagement code. Firestore emulator startup and query suites parse the index file; that is not a deployed-index readiness check. No obviously obsolete definition was removed.

| Production now | Local expected | Missing | Action after approval |
| ---: | ---: | ---: | --- |
| 8 | 45 | 37 | Deploy indexes first; wait until every required index is `READY` before Functions/web traffic. Do not remove the existing eight. |

The eight deployed definitions exactly match a subset of local definitions. The 37 missing definitions cover `conversations`, `listings`, `marketplaceEvents`, `members`, `notifications`, `offers`, `promotions`, `publicReviews`, `reports`, `transactions`, and `trustSummaries`. Listing indexes support category/newest, seller feeds, facet/search-token price and newest sorting, and auction start/end queries. Offer/transaction/review/report indexes support lifecycle, user history and admin queries; promotion and event indexes support discovery, expiry, analytics and admin metrics. Single-field queries (including saved searches and trend timestamps) use Firestore's automatic single-field indexes unless a verified exemption exists. Before Gate 3 closes, recompare live indexes and validate representative query plans/`FAILED_PRECONDITION` links in a staging or approved production-safe smoke check. Index creation is asynchronous and billable; it is not a trivial rollback.

## Rules and Storage readiness

The intended Firestore target is the committed `firestore.rules`, **not** the deployed 18 September ruleset. Production still has `allow read: if true` on whole `users`, root `reviews`, and `featuredListings` documents and allows direct fixed-price listing owner writes. Local rules instead fail closed on public profile documents with extra fields, deny public root legacy review/featured reads, and require server callables for all ordinary listing writes. The local rules also cover server-owned auctions/bids, offers/transactions/reviews/reputation, participant messaging, reports/moderation, notifications, saves/follows/searches, price history, intelligence, promotions, protected-payment data and admin collections. Direct writes to their authoritative records are denied or tightly scoped. There is no field-level public projection for historical listing documents: the live schema must be rechecked before public data is populated.

The intended Storage target is committed `storage.rules`, not the deployed 18 September ruleset. Paths are `users/{uid}/profile/{fileName}` and `users/{uid}/listings/{listingId}/{fileName}`. Profile writes/deletes require the path owner; listing media additionally requires matching seller and permitted listing/auction state. Non-owner overwrite/delete is denied; uploads are at most 8 MiB with declared JPEG/PNG/WebP type. Public profile and eligible listing media remain readable; there is no private-asset path. Declared MIME is not decoded-content scanning, and no upload quota exists. Storage emulator tests exercise ownership, unauthorized overwrite/delete, auction state and image publication. Deploy Firestore and Storage rules only after matching Functions exist; their releases must be coordinated with the web cutover.

## Functions runtime, configuration and dependencies

There are **87 exported production Functions** in `functions/src/index.ts` and its re-exports: callables, Firestore triggers and scheduled jobs. Production has **zero**. All use the Node 22 Functions source and Firebase Admin SDK; global region is `asia-southeast1`. Firebase project/runtime identity is supplied by the platform, not by a custom Firebase secret. Function authorization depends on Firebase Auth UID or the `admin: true` custom claim, and server-side Firestore transactions/locks. The Storage-verifying listing callables depend on the production bucket and its media rules. The scheduled jobs require Cloud Scheduler/Pub/Sub/Eventarc support and the corresponding platform service agents; check quotas, billing, IAM and supported APIs before Gate 4. No active function requires a Stripe secret. `PROTECTED_PAYMENTS_ENABLED` is **not required** for this disabled release; if set at all it must be `false`. Future provider configuration is **FUTURE / NOT ACTIVE**.

| Functions setting/capability | Phase 15B classification | Release requirement |
| --- | --- | --- |
| Firebase project identity and Admin SDK credentials | **NOT REQUIRED** as manually supplied secrets | Platform-provided service account/project; verify least-privilege IAM and `takeme-52b80` at deployment. |
| `NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_SITE_URL` | **NOT REQUIRED** in Functions | Required by Netlify web build, below; do not copy Web SDK values into server secrets without cause. |
| `PROTECTED_PAYMENTS_ENABLED` | **NOT REQUIRED**; fail-closed when absent | Keep absent or `false`; never set `true` in this release. |
| Stripe/provider credentials and webhook secrets | **FUTURE / NOT ACTIVE** | No values, provider deployment, or money action in this phase. |
| Scheduler/Pub/Sub/Eventarc, billing and service-agent IAM | **UNKNOWN** until separate read-only platform review | Must be available and approved before deploying scheduled/trigger Functions. |

Inventory notation below: `C` callable, `T` Firestore trigger, `S` schedule; `R` read-only response, `W` can write production Firestore. Every Function must be deployed before the matching web action or trigger-generating user activity; scheduled/trigger Functions can act as soon as deployed, so confirm empty/live data and maintenance window before deployment. There is no approved production rollout in this phase.

### A. Listings, auctions, offers, transactions and reputation

`index.ts` depends on Auth UID, Firestore transactions, and Storage object metadata for image publication; auction scheduling additionally depends on Scheduler. Deploy before hardened rules and web, and deploy its downstream transaction/engagement triggers before accepting user actions.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `createFixedListingDraft` | C/W | Validate and create seller-owned fixed-price draft. |
| `publishFixedListing` | C/W | Verify owned Storage images and publish draft. |
| `updateFixedListing` | C/W | Validate seller edit and derive search facets. |
| `removeFixedListing` | C/W | Seller deactivation under state checks. |
| `createAuctionListing` | C/W | Validate and create auction draft. |
| `publishAuctionListing` | C/W | Verify owned media and publish auction. |
| `updateAuctionListing` | C/W | Validate permitted auction edit. |
| `placeBid` | C/W | Transactional, owner-excluding integer-sen bid. |
| `cancelAuction` | C/W | Cancel only eligible auction. |
| `advanceAuctionLifecycle` | S/W | Start/end due auctions and select winner. |

`transactions.ts` depends on listings, offers/locks, transaction/review ledgers, participant Auth, and scheduled expiry. `onAuctionWonCreateTransaction` must be live before auctions can finalize; completion/review processing must be live before deals occur. These are authoritative state transitions, never client-writable data. No payment provider secret is used.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `getReputationPolicy` | C/R | Publish policy thresholds, not user-private trust. |
| `submitOffer` | C/W | Buyer offer with live-listing checks and lock. |
| `respondToOffer` | C/W | Seller/buyer response and one deal creation. |
| `expireOffers` | S/W | Expire due offers. |
| `onAuctionWonCreateTransaction` | T/W | Idempotent transaction from auction winner. |
| `confirmTransactionCompletion` | C/W | Independent participant confirmation and completion. |
| `requestTransactionCancellation` | C/W | Participant cancellation request. |
| `declineTransactionCancellation` | C/W | Other participant decline. |
| `disputeTransaction` | C/W | Participant dispute transition. |
| `getListingDealState` | C/R | Authorized listing deal projection. |
| `getMyTransactions` | C/R | Current participant's transaction list. |
| `getTransactionDetail` | C/R | Authorized participant detail projection. |
| `submitTransactionReview` | C/W | Completed-deal, immutable role-specific review. |
| `releaseExpiredReviews` | S/W | Release reviews after double-blind window. |
| `getPublicReviews` | C/R | Filtered public seller/buyer-appropriate reviews. |
| `reportPublicReview` | C/W | Authorized, deduplicated review report. |

`public-sellers.ts` depends on `users` and `trustSummaries`, but returns only a seller-safe projection. `protected-transactions.ts` depends on transaction/dispute state and the disabled provider stub; it must remain fail-closed and must not be interpreted as a payment launch.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `getPublicSellerSummaries` | C/R | Public seller trust projection, not buyer internals. |
| `getProtectedPaymentPolicy` | C/R | Expose disabled payment policy. |
| `getSellerPaymentOnboarding` | C/R | Disabled onboarding state projection. |
| `createProtectedPayment` | C/R | Reject payment creation while provider disabled; **no money action**. |
| `respondToProtectedDispute` | C/W | Participant dispute response in scaffolded records; no settlement. |
| `addProtectedDisputeEvidence` | C/W | Participant evidence metadata; no provider call. |

### B. Messaging and notifications

`messaging.ts` depends on listing/deal participant identity and conversations/messages; `engagement.ts` notification Functions depend on conversation, transaction, offer, bid and listing triggers. Deploy the latter before real user activity, or event-derived alerts may be missed. All callable reads are scoped to the current Auth UID; no external messaging secret is used.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `openListingConversation` | C/W | Open/dedupe conversation from listing participants. |
| `openTransactionConversation` | C/W | Open/dedupe deal conversation from participants. |
| `getConversation` | C/R | Participant conversation projection. |
| `getConversations` | C/R | Participant conversation list. |
| `getConversationMessages` | C/R | Participant message page. |
| `sendConversationMessage` | C/W | Validate sender/body and append message. |
| `markConversationSeen` | C/W | Participant seen state. |
| `onTransactionConversationCreated` | T/W | Initialize deal conversation when transaction appears. |
| `onMessageEngagementCreated` | T/W | Message notification/engagement event. |
| `getUnreadCount` | C/R | Current user's unread summary. |
| `getNotifications` | C/R | Current user's notification page. |
| `markNotificationRead` | C/W | Mark current user's single notification. |
| `openNotification` | C/W | Mark/open current user's notification. |
| `markAllNotificationsRead` | C/W | Bound mark-all operation to current user. |
| `getNotificationPreferences` | C/R | Current user's alert preferences. |
| `setNotificationPreference` | C/W | Update current user's alert preferences. |

### C. Moderation and admin

`reports.ts` validates target/context; `admin.ts` checks the `admin: true` custom claim independently for every entry point and reads private marketplace collections. Deploy after indexes are ready and before admin web use. There is no admin secret or client-grantable claim.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `submitMarketplaceReport` | C/W | Authenticated, deduplicated report with target validation. |
| `getAdminMetrics` | C/R | Claim-gated aggregate marketplace metrics. |
| `getAdminPage` | C/R | Claim-gated paginated private collection view. |
| `getAdminRecord` | C/R | Claim-gated private record/context view. |
| `updateAdminReport` | C/W | Claim-gated moderation status/notes update. |

### D. Discovery, intelligence and promotions

`intelligence.ts` and `discovery.ts` depend on listings, saved records, marketplace events, trend/interest profiles and verified discovery sessions; triggers should exist before organic signals are generated. `promotions.ts` depends on listings, promotion locks/packages and events. There is **no active promotion payment gateway**; only verified paid state could be served, and this release must not synthesize it.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `trackMarketplaceEvent` | C/W | Validate/limit a client discovery event. |
| `getMarketplaceRecommendations` | C/R | Current user's recommendation projection. |
| `onSavedListingCreated` | T/W | Derive interest from saved listing. |
| `onSavedListingDeleted` | T/W | Adjust interest after unsave. |
| `onAuctionBidCreated` | T/W | Derive bidder interest from authoritative bid. |
| `onConversationStarted` | T/W | Derive conversation interest. |
| `onConversationMessageCreated` | T/W | Derive message engagement signal. |
| `onCompletedTransactionInterest` | T/W | Derive completed-deal interest once. |
| `getMarketplaceDiscovery` | C/R | Curated discovery sections and session. |
| `getMarketplaceSimilar` | C/R | Similar-listing projection. |
| `getPromotionPackages` | C/R | Public package policy; payment unavailable. |
| `createPromotionRequest` | C/W | Seller's unpaid promotion request. |
| `cancelPromotionRequest` | C/W | Seller cancellation. |
| `getMyPromotionRequests` | C/R | Seller's own request history. |
| `getPromotionPlacements` | C/R | Eligible paid-placement projection only. |
| `getFeaturedPromotions` | C/R | Eligible featured placements only. |
| `trackPromotionEngagement` | C/W | Validated promotion impression/click event. |
| `expirePromotions` | S/W | End expired promotions and release locks. |
| `onPromotedListingUpdated` | T/W | Reconcile promotion if listing changes. |

### E–F. Engagement, alerts and scheduled jobs

The remaining `engagement.ts` Functions depend on users/saved, seller-follow records, saved-search quotas, listings, offers, bids, transactions, notification counters, price history and engagement jobs. Deploy triggers before user activity and schedules only after indexes and monitoring are ready. Scheduled jobs can write as soon as deployed. No push-notification or external delivery secret is used.

| Function | Type/effect | Purpose |
| --- | --- | --- |
| `getFollowState` | C/R | Current user's seller-follow state. |
| `setSellerFollow` | C/W | Follow/unfollow with dedupe. |
| `getFollowing` | C/R | Current user's followed sellers. |
| `saveSearch` | C/W | Validate and quota-bound saved search. |
| `deleteSavedSearch` | C/W | Remove current user's saved search. |
| `getSavedSearches` | C/R | Current user's saved searches. |
| `onSavedWatchChanged` | T/W | Maintain listing watchers/alert inputs. |
| `onListingEngagementChanged` | T/W | Price/unavailable/new-listing alert jobs and history. |
| `onBidEngagementCreated` | T/W | Outbid/auction notification jobs. |
| `onOfferEngagementCreated` | T/W | Offer notification job. |
| `onOfferEngagementUpdated` | T/W | Offer-state notification job. |
| `onTransactionEngagementCreated` | T/W | Deal notification job. |
| `onTransactionEngagementUpdated` | T/W | Completion/dispute notification job. |
| `processEngagementJobs` | S/W | Deliver bounded queued in-app notifications. |
| `queueEndingAuctionAlerts` | S/W | Queue due auction-ending alerts. |

## Netlify production environment checklist

Netlify `mytakeme` currently has **zero** variables resolved for the production context. All values below must be entered through Netlify's secret/environment UI or approved CLI in a later, separately authorized phase. Never commit them. Validate each against the registered `TAKEME Web` SDK configuration without printing values.

| Variable | Scope | Required state for web release |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public/client config | Present; registered Web App value |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public/client config | Present; registered Web App value |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public/client config | Present; exactly `takeme-52b80` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public/client config | Present; registered bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public/client config | Present; registered Web App value |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public/client config | Present; registered Web App value |
| `NEXT_PUBLIC_SITE_URL` | Public/client config | Present; `https://takeme.my`, never localhost |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Public/client switch | Explicit `false` for production; source defaults false, but set it for reviewability |
| `PROTECTED_PAYMENTS_ENABLED` | Server-only future gate | `false` or absent; provider stub remains disabled. No Stripe secret. |

`NODE_ENV=production` is provided by the production Next build; there is no application-specific `APP_ENV` variable in source. No other `process.env` reference was found in application/Functions source beyond platform variables and the fields above. The six Firebase `NEXT_PUBLIC_` settings are client-visible identifiers, **not server-only secrets**. The site must be linked/selected explicitly before any later environment write; `netlify status` currently reports this checkout unlinked.

## Phase 15B local validation and build artifact

Against this checkout, 25/25 app tests, 40/40 Functions tests, all ten default emulator suites and the separate engagement emulator suite passed. Firestore and Storage rule-denial cases are exercised within these emulator suites. TypeScript (`tsc --noEmit --incremental false`), ESLint, and the optimized Next production build passed. The repository's synced filesystem can stall toolchain startup, so the same tracked source was copied into an isolated temporary directory with existing dependencies for verification; no production project was used by emulators.

The production-like build used the registered Web App SDK fields **ephemerally in process memory**, `NEXT_PUBLIC_SITE_URL=https://takeme.my`, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`, `PROTECTED_PAYMENTS_ENABLED=false` and `NODE_ENV=production`. It succeeded without writing config values to the repository. A scan of 39 static JavaScript artifacts found the intended project ID, no `demo-takeme`, no `localhost:3000` and no `127.0.0.1:9199`; 270 server JavaScript/HTML artifacts likewise contained no demo/localhost/emulator endpoints and did contain the intended production site URL. This build was not uploaded or deployed. The provider stub remains incapable of Stripe calls.

## Auth domains, App Check and abuse decision

Production Auth currently enables email/password and authorizes only `localhost`, `takeme-52b80.firebaseapp.com`, and `takeme-52b80.web.app`. A later approved configuration change must add **both** `takeme.my` and `www.takeme.my`; retain the Firebase defaults, and evaluate whether `localhost` is still needed for developer flows. No other custom domain is currently required by source. Do not change Auth in Phase 15B.

The registered Firebase app is Web only. Native iOS/Android are future platforms and require their own Firebase app registration/provider choices. The current web source has **no App Check SDK initialization**, and callables do not request App Check enforcement. Phase 15A's read-only App Check API returned `SERVICE_DISABLED`; no enforcement configuration was enumerated. Setup plan: approve App Check API/provider and web app attestation, add client integration and emulator/debug strategy in a separate change, observe token/false-positive metrics, then separately approve staged enforcement on Functions, Firestore and Storage. Do not enforce before compatible clients exist. Rollback plan for future enforcement: retain the last known configuration and, on legitimate-client failures, revert enforcement through an approved console/API change; disabling a provider is not the same as disabling enforcement.

App Check would help each client-facing operation reject unregistered clients after integration, but it **does not replace server-side throttling**. No limit in the proposed column is implemented or approved yet.

| Operation / risk | Current protection | Proposed control and decision |
| --- | --- | --- |
| Listing creation — high, write/cost spam | Auth, owner-derived fields, payload/image checks | Per-UID/device draft and upload budget; alert on bursts. **Launch blocker.** |
| Messaging — high, harassment/cost | Participant check, body/page bounds | Per-sender/conversation burst and daily limits, abuse queue. **Launch blocker.** |
| Reports — high, moderation flooding | Auth UID, target validation, duplicate-report ID | Per-reporter/target interval and daily budget. **Launch blocker.** |
| Bids — high, auction disruption | Auth, self-bid prevention, transactional minimum/timing | Per-bidder/listing short-window throttle without rejecting legitimate last-second bids; monitor anomalies. **Launch blocker.** |
| Offers — high, repeated writes/deals | Auth roles, integer sen, locks and idempotent acceptance | Per-buyer/listing active-offer and burst limits; monitor cancellations. **Launch blocker.** |
| Auth-sensitive actions — high, account abuse | Firebase Auth provider config; no app-side signup throttle | Review Firebase Auth abuse protections, recovery and signup monitoring. **Launch blocker.** |
| Saved searches — medium | Ten/user cap, dedupe | Per-user create/update burst budget; launch decision or documented risk acceptance. |
| Follows and engagement events — medium | Auth, event allowlist/dedupe; intelligence 100/day/user | Per-user/device burst limits and anomaly alerts; launch decision or documented risk acceptance. |
| Storage uploads and promotion requests — medium/high cost | Owner path, 8 MiB/declared MIME, unpaid promotion state | Upload/request quotas and content-safety policy before broad public use; payment stays disabled. |

## Controlled release order — future, not executed

1. **Gate 1 / change review:** identify the exact Firebase and Netlify targets, saved Web App SDK config, live data/rules/indexes/Functions snapshot, billing/quota/IAM, incident owner, maintenance window, and rollback approver. Recheck zero-data assumption; obtain approval for any separate data remediation. Capture old Firestore/Storage ruleset IDs and Netlify deploy `53d4c2a…`.
2. **Gate 3:** deploy only the 37 missing composite indexes to `takeme-52b80` and wait for every index to be `READY`. Do not deploy the web while required indexes are building. Re-run query checks.
3. **Gates 4, 6–8:** configure Auth domains, approved abuse controls and App Check registration/instrumentation decisions (without premature enforcement); verify platform services. Deploy all compatible Functions while traffic is controlled; confirm each callable/trigger/schedule exists and is healthy. Functions must precede the hardened listing rules because the old web still writes listings directly. Do not activate paid/protected payment behavior.
4. **Gate 2:** deploy Firestore and Storage rules as a coordinated change only after Functions are healthy. Verify direct-write denials and intended read paths with production-safe, preapproved checks. The old web may fail listing writes between rules and web deployment; keep this interval short under maintenance/traffic control, not as steady state.
5. **Gate 5:** configure and independently review Netlify production variables. Build/review the exact intended commit with emulator mode off and `https://takeme.my` as site URL. Confirm the Netlify site and Git branch/commit, then publish the matching web release only after explicit **Gate 9** approval.
6. **Gate 10:** non-mutating health checks first (site TLS, Firebase project, configured SDK, Auth domain, Functions/index/rules inventory). Any real signup/listing/bid/message/transaction smoke test is a separate approved production-data action; none is authorized by this runbook. Monitor errors, costs, security denials, scheduled jobs, and rollback thresholds.

Post-deployment smoke-test checklist (for the later approved release, not Phase 15B):

- [ ] Confirm `takeme-52b80`, Web App ID/bucket, and all 45 indexes `READY`; compare deployed ruleset content with the reviewed local rules.
- [ ] Confirm all 87 intended Functions and expected schedules/triggers exist in `asia-southeast1`, with payment creation still fail-closed.
- [ ] Confirm Netlify site/commit, all required variable **names** present, production site URL, emulator switch `false`, valid HTTPS and both Auth domains.
- [ ] Check public homepage/discovery and a non-mutating public callable; do not read private records or create users/data without a separate approved test plan.
- [ ] Review function errors, Firestore permission denials, index errors, Auth failures, Storage errors, invocation cost and abuse telemetry against predefined rollback thresholds.

## Rollback and approval gates

| Layer | Prepared rollback; never automatic |
| --- | --- |
| Netlify | Re-publish the previously verified production deploy at `53d4c2a…` only if compatible with then-current Functions/rules. Rolling back web alone may re-enable old direct writes and fail under hardened rules. |
| Functions | Preserve the deployed artifact/version before future changes. With zero previous Functions today, there is **no previous revision to restore**; halt new traffic, disable problematic schedule/trigger or redeploy a reviewed compatible artifact under incident approval. Do not delete Functions blindly. |
| Firestore/Storage rules | Keep prior ruleset IDs and deploy a reviewed compatibility rule if needed. The present production Firestore rules are weaker, so a blind rollback to them is **not** an acceptable security recovery. |
| Indexes | Additive indexes may be left in place. Do not assume they can be rolled back instantly; deletion is a separate reviewed operation and may break existing queries. |
| Auth domains | Additive domains can usually remain during application rollback; any removal requires user-flow validation and separate authorization. |
| App Check | No enforcement now. If enforced in a later phase and legitimate traffic fails, use the approved unenforce/rollback procedure and telemetry; do not strand old clients. |

| Gate | Required evidence | Phase 15B state |
| --- | --- | --- |
| 1. Production configuration prepared | Target, IAM, variables, billing and rollback reviewed | **Open:** target known; Netlify variables, IAM/billing and rollout approval pending |
| 2. Security rules validated locally | Firestore/Storage emulator rejection and participant tests | **Local pass; production deployment prohibited** |
| 3. Indexes validated | 45 valid definitions, no duplicates; production readiness | **Local pass; 37 production indexes missing** |
| 4. Functions validated | Unit/emulator/build plus platform capability | **Local pass; 0 production Functions** |
| 5. Netlify ready | All required production variables and intended commit/site | **Open: zero variables, older live commit** |
| 6. Auth domains ready | Both `takeme.my` and `www.takeme.my` authorized | **Open: neither present** |
| 7. App Check decision approved | Instrumentation, enforcement, emulator and rollback policy | **Open: API disabled, no web integration** |
| 8. Abuse controls decision approved | High-risk throttles/monitoring or signed risk acceptance | **Open: no general throttle** |
| 9. Deployment approved | Explicit separate human approval after Gates 1–8 | **NOT GRANTED; stop before deployment** |
| 10. Smoke tests passed | Approved production-safe checks after release | **Not applicable yet** |

This runbook is preparation, not a claim that TAKEME is ready to deploy. No Firebase, Netlify, Auth, App Check, DNS, Stripe or production-data mutation occurred in Phase 15B.
