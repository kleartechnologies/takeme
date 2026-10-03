# TAKEME V1 account deletion (local validation and production qualification)

Policy version: `v1-2026-10-03`. The policy is the owner's approved deletion-impact map and revisions. This document describes implementation, not Privacy Policy or Terms.

## Safety boundary

Deletion callables, the worker and retention enforcement share `qualifyDeletionExecution` from `functions/src/deletion-config.ts`. The verified demo environment requires `demo-takeme` and exactly the loopback Auth 9099, Firestore 8080 and Storage 9199 emulator hosts. Missing/unknown/mixed environments fail closed. No default `.firebaserc` project or browser-supplied resource selects the deletion target.

Production execution remains disabled by default and by the unapproved final policy in the central `functions/src/release-policy.ts`. The production path now supports explicit resource qualification; that is not production activation or a live-resource connectivity/permission test. No production credentials, provider requests, `.env.local` changes or destructive production checks were used.

## Production resource qualification (inactive)

All of the following must agree before a production deletion handler can run:

- `TAKEME_RELEASE_TARGET=production` and `TAKEME_DELETION_ENVIRONMENT=production`.
- Explicit `TAKEME_ENABLE_PRODUCTION_DELETION=true`. Missing, false or any other value refuses execution; this sprint does not set it.
- `TAKEME_FIREBASE_PROJECT_ID`, the deployment's `GCLOUD_PROJECT`/`GOOGLE_CLOUD_PROJECT` identity and Admin app `projectId` must match. An alternate runtime project variable cannot override a mismatch. A demo or malformed project is rejected.
- `TAKEME_STORAGE_BUCKETS`: an explicit comma-separated list of the target project's existing default Firebase bucket names (`<project>.firebasestorage.app` and/or `<project>.appspot.com`). Admin app `storageBucket` must be in this allowlist. The code never assumes that a second production bucket exists; list only owner-verified buckets. Foreign, demo, empty and duplicate bucket entries fail closed.
- Emulator host/hub overrides must be absent. Production final Terms/Privacy publication approval and versions must pass the server-owned central policy validation; environment flags cannot approve a draft.

The SDK obtains trusted app metadata from the initialized Admin app. Qualification reads this metadata and environment only; it does not discover a project through credentials/network or initialise a second app. The actual bucket existence, access permissions, deployed rules/indexes, scheduled worker execution, failure monitoring and backup/log restoration procedures still require a separately authorised release verification. Functions remain in `asia-southeast1`; the five-minute UTC maintenance schedule uses the same resource gate as requests, retries and expiry enforcement.

Storage cleanup enumerates only the qualified buckets. Evidence URLs are parsed as supported Firebase download URLs, with an exact environment origin and owned `users/<uid>/` object prefix. Foreign hosts/buckets/owners, malformed encodings, traversal, credentials and ambiguous paths are rejected. No URL is fetched; any approved byte copy uses the Admin bucket/object API. Demo uses only its explicit loopback endpoint and both known demo bucket variants.

`getAccountDeletionAvailability` is a public, config-only callable returning `{ available, environment }`. It exposes no resource identifiers, account status or configuration error details and performs no Auth/Firestore/Storage request. The client can report temporary unavailability without mounting a destructive form. The actual owner/status/request/retry handlers independently recheck qualification; a previous availability response never authorises cleanup.

Pure synthetic configuration tests qualify resource metadata without SDK/network access or destructive execution. A synthetic final policy may be passed only to the pure test helper; runtime handlers always use the source-owned policy, which remains unapproved. Current approved retention, reauthentication, safe obligations, cleanup stages and idempotency are unchanged. Final legal review must reconcile supplier disclosure/retention obligations before any production activation; this sprint makes no new legal or retention decision.

## One workflow

Settings links to `/account-deletion`. The public page is readable without an account and links to existing browser sign-in. Both entry points use `requestAccountDeletion` with a current policy version, explicit `DELETE` confirmation and required `expectedOwnerUid` captured from the account displayed for confirmation. The server compares that value only with `request.auth.uid` before any lifecycle or cleanup work; it never selects another owner from the payload. Missing/mismatched binding fails closed with `account-changed`. The client checks its active account before and after reauthentication and refreshes its ID token. `auth_time` must be within five minutes. Passwords/provider credentials never reach the deletion callable and are not persisted by the page.

The request transaction creates `accountLifecycles/{uid}` (`deletion_pending`) and `accountDeletionOperations/{uid}` and atomically erases the private onboarding/acceptance record. Storage rules can therefore deny stale-token uploads immediately using their bounded eligibility lookup, before worker cleanup begins. No acceptance history is retained by this workflow. Lifecycle creation races transactionally with normal marketplace writes. The operation persists phase, attempts, generic blockers/failure codes and a leased worker claim. `pending`, `cleaning`, `blocked`, `failed` and `completed` are distinct. Missing resources are successful cleanup; missing Auth is successful only within an existing operation. A ten-minute lease prevents concurrent workers. Expired leases are recoverable.

`retryAccountDeletion` requires the same `expectedOwnerUid` equality binding and recent-auth check, then uses the same worker. A five-minute scheduled worker resumes pending/failing/expired-lease operations. The emulator does not automatically run Cloud Scheduler; use the demo-only local runner for automatic local progress, or invoke the worker in integration tests. No new unauthenticated deletion mechanism exists.

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
