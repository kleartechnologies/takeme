# Final legal/policy activation preparation and coordinated rollout

Preparation only, 5 October 2026, based on detached qualification checkpoint `544d47e756bc7bfcc868b40f87d3f1fbc5c7ef9b`. Nothing in this document authorizes publication, bootstrap, deployment, policy activation, TTL, deletion, schedules, payment activation or domain cutover. Main, Netlify and production have not been changed. No production API or customer-data access was performed for this preparation.

This document supersedes earlier historical null-version, unavailable-BM, current-only acceptance and incomplete Storage-emulator statements in the preparation documentation. The approved drafts now exist; final counsel approval and publication remain separate. The 49 READY composites, 12 field overrides, 91 ACTIVE Functions, six schedules, zero TTL policies, old live rules and absent/inactive runtime policy are **owner-confirmed baseline facts**, not a newly inspected live inventory. ACTIVE names do not prove deployed code/configuration parity.

## A–D. Legal state, external decisions, dates and runtime record

| Document | Owner-approved checkpoint | Intended version | Publication | Effective / last updated |
| --- | --- | --- | --- | --- |
| English Terms | `9ecf354d4b8de1d34b21653f1c8a6cf11a64f44c` | 1.0 | OFF | null / null |
| English Privacy | `0466426ba873c3942fd4c7f50e742b3b5b697213` | 1.0 | OFF | null / null |
| Bahasa Melayu Privacy | `1d7c174d42da0605eb0500480018488b15d40ff4` | 1.0 | OFF | null / null |
| Prohibited Items | `544d47e756bc7bfcc868b40f87d3f1fbc5c7ef9b` | 1.0 | OFF | null / null |

Owner-policy checkpoint: `4f9c35bee362bfec9d9df4f083410426d74c9848`. Operator: TAKEME TECHNOLOGIES; SSM KT0622373-U; support/privacy contact support.takeme@gmail.com. Business address remains unresolved; no private/home address was added. Minimum age is 18. Approved content files and `legal-publication.ts` remain byte-for-byte unchanged in this task.

External legal decisions still required: a publishable business/correspondence address or legally approved alternative; final EN Terms, EN Privacy, BM Privacy and Prohibited Items counsel approval; regulated/restricted goods; exact seller disclosures, individual/business and language obligations; marketplace-intermediary obligations; statutory-record/retention reconciliation; provider/cross-border transfer and rights wording; backup/log/legal-hold and restoration policy; breach/DPO obligations; limitation and indemnity scope. Do not infer their resolution from owner draft approval.

Draft prose itself includes unresolved legal-review and unpublished-owner-draft statements. Publication cannot be achieved truthfully by flipping flags alone. Once counsel/owner decisions exist, separately review final wording and EN/BM parity, including removal/reconciliation of obsolete draft-status statements. This task does not rewrite that content.

`planLegalLaunchDate()` accepts one exact valid calendar date in `YYYY-MM-DD`, rejects impossible/partial/whitespace/non-string input, and returns an immutable proposed effective/last-updated pair. Null input remains pending. It does not modify source or approvals. All four notices already derive their eight dates from the two central `legalPublicationReadiness` fields. After separate approval, apply that one proposed pair to the central source and review the diff; V1 last-updated defaults to launch date unless separately approved otherwise. No date, automatic scheduling or source-approval override was introduced.

Local preparation command (new absolute output directory outside Git; **no apply option**):

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prepare-policy-activation.mjs --output <new-absolute-directory-outside-Git>
```

Optional `--launch-date YYYY-MM-DD` prepares a proposal only. The current run deliberately supplied no date. Output is mode-restricted review rules and a manifest with source hashes, legal blockers, `deployable:false`, `activationApproved:false`, `written:false` and actual false/null source state. No credentials, Firebase SDK or network client is loaded.

The intended **future**, strict six-field `releasePolicies/current` document is:

```json
{
  "releaseTarget": "production",
  "projectId": "takeme-52b80",
  "publicationApproved": true,
  "termsVersion": "1.0",
  "privacyVersion": "1.0",
  "minimumAge": 18
}
```

Do not add timestamps, dates, operator details, revision fields or a scheduled effective time: runtime validation rejects extra fields. Dates and revision evidence remain in reviewed source/artifact records. The record was not read or written here; its current absence/inactivity is the owner-confirmed baseline.

Before any separately authorized bootstrap apply: complete final counsel/publication/route approval and actual launch dates; finalize truthful prose; regenerate exact source-aligned rules; qualify the compatible frontend and serving artifacts; verify exact project `takeme-52b80`, number `367115645204`, bucket `takeme-52b80.firebasestorage.app`, region `asia-southeast1`, deployed prep handler/configuration parity and absence of emulators; explicitly verify deletion and payments OFF; capture compatible frontend/Function/rules/runtime/schedule/TTL rollback baselines and monitoring; inspect only the fixed policy document for absent or exact approved state. Final legal routes must be reachable before requesting genuine acceptance. These operational preconditions are not all enforced by the bootstrap helper itself.

The existing bootstrap is create-only plus strict readback: missing → create; exact matching record → no-op; revoked, malformed, extra-field or different record → refuse. Never overwrite/merge/repair via bootstrap. A failed readback after successful create means unknown/possibly created; stop, inspect only that fixed document under authorization and reconcile before continuing.

## E–F. Rule candidates and resource parity

Actual tracked rule templates remain closed for production acceptance/mirror (`|| false`) because actual publication remains OFF. They were regenerated only to match the real source. Do not deploy them as final production rules. `renderProductionPolicyRulesPreview()` prepares the central intended 1.0/1.0/18 branch without changing source; ordinary release/rule equality checks reject those review bytes until separately approved source matches.

Review candidates retain the complete rule bodies. Firestore public categories/listings/seller projections remain readable; private address data remains owner/admin scoped; marketplace writes require active lifecycle, current Terms/Privacy/18+ evidence and trusted runtime policy; conversation/message/offer/bid operations remain callable-owned; acceptance history and private onboarding/rate/audit data remain server-owned; admin paths and default deny remain. A narrow valid profile-create exception and authorized deletion-pending deal-resolution handlers retain their existing intentional behavior; do not call this a universal prohibition on every write.

A direct parity gap was corrected in the future production branch: Firestore now requires exactly the runtime's six policy keys, pins the mirror and acceptance audience to the confirmed production project, and Storage pins that audience to the exact confirmed bucket. Demo/staging branches preserve their existing semantics. This does not activate the future branch.

Final Firestore `marketplaceEligible()` reads `releasePolicies/current`: bootstrap/readback **must precede** final rules. Storage does not read the mirror because listing upload already consumes its two cross-service document accesses (owner onboarding plus listing). It uses generated current-version acceptance and exact bucket identity instead; its rollout still depends operationally on bootstrap for acceptance/permit issuance.

Storage candidate: owner-scoped avatar/listing paths; JPEG/PNG/WebP; size >0 and <=8 MiB; path/MIME/byte-size/expiry-bound permits; active lifecycle/current acceptance; editable listing/auction state; create-only writes, no overwrite; private evidence paths default deny; owner cleanup/deletion compatible. Permits are short-lived (120 seconds), bounded batch <=8 and active permits <=128. Account deletion removes onboarding and permits in its lifecycle-marking transaction. Mirror-only revocation does not immediately invalidate all previously issued Storage permits or owner deletes.

Review outputs are outside Git. Their review-only header/manifest is not an activation approval or a substitute for regenerated final rules after final source approval. Do not pass a review output directly to Firebase deployment.

## G. Exact Function groups

Current source exports 101 Functions: 40 backward compatible (29 reads +11 derived-event handlers), 40 coordinated (34 mutation callables +6 policy-gated intelligence handlers), five preparation, six ordinary schedules, five deletion-only and five payment stubs. A–G below are dependency groupings and overlap; they are not seven disjoint deployment selectors. No Function was deployed in this preparation. Resource names alone cannot establish live code parity.

| Group | Exact treatment |
| --- | --- |
| A — safe before frontend | The 40 backward-compatible exports below plus five inactive preparation endpoints, subject to normal contract, IAM, lifecycle, configuration and code-parity preflight. Do not blindly redeploy every source export. |
| B — requires compatible frontend live/adoption | The 40 coordinated exports below; bootstrap and genuine current acceptance must also exist. `sendConversationMessage` additionally needs keyed clients or an active bounded legacy window. |
| C — requires policy bootstrap | Successful protected usage of all 40 coordinated exports and five preparation endpoints. They may fail closed when installed inactive; do not confuse successful deployment with usable functionality. |
| D — final client rules first | Zero intrinsically. Admin SDK bypasses client rules. Final rules come after bootstrap, compatible serving code and frontend/adoption verification. |
| E — schedule/optional | Four required existing schedules and two optional schedules, separately approved. Eight backward-compatible and four coordinated admin/promotion exports are optional as recorded in `production-rollout-compatibility.md`. |
| F — deletion-only | Five exports listed below; separate authorization, resource/TTL/retention qualification and activation. Execution remains OFF. |
| G — payment stubs | Five exports listed below; exclude from this rollout. Payments remain OFF. |

The five preparation endpoints are `getAccountSetupStatus`, `acceptWebPolicies`, `completeFirstTimeProfile`, `finishAccountWelcome`, `requestUploadPermits`. `acceptWebPolicies` must be refreshed/verified against the **current immutable-history implementation**, not assumed current because Phase 1 deployed a same-named earlier handler. Install these before frontend or acceptance activation; missing mirror gives `policyAvailable:false` or refuses mutations/permits.

Exact 40 coordinated serving updates:

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
onAuctionBidCreated
onCompletedTransactionInterest
onConversationMessageCreated
onConversationStarted
onSavedListingCreated
onSavedListingDeleted
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
```

Exact 40 backward-compatible exports:

```text
getAdminMetrics,getAdminPage,getAdminRecord,getAuctionViewerState
getConversation,getConversationMessages,getConversations,getFeaturedPromotions
getFollowState,getFollowing,getListingDealState,getMarketplaceDiscovery
getMarketplaceRecommendations,getMarketplaceSimilar,getMyListingHistory,getMyPromotionRequests
getMyTransactions,getNotificationPreferences,getNotifications,getPromotionPackages
getPromotionPlacements,getPublicListingDetail,getPublicListingPage,getPublicReviews
getPublicSellerSummaries,getReputationPolicy,getSavedSearches,getTransactionDetail,getUnreadCount
onAuctionWonCreateTransaction,onBidEngagementCreated,onListingEngagementChanged
onMessageEngagementCreated,onOfferEngagementCreated,onOfferEngagementUpdated
onPromotedListingUpdated,onSavedWatchChanged,onTransactionConversationCreated
onTransactionEngagementCreated,onTransactionEngagementUpdated
```

Required existing schedules: `advanceAuctionLifecycle`, `processEngagementJobs`, `expireOffers`, `releaseExpiredReviews`. Optional: `queueEndingAuctionAlerts`, `expirePromotions`. Their live delivery/configuration is not requalified here; all six remain unchanged. No new recurring job is authorized. Deletion: `getAccountDeletionAvailability`, `getAccountDeletionStatus`, `requestAccountDeletion`, `retryAccountDeletion`, `processAccountDeletions`. Payment exclusion: `getProtectedPaymentPolicy`, `getSellerPaymentOnboarding`, `createProtectedPayment`, `respondToProtectedDispute`, `addProtectedDisputeEvidence`.

Construct a future `firebase deploy --project takeme-52b80 --only functions:<approved-name>,...` selector only from the separately approved group/subset and record the exact source/artifact hash. Never deploy `--only functions` broadly for this transition. Rules and bootstrap are separate operations/approvals; a Function update does not implicitly approve them.

## H–J. Message, upload and public-browsing transitions

New clients send an idempotency key. Keyed retries use deterministic messages/private 24-hour receipts and deduplicate quota, unread, notification and engagement effects; retained deterministic message identity still prevents replay after receipt expiry. Within a single legacy invocation, the random identity is stable across Firestore retries, but distinct unkeyed HTTP retries can still duplicate. Do not claim legacy HTTP idempotency.

When separately approved, enable `TAKEME_ENABLE_LEGACY_MESSAGE_SEND=true` with `TAKEME_LEGACY_MESSAGE_SEND_UNTIL=<approved canonical UTC deadline>`. The code's exact permitted interval is `[deadline -7 days, deadline)`. Choose the deadline so first production traffic to the new handler falls within that interval; starting late shortens the available period. Only an absent key can use this path; empty/null/malformed keys are denied. Expiry is rechecked after the last async read. No deadline or production environment setting was created here. Monitor client versions and retry/adoption evidence, refresh stale clients, then explicitly disable the flag after the deadline/adoption check; no indefinite extension or premature removal.

Upload phases:

1. A: install/verify current `requestUploadPermits` and onboarding/immutable-history prep endpoints while old Storage rules remain; inactive runtime policy denies issuance.
2. Before B: approved legal routes available, exact bootstrap readback completed and genuine current acceptance possible. The existing new frontend always requests permits before uploading; it cannot be switched safely while the mirror is absent.
3. B: switch the approved frontend; new clients obtain permits while old Storage rules still permit the historical path. Verify avatar/listing bytes, positive size/type, Storage readback, image rendering, client adoption and compatible rollback.
4. C: only after verified adoption and compatible serving code, deploy final Storage rules last. Confirm permitless, expired, mismatched, cross-owner and overwrite writes deny. Stale clients must refresh; they must not retain indefinite bypass access.

Signed-out and signed-in outdated/unaccepted users keep public read-only browsing. A protected Sell/Chat/Offer/Bid/Save/Follow/upload action invokes the current-policy checkpoint; login/refresh is never consent. Explicit Terms + Privacy +18+ confirmations create genuine immutable evidence and a bounded current projection. After reacceptance, return to preserved context, requiring the user to take the action again. Never auto-send, bid, offer, save, follow or publish. One account supports buying and selling; normal onboarding/login reaches `/explore`.

## K–L. Frontend preparation artifact

The current production-identity artifact includes the implemented 1.0 legal route sources, EN/BM wiring, public-browsing migration, reacceptance/history client support, keyed messages and permit-aware uploads. It is a **preparation artifact**, not a published launch candidate. It uses approved checkpoint `544d47e756bc7bfcc868b40f87d3f1fbc5c7ef9b` plus the three local rule/generator deltas and five new preparation helper/script/test files; it is not byte-identical to the committed baseline. Compiled source publication is OFF, and runtime bootstrap alone cannot enable its acceptance UI (`account-setup.ts` uses compiled policy configuration). Production legal routes remain unavailable/404 with draft noindex metadata; local demo review routes do not authorize production publication.

Future published routes `/terms`, `/privacy`, `/privacy/bm`, `/help/prohibited-items` require separately approved final text/dates/readiness and rebuilt source. Verify truthful labels, both languages, internal links, mobile/desktop readability and metadata before indexability. Do not expose the current unresolved owner-draft prose by simply turning on flags.

A fresh isolated candidate reused existing owner-confirmed public production SDK configuration without printing or tracking values. Target: `takeme-52b80`; bucket: `takeme-52b80.firebasestorage.app`; site: `https://takeme.my`; emulators OFF; publication/deletion/payments OFF. Node 22.23.2; supported pinned Next/OpenNext/Wrangler dependencies from lockfile. `npm ci`, `npm run cloudflare:build`, `npm run cloudflare:check` passed. Installation used the existing offline package cache; build Node transports/credential discovery were blocked, with the existing cached font input. No fake SDK placeholders, production API requests or deployment were used. Native locked compiler binaries are part of the build; this is not an OS-wide sandbox.

`release:launch` and `policy:production:plan` refused as expected. Existing launch validation also requires production deletion enabled, which contradicts this preparation's required OFF state: do not bypass it or call this a launch-approved candidate. A future release-mode/activation decision needs explicit review before any launch command can pass.

Independent scan covered all 1,884 generated Worker/assets files: 52 contain inert literals, with zero active first-party forbidden resource references. Staging tester emails, Access headers/variables/issuer, `ctx.access`, staging wrapper modules and denial text are absent throughout generated output. Production entry is `.open-next/worker.js`, workers.dev/previews disabled. Shared demo/staging/preview identity and draft-policy constants remain behind compiled production proof checks; the compiled browser guard accepts real production configuration and rejects demo/staging/emulator substitutions. Loopback literals belong to inactive emulator metadata or vendor URL/OAuth sentinels, disabled test proxy and adapter local handling. These are classified inert literals, not configured first-party backend URLs. This is static/pure artifact verification, not execution of live production requests.

Forbidden runtime/provenance scanning must distinguish active endpoint/entry/config leakage from inert cross-environment safety constants, vendor emulator support, loopback examples and tests. Validate production first-party release proof, Worker/assets source hashes and final public asset bytes together; a successful Next compile alone is insufficient. Store logs/config/artifacts outside Git and never output raw SDK values or release proof.

## M–N. Gated activation order and unavoidable boundaries

The request's conceptual frontend-before-bootstrap order is unsafe for this source: permit-aware upload and acceptance need runtime policy first; an OFF build cannot accept policies after bootstrap. These dependencies change the order below. This preparation does **not** establish an unconditional zero-write-downtime rollout for every stale client. Public-read availability can be preserved. Final policy/18+ enforcement intentionally stops writes by unaccepted users and eventually stops stale permitless clients. Never weaken acceptance/rules to promise uninterrupted writes. The legal-only bridge or bounded-write-pause strategy is not yet selected and qualified; therefore this is a gated owner-review sequence, **not an execution-ready exact no-gap activation plan**. Qualifying that transition is engineering work after the owner approves the operational boundary.

| Step | Future separately approved operation / stop gate |
| --- | --- |
| 1 | Obtain final counsel decisions, address/alternative, retention/seller/provider decisions and actual launch date. |
| 2 | Finalize reviewed prose and central date/publication/readiness inputs; regenerate actual final rules; build/requalify published frontend and compatible rollback artifact. No draft-status contradiction. |
| 3 | Capture live metadata/code/runtime/rules/schedules/TTL/policy baselines and monitoring without reading customer data; verify deletion/payments OFF. Install only approved backward-compatible and five current preparation updates, including immutable-history parity. Keep old rules and serving mutation versions for adoption. |
| 4 | Ensure final approved legal routes are reachable **before** acceptance. Use a separately qualified legal-only bridge on the existing public host, or an explicitly approved bounded write pause coordinated with the switch. No such bridge was built/qualified here. Without this gate, do not claim a no-gap deployment. |
| 5 | Separately authorize exact create-only bootstrap; strict readback. Missing/mismatched/inactive policy stops rollout. Bootstrap precedes successful permit-aware frontend/guarded serving usage and final Firestore rules. |
| 6 | Switch the separately approved policy-enabled frontend, verify legal UI/three confirmations/immutable history/keyed sends/permits/return intents and monitor adoption. Old rules remain temporarily; do not claim policy enforcement already covers every historical path. |
| 7 | Update approved coordinated serving subsets only after runtime policy and compatible clients/current acceptance are verified. Activate the bounded legacy-message interval at the first new-handler traffic; do not remove support prematurely. Preserve optional/deletion/payment exclusions. |
| 8 | Deploy final Firestore rules after trusted mirror, acceptance evidence and serving behavior pass; verify public browse/private isolation/protected denials. |
| 9 | Deploy final Storage rules last after real permit/byte/adoption checks; verify uploads and overwrite/cross-user denial. |
| 10 | Run bounded production smoke plan and monitor callable/rules/upload/auth failures. Roll forward or use the verified compatible rollback. |
| 11 | Schedules/TTL and deletion activation remain separately authorized work. No blanket 101-export deployment or automatic schedule creation. |
| 12 | Qualify the production application before separate domain/canonical-www/DNS approval. Retain Netlify until a compatible rollback has been verified. |

Hazards: absent bootstrap makes prep methods/guards fail closed; OFF frontend cannot begin acceptance; frontend-first breaks permits; final Firestore-first denies eligible writes absent mirror; Storage final rules deny historical clients absent permits; old live code/rules can remain policy-independent during adoption; deployed prep names may precede immutable-history support; revoked runtime state cannot unpublish compiled pages; launch validator currently requires deletion activation. Every failed precondition stops the affected phase; technical success does not grant legal/operational approval.

## O. Rollback and revocation

| Surface | Safe response and limits |
| --- | --- |
| Frontend | Roll forward or restore a qualified artifact preserving 1.0 acceptance/history, context, keyed messages and permits. A historical Netlify artifact is not automatically compatible after final guards/rules. Keep it available, but do not route users to broken/insecure writes. |
| Functions | Restore only a reviewed artifact/config preserving eligibility and deterministic side effects. Reverting old policy-independent mutations can reopen a bypass. Narrow affected writes if a compatible rollback is unavailable. |
| Rules | Restore only a qualified safety-preserving ruleset; do not restore permissive historical rules or downgrade versions to fix a frontend issue. |
| Bootstrap | Preserve exact record/create metadata. Create-only helper cannot reactivate a revoked record, update or repair one. Unknown outcome requires inspection, not overwrite. |
| Acceptance data | Keep immutable events and current projection evidence. Never destroy history, fabricate consent, silently downgrade versions or automatically execute pending actions. |
| Policy revocation | Separately authorized fixed-document `publicationApproved:false` suspends current runtime-dependent acceptance/profile/welcome/permit operations, guarded mutations/intelligence and final Firestore eligible writes. It is not a universal kill switch. |

Mirror-only revocation does not retract public compiled legal routes/reads, stop old deployed policy-independent endpoints/rules, stop 11 derived handlers/ordinary schedules, remove the valid-profile-create exception, or stop intentionally authorized deletion-pending deal resolution. Storage does not read the mirror: an issued 120-second permit may remain usable while its other conditions hold, and owner deletes use compiled eligibility without a permit. Scope emergency suspension to affected paths/code/rules, preserve evidence and approve incident measures explicitly. Re-enable only after owner/legal incident approval, exact source/runtime/frontend/rules alignment and renewed qualification; no bootstrap overwrite or silent restoration.

## P. Future production smoke plan — not executed

Use separately approved, clearly labelled synthetic accounts/items and tiny bounded datasets. Do not load-test, copy customer data or test deletion by implication. Capture safe request/error codes and hashes, never tokens/cookies/SDK values. Record exact deployed artifacts and resource identities at each phase.

| Check | Required outcome |
| --- | --- |
| New user | Explicit Terms1.0, Privacy1.0,18+ all required; unchecked/forged/stale submissions denied; profile then welcome; Start Exploring → `/explore`; Sell secondary only. |
| Returning compliant | Login → `/explore` or explicit context; no redundant onboarding. |
| Returning outdated/unaccepted | Signed-in public browse works; protected action forces genuine reacceptance; no refresh/login consent; intended context returned without executing action. |
| Protected actions | Sell/draft/publish, Chat/send, Offer/counter/accept, Bid, Save, Follow and upload; current eligible succeeds; missing/outdated/revoked/under18/deletion_pending refuses except documented deal resolution. |
| Immutable history | Server event + bounded current projection; retry idempotent; client writes denied; a future version preserves previous events. Future-version migration belongs in emulator/source tests until separately approved, not a production-policy experiment. |
| Messaging | Concurrent keyed retry produces one message, quota/unread/notification/engagement effect; legacy interval absent-key only; post-deadline refuses legacy; ownership boundaries remain. |
| Images | Avatar/listing positive MIME/size/path permit bytes and readback; render/fallback; deny expired/mismatched/cross-owner/permitless/overwrite and private evidence. |
| Marketplace | Profile/public seller/location privacy, normal listing/detail, Save/Follow, Chat/Offer/counter/accept, auction/bid/stale-bid/winner, Updates deep links, Saved wording and Settings. No real payment/shipping guarantee. |
| Routing/layout | Signed-out/accepted/outdated deep loads, refresh/RSC navigation, EN/BM legal metadata; 390×844,430×932,1440×900; sticky controls/focus/images; no hydration or horizontal overflow. |
| Fail closed | Missing/extra-field/wrong-resource mirror handled by local tests; verify fixed approved live record readback, without injecting malformed production state. No demo/staging/preview requests. |
| Operational safety | Rules/Function failures, upload errors, quota controls, message duplicate evidence and schedule health; no new recurring jobs/TTL/deletion activation. |

Later deletion prerequisites: separately approve execution, exact bucket/project/all retention/evidence/hold resources, IAM, expiry/TTL decisions, recent-auth/idempotent cleanup/audit behavior and dedicated synthetic test approval. Policy activation does not enable deletion. TTL remains zero until separately approved; expected automatic expiry cannot be claimed before verified TTL/schedule operation.

## Q. Remaining owner/external actions

1. Obtain final counsel approval and resolve the legal items/address or approved alternative above, including EN/BM final parity and truthful publication text.
2. Supply/approve actual public launch date; approve any separately different last-updated date.
3. Approve the operational transition/adoption boundary, including any necessary legal-only bridge or bounded write pause; do not assume uninterrupted legacy writes.
4. Separately approve final publication, bootstrap and each production frontend/Function/rules activation phase after reviewing qualified artifacts and compatible rollback.
5. Approve required schedule/TTL decisions, deletion activation and later domain cutover independently; retain Netlify until compatible rollback is verified.

No engineering work is transferred to the owner by this list. Codex can finalize source/generate/build/test and execute separately authorized operations after those external inputs/approvals exist.

## Local qualification and final gates

| Local check | Result and limit |
| --- | --- |
| App tests | 350/350 passed, including 16 preparation cases. |
| Functions build/tests | 142/142 passed. |
| TypeScript / full ESLint / whitespace diff | Passed. |
| Demo integration | 34 groups passed: 12 legal/history, six browsing, seven real-byte upload transition, nine eligibility/lifecycle. |
| Future candidate rules | Both compiled; 13 further groups passed in the demo namespace with fabricated localhost-only audience claims and a local shadow bucket. Exact schema/project/bucket, policy denials, public browse, immutable history and Storage safety exercised. No real production client or resource was used. |
| Revocation boundary | Actual Storage-byte test proved a previously issued lease can survive mirror-only revocation; atomic onboarding/lifecycle cleanup denied it. |
| Lockfile/build/artifact checks | Fresh offline-cache `npm ci`, real production-identity Cloudflare build/check passed with publication/deletion/payments OFF. Launch and bootstrap refused as expected. |
| Independent provenance | 659 Next files, 1,884 OpenNext files and four artifact inputs hash-verified; compiled client identity guard and pure metadata endpoint reject mixed/demo/staging/emulator identity. |
| Protected source/main | Legal content and legal-publication source unchanged; main HEAD/status preserved. |

Focused preparation tests cover closed source, exact mirror/resource identity, invalid dates, output-only generation and rejection of review bytes by ordinary release checks. All task-owned emulators were stopped; the pre-existing Firestore process on 8080 was preserved. Emulator analytics attempted external calls but the transport preload blocked them; build transport-denial log was empty. This evidence is not live production parity or a legally approved release. Logs/config/generated review rules/build output remain outside Git. Forbidden-string classifications and final safe evidence are in the final owner report/private audit; no SDK value is displayed.

Local source changes are limited to `functions/src/release-policy.ts`, its regenerated `firestore.rules` / `storage.rules` blocks, `functions/src/legal-launch-date-plan.ts`, `scripts/prepare-policy-activation.mjs`, three preparation test files and this document. No legal content, legal readiness flags/dates, SDK config or unrelated file changed. No files are staged. Main's pre-existing review/probe changes are preserved. The qualification worktree is intentionally dirty with these nine uncommitted preparation files.

| Gate | Decision |
| --- | --- |
| Legal content | NOT READY for final legal publication; owner drafts verified. |
| Policy activation plan | NOT READY for exact no-gap execution; owner-review sequence prepared, bridge/write-transition selection and qualification outstanding. |
| Serving rollout plan | READY as dependency classification/order; deployment and live parity approval still required. |
| Final rules | NOT READY for activation; review candidates prepared, actual source remains closed. |
| Frontend release candidate | NOT READY for public launch; OFF preparation build qualifies. |
| Production activation | NO-GO. |

Changes remain local and uncommitted. No push, publication, deployment, runtime record write, production access, schedule/TTL/deletion activation, DNS/Cloudflare routing/Hostinger change or Netlify removal occurred.
