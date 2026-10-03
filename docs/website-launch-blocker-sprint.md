# Website launch blocker sprint — local checkpoint

3 October 2026. The five audited engineering blockers are implemented locally. **Website: NO-GO** until the remaining owner/legal/publication and resource/operational qualifications below are complete. No production access, deployment, policy activation, legal publication, deletion activation, commit or push is authorised by this checkpoint.

## A. Fixes implemented

| Area | Engineering outcome |
| --- | --- |
| Policy / age enforcement | Server-owned current policy versions, timestamped Terms/Privacy acceptance and 18+ confirmation gate marketplace mutations. Callable prechecks and write transactions reject missing, stale or revoked acceptance; Firestore/Storage rules enforce the corresponding gate. Generated rule versions are checked against the central source. Harmless reads remain available; pending deletion has only the existing designated obligation-resolution exceptions. Frontend handling returns users to acceptance with their original intent and does not replay an action automatically. |
| Account deletion | Pure resource qualification supports explicit demo or future approved production context; unknown, incomplete, mixed or mismatched project/bucket context fails closed. Requests, retries, cleanup, retention and scheduled maintenance share the gate. Production also requires final central policy approval and explicit activation. Acceptance is removed atomically with the first lifecycle marker. Required `expectedOwnerUid` equality binds displayed confirmation to the authenticated owner before any cleanup, including retries. |
| Release configuration | Builds require an explicit target. Production validation rejects demo/loopback resources, emulator settings, missing/mismatched Web SDK configuration, unsafe site URLs and incomplete final policies. Artifact provenance binds output to the effective configuration and file hashes, preventing a demo build from being promoted by supplying different environment values later. |
| Following location privacy | Following uses the approved general-location projection. Unsafe legacy exact-address strings/objects are omitted; no raw location fallback is forwarded. |
| Fixture hygiene | Credential-bearing `tests/stage11-ui-fixture.mjs` is removed from tracking and ignored, along with Messaging fixtures and local artifacts. The replacement generator creates random per-user demo passwords and writes credentials only to a private, ignored mode-0600 file. Authenticated test actors use the actual demo acceptance flow. |

Low-risk extras: Help has the confirmed direct support mail link; the three shared-state-sensitive integration suites use seller-scoped browse data, count/GMV baselines and bounded job draining. The deployment inventory and expiry qualification procedure are reconciled with source. Approved screens were not redesigned.

## B. Validation

| Check | Verified result |
| --- | --- |
| Functions compile and full unit suite | **65 passed, 0 failed**, including owner binding and pure synthetic production resource tests; no SDK/network/destructive execution in those synthetic tests. |
| Final serial demo integration run | **22/22 suites exited successfully** against explicit loopback `demo-takeme`, without clearing the shared emulator database. Covers auth/onboarding, eligibility, deletion, Settings, auction, transactions/protected architecture, engagement, public seller/location, Firestore lifecycle/security, removal/metadata, intelligence, trust, promotions, profile names and admin permissions. |
| Eligibility detail | **9 checks passed**, including denial of 37 mutation entry points before acceptance, guarded-write revocation, location privacy and inactive production context. |
| Deletion detail | **32 checks passed**, including actual Auth/Firestore/Storage cleanup, pending obligations, stale-token denial, owner binding, retries/idempotency, evidence and retention, with unrelated account isolation preserved. |
| App suite and release tests | **119 passed, 0 failed**, including seven release-validation groups covering unsafe configuration, synthetic final production configuration without external access, stale configuration, artifact tampering and central rule drift. |
| Optimized build / artifact qualification | **Passed** explicit demo build and 1,361-file artifact verification. Unqualified default builds and incomplete/unapproved production qualification correctly refuse. A deployable production build remains intentionally blocked by final legal approval and explicit resource configuration. |
| TypeScript / full ESLint | **Passed.** Four duplicate generated `.next/dev/types/* 2.ts` files were removed before the final TypeScript check; no application source workaround was needed. |
| Final diff / fixture scan | **Passed.** 400 tracked/new candidate files, including 372 text files, scanned without credential-pattern findings. No generated artifacts or credential fixtures among source candidates. No CSS, brand assets or approved marketplace layout components changed. |
| Responsive/browser regressions | **Passed** at 390×844: Home, Explore, Product Detail, Auction Detail, Sell, Messaging, Updates, Saved, Profile, Settings and Auth. No horizontal page overflow; fully loaded views inspected. Existing conversation and approved actions remain present. Help support also verified at 1440×900 with the confirmed mail destination and no page overflow. |
| Acceptance return intent | **Passed in the browser** for Sell, Auction, Product/Offer (including its fragment) and Conversation. An already-open bid sheet with stale acceptance was denied by the server and routed to acceptance. After demo-only acceptance, each original route returned without automatically creating a bid, offer, message or listing; emulator counts confirmed this before the separate closure test. |
| Replacement fixture workflow | **Passed.** Private random-credential fixture generated with mode 0600. Closure checks verify eight auction states, rapid/invalid bids, duplicate-offer denial and existing draft reschedule/publish without duplicate records. |

Run outputs, screenshots, exports and credential files remain outside the committed source. This checkpoint records results without embedding those artifacts.

The local session uses Node 22.23.2 and OpenJDK 21 without changing global configuration. Auth 9099, Firestore 8080, Storage 9199, Functions 5001, Emulator UI 4000 and Next 3000 use explicit demo configuration. The local deletion maintenance substitute is restored after destructive emulator fault tests. No `.env.local` was created or changed.

## C. Production safety

The actual production policy source remains `publicationApproved: false` with null final versions. Draft acceptance is demo-only. Privacy/Terms/Contact/prohibited-items publication guards remain intact. Production deletion is default-off and cannot be enabled by environment flags while the central policy is unapproved. No production Firebase/OAuth/hosting configuration was inspected or changed. Public Firebase Web SDK identifiers are not treated as private credentials.

The [release runbook](production-deployment-runbook.md) specifies intended project selection, `https://takeme.my`, authorised domains/OAuth callbacks, same-project buckets, region `asia-southeast1`, coordinated rules/policy mirror, release commands and rollback constraints. Local/synthetic qualification does not certify real resources or access permissions.

The runbook inventories **100 deployable Functions, 49 composite indexes, 13 field overrides and seven scheduled jobs**. Its expiry/TTL section covers `marketplaceEvents.expiresAt`, `intelligenceQuotas.expiresAt`, `discoverySessions.expiresAt` and `discoveryAttributions.expiresAt`; timestamp validity alone does not physically erase records. No production TTL was enabled. Account-deletion expiry uses the explicit gated maintenance described in [account deletion](account-deletion.md).

## D. Remaining website blockers

- Final owner/legal approval and actual publication of non-draft Terms/Privacy and related required public information: applicable registration/SSM and publishable address, legal review, Bahasa Melayu privacy notice, and provider/supplier/retention disclosure reconciliation. Confirmed operator is TAKEME TECHNOLOGIES; support/privacy/legal contact is `support.takeme@gmail.com`. No missing fact is invented.
- Separate approval and qualification of the intended Firebase/hosting/Web App/OAuth resources, rules/indexes, IAM/billing, scheduler/trigger operation, failure monitoring, backup/log restoration suppression, expiry enforcement and a real dispute-resolution owner. Production activation/deployment/publication requires separate authorisation after those checks.

These are remaining release decisions and operational qualifications; the five implemented engineering fixes are not reported as unfixed.

## E. High-priority post-launch items

Auction polling/read amplification and broader App Check/rate-control hardening remain deferred, with cost/abuse monitoring required in the operational release plan. No broad realtime or abuse-control redesign was included. SEO is **MEDIUM**, deferred: robots/sitemap and unavailable-listing not-found semantics. Native store packaging, payment integration and Admin Dashboard remain outside this sprint.

## F. Website GO / NO-GO

**NO-GO.** Engineering remediation and local verification are complete; the owner/legal/publication and resource/operational prerequisites remain. Stop for owner approval. No commit, push, deploy or activation follows automatically.

## G. File / diff summary

- Backend: central release policy, account eligibility/lifecycle guards, deletion qualification/confirmation, safe Following location projection and the affected marketplace mutation entry points.
- Web: acceptance return-intent handling, shared callable error routing, deletion availability/account binding, release configuration/provenance and Help support link.
- Rules/build: Firestore/Storage eligibility gates, policy drift checks, explicit-target build and artifact qualification scripts.
- Verification/docs: meaningful eligibility/deletion/release/privacy tests, random demo fixture generation, reproducible existing suites, ignore/tracking hygiene, current deployment/TTL runbook and this checkpoint. Local credentials, fixtures, screenshots, logs, exports and generated build artifacts are excluded.
