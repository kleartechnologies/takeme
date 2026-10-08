# Approved synthetic-fixture Admin cleanup

`cleanupApprovedSyntheticFixture` is an operational callable for one positively verified production fixture. It is not a moderation API and has no consumer or generic Admin deletion UI.

## Reviewed identity

- Project/bucket: `takeme-52b80` / `takeme-52b80.firebasestorage.app`.
- Listing: `6dV9mQnbYPa51UKXOTOu` — TAKEME Stage 7 Test Green Mug.
- Owner: `0sUaiRO39dMeeANdhZ2aMc9IB4L2`.
- Fixed-price, active before cleanup; created `2026-09-30T07:59:22.229Z`.
- Exact title, complete synthetic description, owner, creation timestamp, listing type and single media path are server-bound. The image generation, size and MIME are also bound.
- The only accepted request is `{ "listingId": "6dV9mQnbYPa51UKXOTOu" }`. Extra fields and all other IDs are denied. Adding an ID requires a separate source review/deployment.

## Authority and safety

Reuse `verifyAdminIdentity`: verified Firebase ID token, `checkRevoked=true`, matching transport UID, unexpired token, current non-disabled Auth user and current `admin === true` claim. Recheck authority at transaction boundaries and before media deletion. A pending Admin account lifecycle denies the operation. Email alone is never authority.

The fixture owner does not participate. No consent is created or fabricated, no Auth account/configuration is changed, and ordinary marketplace removal eligibility remains intact. The runtime rejects non-production project/bucket/pins and emulator configuration. This cleanup does not change maintenance, auction controls, policies or rules.

## Operation and retry model

1. Authenticate Admin; validate the exact request and runtime identity.
2. Inspect the exact media prefix before any withdrawal. Unknown objects or changed generation/size/MIME abort without deletion.
3. In one Firestore transaction reverify Admin and listing identity, inspect bounded fixture-linked offer/transaction/conversation/review/report/bid/watcher/notification metadata, and withdraw public visibility by setting only `status=removed` and `updatedAt`.
4. Create one deterministic `adminAuditEvents/synthetic-fixture-cleanup-6dV9mQnbYPa51UKXOTOu` event with action `synthetic_fixture_cleanup`, resourceType `listing`, exact resource ID, Admin UID, timestamp and bounded reason/completion flags. No message bodies, tokens, cookies or account-private data.
5. Reverify Admin; delete only the approved image with its generation precondition. Verify the prefix is empty.
6. Recheck identity and mark the existing audit event's media completion flag. Never duplicate the event on retry.

Historical relationships are always preserved, including synthetic-only history. Real/unknown counterparties can never enter a destructive history branch. The Green Mug has an expired offer and a conversation involving an unconfirmed counterparty, so those records and related notifications/events are retained. No Saved/watchers/followers were found in the audited scope. Existing availability filtering removes withdrawn records from public discovery/storefronts; existing editorial lifecycle invalidation remains responsible for published references.

An image failure can leave visibility withdrawn and `mediaComplete=false`; retry the same operation after review. Changed media or a reactivated listing with an existing cleanup audit fails closed. Account deletion, audit erasure, transaction cleanup and historical launch media are outside this action.

## Scoped rollout

Qualify Functions tests, focused negative/identity/media/retry/history tests and app regression tests. Deploy only `cleanupApprovedSyntheticFixture` in `asia-southeast1`, Node 22, with the reviewed production project/bucket pins and OFF feature flags, using the existing Admin service identity. Preserve the existing 106 Functions, rules, controls, Auth, DNS and consumer frontend version. The necessary Admin-only control is described below. Record source hashes, new ACTIVE revision, configuration/IAM and readback privately outside Git.

Execute from reviewed bounded tooling with a current approved Admin identity. Verify live denial for signed-out/normal-user requests, and qualify arbitrary-ID denial in focused server tests before the positive operation. Verify the successful result and one audit event; retry once to prove no duplication. Capture exact-prefix zero-object readback and unchanged retained references.

Check Home/Fresh Finds, Explore, exact-title search, seller storefront, unavailable Product URL and Admin active listings. Scope the clean-feed claim to the reviewed known public fixtures. Keep all six additional review candidates and retained historical launch fixtures untouched. Monitor aggregate errors; never manufacture an outage.

Rollback disables/deletes only this new operational Function if required. Do not reactivate a withdrawn fixture or restore deleted test media automatically. Production receipt/revision and monitoring evidence remain outside Git.

## Minimal internal execution control

Existing IAM credentials could not mint an Admin sign-in token. Chrome's Console paste protection requires owner takeover, so execution uses the narrowly permitted internal Admin page at `/operations/synthetic-fixture-cleanup` instead. It inherits the existing server session and client Admin gates, has no navigation/menu entry or arbitrary-ID field, requires explicit fixture confirmation, and calls only this fixed operation. It never executes on page load. A concurrent submission lock prevents double-clicks; retry is explicit and the server remains idempotent. Incomplete results display an error requiring state review.

The necessary Admin-only frontend patch preserves existing Firebase configuration, session security, Worker bindings/observability/domain settings and all consumer frontend bytes. No DNS or Auth changes are needed. Rollback retains the previous Admin Worker version. Console security protection remains enabled; it is not bypassed.

## Completed production qualification — 2026-10-08

- New callable revision: `cleanupapprovedsyntheticfixture-00001-qag`, ACTIVE. All 106 previously deployed Functions remain unchanged; total ACTIVE count is 107. The deployed managed source matches the qualified package.
- Necessary Admin-only execution page deployed to `takeme-admin` version `d149740f-ac1c-43b2-a7b3-278672fdf54f`; rollback version `53aeb6d4-7f92-4106-9ea7-2c205dc433ba` retained. Consumer Worker version `22100b4e-2684-4e70-85f5-f87d02442abf` is unchanged. Bindings, runtime, logging/query redaction, domain and preview settings are preserved.
- Signed-out and ordinary synthetic-user live callable requests return `PERMISSION_DENIED`. The internal page redirects signed-out access to login. Focused server tests deny arbitrary IDs, revoked/removed Admin authority and changed fixture identity.
- Approved current Admin executed the operation and one explicit retry. Green Mug status is `removed`; its exact image prefix contains zero objects. Exactly one bounded cleanup audit exists, with `mediaComplete=true`. The retry reports already clean.
- All 104 captured historical-reference metadata records remain unchanged, including the expired offer and shared conversation. Six additional review candidates and four retained historical launch listings remain unchanged. The earlier Sell V1.1 fixture remains withdrawn. Stage 7 Auth account is retained.
- Home/Fresh Finds, Explore and exact-title search exclude Green Mug; the seller storefront shows zero active listings/auctions; direct Product shows unavailable behavior; exact-ID Admin lookup shows removed.
- Qualification: 541 app tests PASS with two existing skips; 219 Functions tests PASS; local Firestore concurrent-retry integration PASS; 20 focused Admin/control/security checks PASS. TypeScript, ESLint, Next/OpenNext build, Wrangler dry run, credential scan and diff checks PASS. No dependencies, consumer source, legal content, rules, Auth/DNS or activation controls changed.
- Bounded aggregate monitoring: zero Worker invocation errors for both consumer and Admin, zero Cloud Run 5xx, successful Firestore/Storage operations and healthy public routes. Normal denied-auth checks are expected. Private receipts, screenshots, logs and deployment archives remain outside Git.
