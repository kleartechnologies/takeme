# Production backend parity and proposed deployment diff

Read-only control-plane inventory refreshed 5 October 2026, 00:29 UTC, using 11 bounded GETs against the exact owner-confirmed project `takeme-52b80`. No Auth users, Firestore customer documents, Storage objects, SDK download, Function environment or log payloads were read. No resource was changed. This is the earlier inventory checkpoint. Subsequent bounded control-plane preparation and the local compatibility resolution use reviewed `2e701e2e38641380878e99242b5b573b060af7db`. See `production-rollout-compatibility.md` for the source-aligned field definitions, separated deployment groups and gated rollout; no new cloud calls were made during that resolution.

## Recalculated inventory

| Resource | Current reviewed source | Live production | Proposed change |
| --- | ---: | ---: | --- |
| Composite indexes | 49 | 48 READY, all match source | Add one deletion operation index |
| Field overrides | 12 after compatibility resolution | 3 exact matches in captured inventory | Nine additive four-mode cleanup overrides; unused historical entry removed from source |
| Functions | 101: 77 callables, 17 triggers, 7 schedules | 86 ACTIVE, GEN_2, Node22, asia-southeast1 | Five missing launch callables, four deletion callables with execution OFF, updated existing implementation; omit five payment stubs |
| Schedules | 7 | 6 ENABLED | Preserve existing jobs; deletion maintenance only under separate activation approval |
| Existing TTL groups | 4 expiresAt policies intended | 0 configured | Prepare four; add private receipt expiry separately, none activated |

Both database and intended Functions region are `asia-southeast1`; exact Storage bucket is `takeme-52b80.firebasestorage.app`, location ASIA1, owner project number verified. Email/password and Google provider metadata are enabled and apex/www Auth domains present. No real production OAuth/user mutation was performed. The initial inventory recorded 28 September rules release IDs. Subsequent bounded read-only preparation fetched rules source and established that live rules differ: Firestore lacks the new eligibility/lifecycle guards and Storage lacks permit/create-only protection. The captured legacy Storage source matches the tracked historical demo fixture. Current deployed behavior remains unqualified. Function names/state/runtime are not proof of deployed source version, IAM, environment or behavior.

## Index and field diff

The one missing composite is collection-scope `accountDeletionOperations`, fields `state ASC`, `expiresAt ASC`; maintenance queries only expired completed operations and removes their corresponding lifecycle audit records. Blocked/pending records are not expired by this query. No duplicate source composites and no unexpected live composites were found. Keep all 48 matching definitions; do not delete/recreate them.

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
| notifications | transactionId | REMOVE FROM SOURCE: actual query audit finds no current group consumer. No explicit live entry in captured metadata; do not delete any newly drifted live entry without review. |

The nine required source definitions now retain collection ASC/DESC/ARRAY_CONTAINS plus collection-group ASC. Three existing notification time overrides and all TTL configuration are unchanged. The historical transactionId entry is removed; source has 12 overrides. Refresh live inheritance/TTL before future apply and refuse removals/replacements. Deploy the missing composite and exact nine index unions separately after owner approval; do not use a missing-only Firebase index file. Any full `firebase deploy --project takeme-52b80 --only firestore:indexes` requires a freshly reviewed complete additive diff. Wait READY before cleanup. See production-rollout-compatibility.md for per-field preservation validation. No command was run.

## Missing Function classification

| Functions | Classification | Action |
| --- | --- | --- |
| getAccountSetupStatus, acceptWebPolicies, completeFirstTimeProfile, finishAccountWelcome | LAUNCH REQUIRED | Server-owned acceptance/profile/welcome and bypass protection |
| requestUploadPermits | LAUNCH REQUIRED | New exact-path server upload cadence permit |
| getAccountDeletionAvailability, getAccountDeletionStatus, requestAccountDeletion, retryAccountDeletion | DELETION-ONLY, implementation needed for launch | Deploy only with explicit execution OFF, qualify unavailable path first |
| processAccountDeletions | DELETION-ONLY | Do not deploy/enable schedule until separate activation approval |
| getProtectedPaymentPolicy, getSellerPaymentOnboarding, createProtectedPayment, respondToProtectedDispute, addProtectedDisputeEvidence | PROTECTED-PAYMENT STUB | Exclude from V1 deployment |

The five setup/upload exports can be approved as isolated inactive preparation. A later general set has 85 nonscheduled Functions: 80 existing updates plus five preparation, 68 callables and 17 triggers. It excludes four deletion endpoints, deletion maintenance, five payment stubs and every schedule. Twelve existing admin/promotion exports are conditional parity. The prior 89-export blanket selector is withdrawn; it mixed four deletion exports into the general group and ignored frontend/policy transition requirements.

The exact per-export compatibility inventory and gated order are in production-rollout-compatibility.md. Do not update all general serving Functions before actual approved policy/bootstrap/current-account acceptance readiness. Runtime must supply exact managed project/bucket and explicit deletion/payments OFF; IAM/API/cost and old/new contract preflight remain necessary. No backend credentials are embedded or deployed.

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

The detailed gated sequence in `production-rollout-compatibility.md` supersedes the previous blanket order:

1. Approve additive composite/nine mode-preserving fields, refresh metadata and wait READY; no removals or TTL activation.
2. Deploy only five inactive setup/upload preparation endpoints with deletion/payments OFF and exact runtime/IAM qualification.
3. Obtain actual legal/source approval, prepare matching final-version frontend/rules and separately create-only bootstrap the server-owned policy record.
4. Release/qualify acceptance-capable keyed-message/permit-aware frontend while legacy upload rules remain; verify old/new contracts and accepted-user/refresh readiness.
5. Under an exact bounded legacy message window and reviewed accepted-user transition, update coordinated serving subsets. Read/derived subsets may be reviewed independently. Verify four launch schedules separately; decide optional jobs separately.
6. Tighten final approved rules only after client adoption and compatible rollback verification. Old unaccepted clients and permitless uploads must fail closed; no zero-downtime write guarantee is asserted.
7. Approve TTL and deletion endpoints OFF separately; qualify and authorize execution/maintenance only after obligations, IAM, retention and operational prerequisites are satisfied.
8. Qualify exact final frontend/backend/source/rules/mirror and strict launch gate; obtain separate Worker/domain/cutover approval with Netlify rollback preserved.

No step is deployment authorization. The local phased parity plan is ready for review; live parity, operational alerts, actual final legal approval and deletion activation still gate launch. The full serving update set is not safe to deploy now.
