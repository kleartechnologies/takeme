# Controlled protected-write maintenance for TAKEME V1

Local preparation on approved checkpoint `8665bccc14999794e5f83f2e8f5e22847c5d387a`, 5 October 2026. The owner selected a controlled protected-write maintenance window; public browsing stays available. This source work is not permission to deploy, arm production maintenance, bootstrap or publish policies, change schedules/TTL, enable deletion/payments, change DNS/Cloudflare/Hostinger or remove Netlify. No production access or deployment is part of this qualification.

This plan supersedes the unselected bridge/write-pause choice in `final-legal-policy-activation-plan.md`: the operational strategy is now selected. It does not imply currently deployed old Functions/rules already implement it. Local enforcement and a qualified production installation are separate gates.

## A–C. Control, enforcement and UX

Trusted server-owned document: `releaseControls/current` with exactly:

```json
{
  "releaseTarget": "production",
  "projectId": "takeme-52b80",
  "protectedWritesPaused": false
}
```

Normal state is false; activation-window state is true. No source flag enables maintenance by default. A missing document in a valid pinned context is explicitly OFF for compatibility; this is not a claim that missing configuration fails closed. A present malformed record, extra/missing key, wrong target/project, invalid runtime context, read failure or non-boolean state pauses protected operations safely. Only exact demo/staging/production resources are recognized. Client reads/list/writes of the control are denied; the public read-only `getProtectedWriteStatus` callable returns only `{protectedWritesPaused:boolean}`. The status endpoint is pinned to `asia-southeast1`. No credentials, identity or raw control fields are returned.

Authenticated protected mutation wrappers check control before policy/lifecycle/arguments, including designated deletion-pending deal-resolution actions. The first read in each protected guarded transaction checks it again: enable races invalidate the write transaction. No cache, automatic record creation, expiry, auto-reopen or action queue exists. When OFF, normal authorization/lifecycle/current acceptance rules still apply. A pause is not acceptance, consent, policy revocation or an account restriction. Unauthenticated server requests retain authentication rejection without reading private state.

Refusal is `failed-precondition`, details `{reason:"protected-writes-paused"}`, with exactly:

> TAKEME is completing a short system update. Browsing is still available, but this action is temporarily unavailable. Please try again shortly.

Fresh frontend checks occur before explicit protected intent/auth routing and before protected service writes. The backend remains authoritative; the UI is not the enforcement boundary. A racing direct-rule denial rechecks status, identifies maintenance and avoids an account-policy redirect. Malformed/unavailable status safely refuses the attempted action. Typed errors retain safe context through listing/auction/upload wrappers. Save's existing-document fallback cannot swallow the refusal.

A dismissible nonmodal notice uses existing green TAKEME styling and provides Continue browsing without navigation or logout. Existing forms/sheets retain entered data and show the same safe inline error. No focus stealing, stored operation, retry timer, polling-for-reopen, deferred callback or replay exists. Users must attempt and confirm again after maintenance ends. Existing message/offer reads remain intact; automatic mark-seen/tracking refusals do not repeatedly announce or redirect, and a maintenance rejection of mark-seen does not turn loaded conversation history into a failed read. Signed-out Save/Report void handlers also catch the rejection.

## D–E. Exact scope and public exceptions

102 current source exports are exhaustively classified by an AST test. The 38 protected callables comprise 35 V1 mutation endpoints plus three excluded payment-stub mutation endpoints. The 35 browsing/setup reads are API-role exemptions, not a claim of zero database side effects: discovery/recommendation reads can create bounded discovery sessions, and setup status can initialize the demo-only policy mirror. They do not perform the protected user action. Derived processing of previously committed events remains available.

### MUST CHECK MAINTENANCE — 38

```text
cancelAuction
cancelPromotionRequest
confirmTransactionCompletion
createAuctionListing
createFixedListingDraft
createPromotionRequest
declineTransactionCancellation
deleteSavedSearch
disputeTransaction
markAllNotificationsRead
markConversationSeen
markNotificationRead
openListingConversation
openNotification
openTransactionConversation
placeBid
publishAuctionListing
publishFixedListing
removeFixedListing
reportPublicReview
requestTransactionCancellation
respondToOffer
saveSearch
sendConversationMessage
setNotificationPreference
setSellerFollow
submitMarketplaceReport
submitOffer
submitTransactionReview
trackMarketplaceEvent
trackPromotionEngagement
updateAdminReport
updateAuctionListing
updateFixedListing
requestUploadPermits
createProtectedPayment
respondToProtectedDispute
addProtectedDisputeEvidence
```

### BROWSING / STATUS / READ EXEMPT — 35

```text
getAdminMetrics
getAdminPage
getAdminRecord
getAuctionViewerState
getConversation
getConversationMessages
getConversations
getFeaturedPromotions
getFollowState
getFollowing
getListingDealState
getMarketplaceDiscovery
getMarketplaceRecommendations
getMarketplaceSimilar
getMyListingHistory
getMyPromotionRequests
getMyTransactions
getNotificationPreferences
getNotifications
getPromotionPackages
getPromotionPlacements
getPublicListingDetail
getPublicListingPage
getPublicReviews
getPublicSellerSummaries
getReputationPolicy
getSavedSearches
getTransactionDetail
getUnreadCount
getAccountSetupStatus
getAccountDeletionAvailability
getAccountDeletionStatus
getProtectedPaymentPolicy
getSellerPaymentOnboarding
getProtectedWriteStatus
```

### SPECIAL SETUP / DELETION WRITE EXEMPT — 5

```text
acceptWebPolicies
completeFirstTimeProfile
finishAccountWelcome
requestAccountDeletion
retryAccountDeletion
```

### DERIVED EVENT EXEMPT — 17

```text
onSavedListingCreated
onSavedListingDeleted
onAuctionBidCreated
onConversationStarted
onConversationMessageCreated
onCompletedTransactionInterest
onAuctionWonCreateTransaction
onBidEngagementCreated
onListingEngagementChanged
onMessageEngagementCreated
onOfferEngagementCreated
onOfferEngagementUpdated
onPromotedListingUpdated
onSavedWatchChanged
onTransactionConversationCreated
onTransactionEngagementCreated
onTransactionEngagementUpdated
```

### SCHEDULED EXEMPT OR SEPARATE — 7

```text
advanceAuctionLifecycle
processEngagementJobs
expireOffers
releaseExpiredReviews
queueEndingAuctionAlerts
expirePromotions
processAccountDeletions
```

The three onboarding writes (`acceptWebPolicies`, `completeFirstTimeProfile`, `finishAccountWelcome`) remain available under their genuine acceptance/history/lifecycle checks so rollout verification is possible while protected writes are paused. The narrow safe initial-profile-create bootstrap remains permitted for email/Google sign-in; ordinary profile edits, avatar uploads and marketplace writes pause. `requestAccountDeletion`/`retryAccountDeletion` retain their independent recent-auth and execution gates; deletion execution stays OFF. Payment stubs remain excluded from deployment. Derived callbacks and existing schedules are not authorizations to create new customer marketplace actions.

Public Explore/Home/discovery/listing views, seller projections, legal/help/contact and `/account-deletion` information are unaffected. Sign-in/out are not maintenance-gated. Terms/EN/BM Privacy/Prohibited Items production publication remains separately OFF: maintenance cannot make those unpublished routes public. Read-only signed-in users can keep browsing existing messages/offers/Saved/history according to existing permissions.

## F–H. Auctions, uploads and client rules

New bids are rejected. The one-minute auction lifecycle scheduler continues with original start/end times. The current highest valid bid wins at the original end time; winner/transaction materialization remains idempotent. No bids are admitted late after ending, no automatic extensions, no highest-bid reset and no offer/message/history deletion occur. Offer expiry, review release, existing engagement notifications and promotion lifecycle retain existing behavior. Existing deal-resolution writes also pause, so operational deadlines/complaints need monitoring during a window.

Direct protected Firestore writes exist: Saved create/delete, profile updates, meet-up/private-address CRUD and eligible admin profile/listing/category/promotion-package writes. The final rule body therefore checks strict maintenance state before policy/acceptance reads. Client writes to control, private acceptance/history and callable-owned conversations/offers/bids remain denied. Public read logic and safe bootstrap profile-create are unchanged. Each protected write uses the control read within rule evaluation; it cannot rely on the frontend.

Storage final listing uploads already use their two cross-service documents: owner onboarding/permit projection and listing. A third global-control lookup would break that budget. New upload permits pause immediately in Functions. Existing valid permits may still allow creates for up to their 120-second expiry; they remain exact path/MIME/size/owner-bound and cannot overwrite. Wait for lease drain and verify denials before asserting that new uploads are stopped. Eligible owner cleanup/deletes are not permit-bound and remain a documented exception; this mode does not claim every Storage write is blocked.

The 120-second claim applies only to **final reviewed permit-based Storage rules**. Old production Storage rules do not require permits and can allow stale-client uploads indefinitely. Before the activation window, qualify/install an explicit temporary create/update freeze over the captured historical Storage rules, preserving public reads and owner cleanup/delete. No full-site outage or broad new read permission is needed. Only after final permit rules are in place and leases drained may the final-mode bounded behavior be relied on.

## I. Narrow owner/operator procedure — do not execute now

`control-production-maintenance.mjs` is not a callable or dashboard. It pins project/bucket/runtime, refuses emulators/mixed resources, requires deletion/payments explicitly OFF, allows only exact enable/disable operations and writes only the three-field fixed control. A dry-run loads no Admin SDK or credentials. Deletion/payments OFF checks are local operator-environment checks; separately verify the deployed runtime is OFF during future authorized preflight. The operator does not inspect or disable live deletion/payment configuration. Existing state requires exact expected on/off value and Firestore update-time token (`seconds.nanoseconds`, nine fractional digits). Absence is permitted only for enable/create; disable never deletes or creates an absent normal-state document. Transaction compare-and-set refuses malformed/changed state, has no merge/repair fallback and verifies post-commit readback. A failed/changed readback is an unknown outcome: stop, inspect, do not retry blindly.

Use the existing reviewed local operator environment, not `.firebaserc` defaults or a newly tracked credential/config file. Required environment is exact production project/runtime and bucket with `TAKEME_RELEASE_TARGET=production`, `TAKEME_FIREBASE_PROJECT_ID=takeme-52b80`, `TAKEME_STORAGE_BUCKETS=takeme-52b80.firebasestorage.app`, `TAKEME_ENABLE_PRODUCTION_DELETION=false`, `PROTECTED_PAYMENTS_ENABLED=false`, no emulator variables, and no conflicting staging/resource settings. Existing operator IAM/credentials must be separately authorized; never embed or print them.

Plan initial enable without any remote access:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/control-production-maintenance.mjs --plan --action enable --expected-state absent --project takeme-52b80
```

Future separately approved initial enable adds `--apply` instead of `--plan` and `--owner-approved-maintenance` at the end. Existing record uses `--expected-state off` or `on`, followed by `--expected-update-time <exact-observed-token>` before `--project`. No command was applied here.

Future reopen:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/control-production-maintenance.mjs --apply --action disable --expected-state on --expected-update-time <exact-observed-token> --project takeme-52b80 --owner-approved-reopen
```

Reopen additionally requires actual separately approved legal/source dates/publication, source-aligned rules, and exact active six-field runtime policy read **in the same transaction**. Current false/null source refuses reopen before SDK loading. This does not check deployed code/rules/frontend parity for the operator: those remain mandatory runbook gates. The safe receipt records only source, resource, verified state, server update-time token and local verification time; preserve it and existing platform audit evidence privately outside Git. No personal operator data is added to the control.

## J. Activation sequence and installation prerequisite

**Do not equate arming a document with pausing current production.** Owner-confirmed old serving Functions/rules do not read it. Client-rule overlay does not block Admin SDK mutations in old Functions. The full current guarded source cannot simply be installed with maintenance OFF before bootstrap: its existing policy checks reject unaccepted old clients. A maintenance-only compatible serving artifact must be tied to the actual deployed handler contracts and qualified before claiming the enable step is effective. If that verified old-handler artifact is unavailable, stop production use; do not invent parity or skip policy checks in current source.

`scripts/prepare-maintenance-rule-bridge.mjs` generates output-only review candidates from previously read-only captured historical rule bytes, pinned by SHA-256. It transforms exactly 12 permissive Firestore write clauses, preserves the one validated initial-profile-create exception, guards whole expressions including admin OR branches, and freezes exactly two Storage create/update clauses. Historical OFF write contracts and public reads are preserved. No policy acceptance requirement is silently added to the historical bridge.

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/prepare-maintenance-rule-bridge.mjs --firestore-input <reviewed-absolute-capture> --storage-input <reviewed-absolute-capture> --output <new-private-directory-outside-Git>
```

The CLI rejects other capture bytes, existing output paths, Git-contained output and apply/override arguments; output is private and marked deployment-unapproved. These snapshots are not fresh deployed-rule proof; future authorized preflight must confirm they still match, otherwise recapture/review and revise the pins. The temporary Storage freeze is intentionally separate from normal final rules and does not lift merely by switching control OFF. No fixture may substitute for the captured baseline, and no generated candidate is committed or deployed here.

Future gated sequence:

1. Before the window: complete counsel/publication/date decisions; build all final frontend/Function/rule artifacts and secure compatible rollback; verify production healthy, identity/configuration and live code/rule capture parity. Measure an equivalent staging rehearsal. Owner approves the bounded window and reopening criteria; no incident or near auction boundary.
2. Install/qualify maintenance-only serving enforcement and read-only status UX over verified old contracts, plus a maintenance-only Firestore overlay. Preserve normal OFF semantics and public reads. Do not silently enable final policy checks as part of that preparation. This compatibility prerequisite is not satisfied merely by this local final-source implementation.
3. Arm control ON with guarded operator enable. Apply the approved temporary Storage create/update freeze, drain already admitted Function requests using actual configured deadlines and verify all protected callable/direct write paths reject. Until these checks pass, the pause is not established. Keep public browse/auth/history available.
4. Confirm public browsing and safe maintenance copy; capture the effective pause start after enforcement/drain. Do not progress if any write bypass remains.
5. Publish the separately approved final legal-only routes/source or deploy the approved policy-aware frontend while writes stay paused. Onboarding endpoints are maintenance-exempt, but genuine acceptance must wait for the trusted active policy and current preparation endpoints in step 6. No marketplace action executes. New frontend can show maintenance before upload intent even before bootstrap.
6. Create/read back exact `releasePolicies/current`, using the separate approved bootstrap. Refresh the five current prep endpoints, including immutable-history-capable acceptance, before real acceptance testing.
7. Deploy the compatible final frontend and approved coordinated serving subsets. Because maintenance wins first, policy-dependent writes remain paused throughout. Verify runtime/source/resource identity and genuine acceptance/setup flows.
8. Deploy final Firestore rules, then final Storage permit rules. Preserve control ON. Wait at least remaining maximum lease lifetime and verify no new permit issuance; the historical freeze must not be removed into historical permitless write rules.
9. While paused: validate public browsing/legal/auth, acceptance/history/return intent, maintenance rejection, scheduler/auction invariants and image rendering; do not expect ordinary protected upload/publish smoke to succeed. Validate positive write/upload behavior in rehearsal, not by bypassing production maintenance.
10. Owner verifies code/rules/bootstrap/frontend parity, acceptance flow, monitoring and secure rollback. Reopen via separately approved guarded disable. If any gate fails, keep the pause.
11. After explicit reopen, perform bounded synthetic protected-write/upload smoke, current/outdated/deletion-pending authorization checks and watch errors/costs. No automatic replay. Stop/re-enable maintenance with a fresh CAS token if regressions appear.
12. Schedules/TTL/deletion and domain cutover remain separately approved. Do not attach domains, change DNS or remove Netlify during policy activation preparation.

This adjusts the requested order: maintenance prerequisites precede effective enable; paused positive upload tests occur only after explicit reopen, with their positive behavior already proven in staging/emulators. No production smoke runs now.

## K–L. Abort, duration and auction fairness

If any phase fails, leave public browsing available and keep protected writes paused. Record the exact phase/artifacts/control/bootstrap state; no partial reopen. Roll forward or restore a compatible secure artifact/ruleset that still understands acceptance/history/keyed messages/permits/control. Do not erase evidence, downgrade policy versions, restore insecure rules or reactivate via bootstrap overwrite. Historical Netlify availability is not proof of a compatible write rollback. If final policy source/runtime is still inactive, the current reopen script refuses; keep the pause and obtain a reviewed recovery, not an approval bypass.

Prebuild everything and avoid dependency installation/builds inside the pause. Technical window duration is the measured serving/rule/Worker deployment plus cold-start/readback/lease-drain/smoke time, with measured rollback reserve. No equivalent live rehearsal timing is available yet, so an exact duration/maximum/N cannot be honestly promised. Proposed operator planning target: a 30-minute effective pause, **only if rehearsal proves it feasible**; this is not public UI copy or an automatic timer. A separately proposed conservative auction precheck horizon is 60 minutes, but must be increased to cover measured worst-case deployment+rollback+margin, or replaced by waiting for no active/scheduled auction. Neither number is a source setting, owner-approved SLA or clock extension.

Prefer the first activation when no auction is active and none starts during the full planned/rollback interval. Otherwise check original end/start boundaries using the justified measured horizon. Paused late bidders cannot place bids; an ending auction uses the current highest bidder and continues original timers, a real fairness risk. An overrun can cross boundaries even after precheck. Do not silently extend/reopen auctions; seek owner decisions for affected seller/buyer cases while preserving history. Deal/offer expiry may also continue, requiring monitoring.

Precheck must include: no near end/start boundaries; no existing incident; rollback baselines captured; final legal approval/date/source/artifact ready; exact guarded legacy serving/rule bridge verified; current prep/history endpoints ready; bootstrap ready; final rules ready; monitoring/receipts prepared; owner available to approve reopen. If these are unknown, do not start the window.

## M–O. Qualification, files and remaining gates

All testing is local, demo-only or pure/mock. No production Firebase user/object reads or API modifications occur. Preserve the pre-existing Firestore8080 process. Private credential fixtures, emulator data, browser harness/screenshots/logs and generated rule outputs stay outside Git.

Local qualification:

- Full app suite: 376 tests pass; full Functions suite: 154 tests pass, including 12 maintenance tests. App/Functions TypeScript, ESLint and diff checks pass. Eight bridge tests include local historical-capture checks; two explicitly skip when the private reviewed captures are unavailable, rather than inventing fixtures or committing captures.
- 69 distinct emulator integration groups pass: maintenance 10, legal/policy 12, public browsing 6, rollout compatibility 7, eligibility 9, future final-rule preview 16, historical rules bridge 9. Runs use an isolated `demo-takeme` project and loopback ports, private synthetic users and real-byte Storage tests. Future-production rule cases use synthetic claims/local shadow resources only; no production SDK/resource access. Firebase CLI analytics transport attempts were blocked by the local network guard; no production Firebase transport was attempted.
- Guarded transaction enable races, policy/lifecycle precedence, all 102 export classifications, direct Firestore writes, retained messages/offers/history, no replay, permits/expiry/cleanup and original auction clocks are covered. Historical-rule compilation and ON/OFF behavior are proven locally; this is not live baseline parity proof.

Responsive checks pass at 390×844, 430×932, 768×1024 and 1440×900 using the actual maintenance notice, central protected-action wrapper and ActionSheet inside a private synthetic form fixture. No horizontal overflow; draft/message/offer/bid/report context remains; Close is reachable; outside focus returns into the modal and Shift-Tab wraps. Continue browsing dismisses only, without navigation. Changing ON to OFF leaves the synthetic success count at zero until a fresh manual attempt increments it. This proves UI retry behavior, not a new marketplace transaction.

The actual public `/explore` route with empty demo inventory renders under ON at all four sizes without maintenance feedback or overflow. Actual `/login` renders under ON at desktop with email/password/Google controls. Real browser sign-in was not repeated; authentication continuity is covered by source review and authenticated emulator sessions. Chrome's injected `data-scribe-recorder-ready` HTML attribute causes a development hydration warning; no application-origin mismatch was found. Extension message-channel errors/private Fast Refresh reloads are not presented as clean remote-browser qualification. No remote staging or production UI qualification is claimed.

Task-owned isolated emulator and QA services were stopped and synthetic control restored absent. Existing Firestore8080 PID53968 and Next3000 PID8550 are preserved. No emulator exports were created.

Remaining production-use risks: actual old-handler guard compatibility/deployed parity; stale-client upload behavior until the verified freeze; admitted request drain; 120-second final-rule leases and owner cleanup deletes; auction/offer/deal deadlines; unmeasured deployment/rollback budget; final counsel/date/publication inputs; no production qualification yet. Missing trusted control intentionally means OFF, so operator deletion must never be used as a disable/repair mechanism. Public browse/status availability may have bounded server discovery side effects, not customer marketplace action replay.

The mode is ready only when local suites/UX pass; production activation remains separately blocked until all live installation/legal/timing/reopen gates are proven. No commit, push or deployment is authorized by this document.

## Changed-file inventory

### Backend

- `functions/src/account-lifecycle.ts`
- `functions/src/index.ts`
- `functions/src/production-maintenance-control.ts`
- `functions/src/protected-write-maintenance-runtime.ts`
- `functions/src/protected-write-maintenance.ts`

### Rule inputs

- `firestore.rules`
- `storage.rules`

### Operator/review scripts

- `scripts/control-production-maintenance.mjs`
- `scripts/prepare-maintenance-rule-bridge.mjs`

### Frontend components

- `src/components/auth/auth-provider.tsx`
- `src/components/layout/protected-write-notice.module.css`
- `src/components/layout/protected-write-notice.tsx`
- `src/components/messages/conversation-view.tsx`
- `src/components/saved/save-button.tsx`
- `src/components/trust/report-action.tsx`
- `src/components/ui/action-sheet.tsx`

### Frontend services/helpers

- `src/lib/listing-image-upload.ts`
- `src/lib/protected-write-maintenance.ts`
- `src/lib/services/auctions.ts`
- `src/lib/services/conversations.ts`
- `src/lib/services/fixed-listings.ts`
- `src/lib/services/intelligence.ts`
- `src/lib/services/marketplace-call.ts`
- `src/lib/services/protected-write-status.ts`
- `src/lib/services/saved.ts`

### Tests

- `functions/test/protected-write-maintenance.test.cjs`
- `tests/listing-image-upload.test.mts`
- `tests/maintenance-rule-bridge.test.mts`
- `tests/production-maintenance-control.test.mts`
- `tests/protected-marketplace-actions.test.mts`
- `tests/protected-write-maintenance-emulator.integration.mjs`
- `tests/protected-write-maintenance-ui.test.mts`

### Documentation

- `docs/final-legal-policy-activation-plan.md`
- `docs/protected-write-maintenance.md`

Approved Terms, EN/BM Privacy, Prohibited Items and legal-publication source bytes are unchanged. Qualification HEAD and main HEAD/pre-existing dirty state are unchanged. Nothing is staged. Pattern/path checks found no live SDK values, private keys or prohibited artifacts in the changed files; private fixtures/logs/generated review rules/screenshots remain outside Git.

## Readiness gates

| Gate | Local result / remaining prerequisite |
| --- | --- |
| Protected-write maintenance candidate | Local source/tests and four-size maintenance UX checks pass; no live installation claimed. |
| Public browsing during maintenance | Emulator public listing/seller/history reads pass; local browser scope stated in the final QA record. Legal route publication remains separately blocked. |
| Activation runbook | Prepared for review; not executable-ready until historical serving-contract guard parity, current rule capture parity and measured rehearsal/rollback are qualified. |
| Production activation | Not safe to use yet. Final counsel/date/publication, owner window/reopen approval and live installation/monitoring gates remain required. |

No commit, push, deployment, production control/policy writes or cloud configuration changes were performed.
