# TAKEME V1 account deletion (demo validation)

Policy version: `v1-2026-10-03`. The policy is the owner's approved deletion-impact map and revisions. This document describes implementation, not Privacy Policy or Terms.

## Safety boundary

New deletion callables, the worker and retention enforcement require `demo-takeme` and exactly the loopback Auth 9099, Firestore 8080 and Storage 9199 emulator hosts. No default `.firebaserc` project, production credentials, provider network calls or `.env.local` are used. This is intentionally disabled outside the verified demo environment. Production enablement needs separate review and authorisation.

## One workflow

Settings links to `/account-deletion`. The public page is readable without an account and links to existing browser sign-in. Both entry points use `requestAccountDeletion` with the authenticated server UID, a current policy version and explicit `DELETE` confirmation. `auth_time` must be within five minutes. The client always reauthenticates with its existing password or Google provider, then refreshes its ID token. Passwords/provider credentials never reach the deletion callable and are not persisted by the page.

The request transaction creates `accountLifecycles/{uid}` (`deletion_pending`) and `accountDeletionOperations/{uid}`. Lifecycle creation races transactionally with normal marketplace writes. The operation persists phase, attempts, generic blockers/failure codes and a leased worker claim. `pending`, `cleaning`, `blocked`, `failed` and `completed` are distinct. Missing resources are successful cleanup; missing Auth is successful only within an existing operation. A ten-minute lease prevents concurrent workers. Expired leases are recoverable.

`retryAccountDeletion` uses the same worker and recent-auth check. A five-minute scheduled worker resumes pending/failing/expired-lease operations. The emulator does not automatically run Cloud Scheduler; use the demo-only local runner for automatic local progress, or invoke the worker in integration tests. No new unauthenticated deletion mechanism exists.

Auth is revoked/deleted only after safe cleanup, all marketplace blockers have resolved and final cleanup succeeds. Failure after Auth deletion remains a failed operation until the worker confirms completion. A still-valid signed pre-deletion ID token can read its own completed operation status; no caller-selected UID is accepted. Operation data is never directly client-readable. Completion is not a claim that retained history, case evidence or backups/logs have already expired.

## Immediate restrictions and resolution

Firestore/Storage rules deny normal pending-account writes. Callable wrappers check current Auth existence/disabled state and lifecycle state. Critical server writes check lifecycle in the same Firestore transaction. Profile bootstrap checks lifecycle before creating a profile. Delayed intelligence, watcher, notification, review-release and promotion writers do not recreate cleaned personal data.

Pending users retain only server-authorised existing deal reads, two-party completion/cancellation/dispute actions and protected-dispute response/evidence actions. A private lifecycle alias maps the authenticated owner to their pseudonymised participant reference. The owner's safe transaction response maps their own participant back to the signed-in UID so existing resolution UI works. Other parties see an opaque reference and `Deleted user`.

Safe draft/unsold/no-bid auction content is withdrawn and erased. Auctions with existing bids preserve timing, amount/order/count, increments and winner selection. Other active bidders may continue bidding. Normal auction finalisation still creates the actual winner transaction. Live bid participation and unfinished accepted deals keep final deletion pending; cleanup never invents cancellation, completion, payment or settlement. Reports/disputes keep deletion pending until valid case resolution. Existing standard-dispute administration is incomplete: no synthetic automatic resolution is introduced.

## Deletion and retention inventory

| Category | Treatment, purpose and maximum retention |
| --- | --- |
| Auth / profile / private addresses / meet-up locations | Actual Auth deletion after final cleanup; profile/address records and all nested personal descendants recursively erased. No whole-profile retention. |
| Saved / follows / searches / notifications / preferences | Erase owned records and mirrors, incoming/outgoing relationships and quotas. Surviving follower counts decrement conditionally exactly once. Other users' unrelated preferences remain. |
| Interests / discovery / behavioural data | Erase owned profiles, sessions, attribution, quotas and events. Remove departed seller references from other actors' events. No reliance on unverified Firestore TTL. |
| Profile/listing uploads and orphan uploads | Delete owned bytes in both demo bucket variants. Pending bid-bearing auctions keep necessary live listing context until resolution; final cleanup deletes the entire owner prefix. Restricted case media is copied into a separate denied prefix only when needed. No external URL is fetched. |
| Unreferenced owned listings | Withdraw, delete images, listing descendants, watcher fan-out, trends, price history, locks and jobs. Other users' Saved pointers can display unavailable. |
| Closed transactions / accepted source offers / deal locks | Keep minimal pseudonymised status, amount, category and necessary relationship/audit information for marketplace integrity, for 12 calendar months from closure. Remove title snapshots and personal/free text. Expiry removes related source offers and deduplication/deal-lock records. |
| Auction bids / price history / listing result skeleton / transaction audit | Minimise identities and preserve truthful historical outcomes. Apply 12-month limits. Detailed departing bids expire without changing aggregate historical counts or amounts. |
| Conversations | Opaque conversation path, `Deleted user`, closed to new messages; erase departing authored bodies/media and all previews/copied listing images. Counterparty-owned messages remain only until deal closure +90 days; no-deal conversations expire within 90 days of cleanup. Retry does not extend an existing deadline. |
| Reviews | Remove public reviews about the departed account. Preserve authentic ratings/predefined tags about surviving members, erase reviewer identity/free-text comments and move UID-keyed private submissions. Published review entries receive the closed-deal history deadline; newly released deleted-reviewer entries receive a 12-month bound. Aggregate surviving reputation remains truthful and is not credited twice. |
| Reports / disputes | Isolate minimal original case prose, relevant recent/reported messages, needed listing context/media and submitted evidence in `accountDeletionEvidence`. Ordinary account access is denied. The admin report projection can retrieve scoped evidence after its existing admin gate. Open cases retain only until resolution; closed case/evidence expires closure +180 days. The original public/ordinary records are reduced. Follow-up dispute notes and seller responses go directly to the same restricted evidence store. Multiple departing participants share the case hold; retry captures source updates transactionally before redaction. |
| Security/fraud holds | No automatic risk-profile preservation. `accountDeletionSecurityHolds` must have purpose, restricted access and explicit expiry; malformed holds stop retention enforcement for classification. Valid expired holds are recursively erased. No indefinite default. |
| Deletion operation / lifecycle data | Needed for ownership, retry, pending resolution and audit; erase 30 days after successful completion. No permanent per-user marker is currently necessary because server guards also check that Auth still exists. |
| Legacy / future financial data | Inspect reserved roots and descendants for ownership. Unknown user-linked legacy schemas, unsupported payment records or provider profiles block destructive classification branches. No guessed external-provider deletion or settlement. |
| Backups / exports / logs | Outside synchronous live deletion. No immediate-erasure claim; operational retention and restoration suppression require a separate launch policy. |

Retention is enforced by explicit queries and recursive deletion; fields alone are not presented as a TTL guarantee. Restricted evidence copies have no public download tokens. Source case closure fixes the retention deadline; editing later moderation notes does not restart it. Reopening a case requires explicit review of retention state.

## Local verification

With the existing complete demo emulators running, use installed Node 22 and OpenJDK 21, without global configuration changes:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm --prefix functions run build
PATH=/opt/homebrew/opt/node@22/bin:$PATH node --experimental-strip-types tests/account-deletion-emulator.integration.mjs
```

The test suite generates credentials in memory, uses only loopback `demo-takeme`, checks actual Auth/Firestore/Storage results and cleans its own fixtures. It never exports credentials or clears the shared emulator database. Unknown-schema fixtures are deliberately preserved until test setup explicitly classifies/removes them. Fault injection is an internal test argument to the worker, never a callable input.

Local dependency repair uses locked `npm ci --ignore-scripts` in the repository and Functions directories. Cloud-only generated Next caches can be regenerated; no application logic is changed to compensate for missing dependency/cache bytes.

## Remaining launch prerequisites

Authorise/review production enablement, required rules/indexes, scheduler execution and failure monitoring separately. Publish a real HTTPS deletion URL separately. Supply Privacy Policy/Terms and backup/log retention/restoration policy separately. Resolve standard disputed deals through an approved administration/support workflow; pending accounts must not be left without a real resolution route. Future provider/billing data needs explicit classification before enabling payments. Local V1 implementation and a local commit are approved; deployment, push, publication of the deletion URL and production access remain outside this approval.

For automatic local resumption after case/deal resolution, run `PATH=/opt/homebrew/opt/node@22/bin:$PATH node tests/account-deletion-demo-worker.mjs` after compiling Functions. `--once` performs one maintenance pass. This explicitly selects demo-takeme and loopback emulators; it does not use Cloud Scheduler or open an HTTP deletion shortcut.

## Verified results (2026-10-03)

32 emulator integration checks passed, including all 20 required scenarios, cross-account isolation, restricted evidence/media and pending-case follow-ups, shared case holds, unknown legacy/financial classification, actual Auth deletion and retention expiry. The normal app suite passed 101 tests and the Functions suite passed 47 tests. Functions compilation, Next production compilation (local only), TypeScript and changed-file lint passed. Browser checks at 390×844 and 1440×900 covered public sign-in, wrong-password refusal, explicit confirmation, pending status/focus, existing mutual cancellation, worker completion, success focus/sign-out, and active Home/Explore/Profile/Messaging regression checks. Emulator-only Google credential linking/reauthentication passed; live Google OAuth was not accessed. Screenshots/logs/disposable browser credentials are outside Git.
