# TAKEME V1 website release qualification — no approval to deploy

Updated 3 October 2026 for the website blocker sprint. This is the current local-source inventory and a future release procedure. No production Firebase, OAuth, hosting environment, deployment, legal publication, policy activation or deletion execution was accessed or changed. Earlier Phase 15 cloud observations are historical and must not be treated as today's platform status. `.firebaserc` names a candidate project; it is not release authorization or proof of the intended target.

## Current release decision

Production remains **NO-GO** until final legal/publication approval and explicit resource/operational qualification. `functions/src/release-policy.ts` is the policy source: production publication is false and required Terms/Privacy versions are null. Draft acceptance is demo-only. Environment flags cannot activate draft policies. Privacy/Terms/Contact/prohibited-items routes still intentionally return 404 outside the local legal preview. The release validator refuses production before building when those decisions are incomplete.

Confirmed operator: TAKEME TECHNOLOGIES. Confirmed support/privacy/legal contact: support.takeme@gmail.com. Remaining applicable registration/SSM/address facts, legal review, Bahasa Melayu privacy notice, provider/retention disclosure reconciliation and actual HTTPS publication are separate owner/legal decisions. Do not invent final values or remove publication guards as a configuration workaround.

## Build and qualification commands

Use the installed Node 22 toolchain. No `.env.local` is required; pass configuration through the current process or an approved future CI/hosting environment. Public Web SDK identifiers are client-visible configuration; Admin keys, provider secrets and private credentials never belong in `NEXT_PUBLIC_` settings or this repository.

```sh
# Explicitly selected local optimized build; never a production release artifact.
npm run build:demo
TAKEME_RELEASE_TARGET=demo NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-takeme npm run release:check:demo

# Future production commands, only after separate legal/resource approval.
# Required production values must already be supplied securely by the approved environment.
npm run release:validate
npm run build
npm run release:check
```

Default `npm run build` refuses unknown/incomplete target configuration. `next.config.ts` applies the same configuration gate even to direct `next build`. The wrapper writes ignored `.next/takeme-release.json` only after a successful build and first-party runtime inspection. Direct `next build` does not produce this qualification provenance and cannot pass `release:check` by itself.

The provenance records target, effective-configuration hash, build ID and hashes of production JS/HTML/manifests/CSS. It binds output to the configuration used to build it: supplying safe current environment values cannot promote an earlier demo artifact. Browser-visible first-party configuration proof is checked against the actual initialized Firebase SDK values and scanned in built client chunks. Unused emulator strings in Firebase SDK code are not mistaken for configured live endpoints. Missing/different proof, local-IP image optimization in production, changed files/configuration or a demo target refuses qualification. Proof contains public Web SDK configuration and policy metadata only; no server credentials/gates are embedded.

Both build and release qualification also compare the generated policy blocks in `firestore.rules` and `storage.rules` with `renderPolicyRules()` from the central source. Mismatched/missing blocks fail before qualification; changing source versions alone cannot silently leave older rules accepted. Regeneration is a reviewed source change, not a deployment command.

## Required production web and server inputs

Every value requires separate review against the intended registered app/resources. Validation checks conventions and consistency without contacting Firebase; it does not prove that a registered app/provider/domain exists.

| Name | Required production state |
| --- | --- |
| `TAKEME_RELEASE_TARGET` | Explicit `production`; absence is not production selection |
| `TAKEME_FIREBASE_PROJECT_ID` | Explicit approved project ID matching `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; never inferred from `.firebaserc` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Registered Firebase Web API key; never a service-account/provider secret |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Confirmed project's registered `<project>.firebaseapp.com`; custom auth domains require separate validation/review |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same explicitly confirmed production project; no demo/test project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Registered same-project bucket and member of the approved cleanup bucket list |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Registered numeric sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Registered Web App ID whose sender component matches |
| `NEXT_PUBLIC_SITE_URL` | Exactly `https://takeme.my`; no HTTP, fallback, path, credentials, query or alternate host |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Explicit `false` in the web build |
| `TAKEME_STORAGE_BUCKETS` | Explicit comma-separated same-project `<project>.firebasestorage.app` / `<project>.appspot.com` buckets actually used; no arbitrary bucket |
| `TAKEME_DELETION_ENVIRONMENT` | `production` only after separate deletion qualification |
| `TAKEME_ENABLE_PRODUCTION_DELETION` | `true` only after separate approval; actual current policy source still blocks production execution |
| `PROTECTED_PAYMENTS_ENABLED` | Absent or `false`; payment provider remains a non-operational stub |

Production web qualification refuses emulator host/hub variables and `FUNCTIONS_EMULATOR`, loopback/demo/test endpoint values, project/bucket/sender mismatch and incomplete final policy versions. Do not copy emulator process variables into hosting environments. `NODE_ENV=production` is supplied by Next; it does not itself select or prove the project.

For Functions, the platform supplies `GCLOUD_PROJECT`/`GOOGLE_CLOUD_PROJECT`/`GCP_PROJECT`, Admin app project metadata, default Storage bucket and managed runtime identity. Consistent trusted runtime project metadata must match `TAKEME_FIREBASE_PROJECT_ID`. Configure the approved release target, resource bucket allowlist and deletion gate explicitly in the future server environment. Production deletion requires both resource validation and the final central policy approval; configuration tests with an injected approved policy do not activate it. No manually supplied Admin service-account key or Stripe secret is required by active source. Do not manually forge platform project metadata.

## Domains and OAuth — owner/platform checks required

- Confirm hosting site/project, source branch/commit, Node 22 and Next 16 support; this checkout has no hosting linkage/configuration that proves the current live target.
- Verify HTTPS for `takeme.my` and the chosen `www.takeme.my` redirect. Approve these Firebase Auth authorized domains. Retain/evaluate provider defaults separately; local console/provider status was not inspected.
- Verify registered Web App values and the chosen auth domain with Firebase's authorized-domain/provider configuration. Google OAuth authorized redirect URI for the registered Firebase auth domain is `https://<confirmed-project>.firebaseapp.com/__/auth/handler`; verify the actual provider console callback rather than deriving or changing it automatically. Verify consent screen, Google provider enablement and authorized origins for the published hosts.
- Enable/test intended email/password recovery and real Google OAuth under separately authorized staging/release checks; emulator mock Google is not production OAuth certification.
- Confirm billing, APIs, Scheduler/Eventarc/Pub/Sub service agents, least-privilege managed IAM, quotas, alert recipients and rollback owner. No current production inventory or billing assumption is certified by the local build.

## Current deployment inventory

Source inventory: **100 deployable Functions = 76 callables + 17 Firestore triggers + 7 schedules**. `functions/src/index.ts` also exports `_test`, which is an internal helper object and not a deployed Function. Node runtime `nodejs22`, region `asia-southeast1`, global maxInstances 20. Firebase configuration references committed Firestore/Storage rules, indexes and the `functions/` source with a TypeScript predeploy build.

| Source module | Exported Functions | Purpose |
| --- | ---: | --- |
| `index.ts` | 10 | Fixed listings, auctions/bids and auction finalization |
| `intelligence.ts` | 8 | Authenticated discovery signals, recommendation service and derived events |
| `discovery.ts` | 2 | Public/authenticated discovery and similar listings |
| `promotions.ts` | 9 | Unpaid promotion requests, eligible placements/events and expiry |
| `transactions.ts` | 16 | Offers, deals, participant resolution, reviews and reputation |
| `admin.ts` | 4 | Claim-gated operations/metrics and report review |
| `engagement.ts` | 23 | Notifications, preferences, follow/search activity, event jobs |
| `public-sellers.ts` | 1 | Whitelisted seller/trust projection |
| `public-listings.ts` | 4 | Safe public detail/page, viewer state and owner history |
| `reports.ts` | 1 | Scoped/deduplicated marketplace reports |
| `messaging.ts` | 8 | Participant conversations/messages/seen state and deal-conversation trigger |
| `protected-transactions.ts` | 5 | Disabled payment policy/provider architecture and existing resolution records |
| `account-deletion.ts` | 5 | Public execution availability, authenticated deletion status/request/retry and gated maintenance |
| `auth-onboarding.ts` | 4 | Server-owned policy/age acceptance and profile/welcome completion |

The source has **49 composite indexes: 48 COLLECTION and 1 COLLECTION_GROUP**, plus **13 single-field overrides** for user/member/bid/change/notification collection-group cleanup/analytics queries. Use the exact committed `firestore.indexes.json`; no deployed index count/readiness was queried. Emulator query success does not certify production indexes. Wait for all required definitions to be READY in the approved future target before traffic; do not remove historical indexes blindly.

| Scheduled Function | Schedule (UTC) | Readiness required |
| --- | --- | --- |
| `advanceAuctionLifecycle` | Every minute | Auction start/end state and downstream winner-deal trigger healthy |
| `processEngagementJobs` | Every minute | Queue/index readiness, bounded leases, notification dedupe, retry/error monitoring |
| `queueEndingAuctionAlerts` | Every minute | Auction horizon query/index, job dedupe and scheduler cursor |
| `expireOffers` | Every 60 minutes | Offer/lock expiry query and participant notification triggers |
| `releaseExpiredReviews` | Every 60 minutes | Double-blind review release/index and summary consistency |
| `expirePromotions` | Every 60 minutes | Existing promotion expiry/locks; no payment activation |
| `processAccountDeletions` | Every 5 minutes | Separately approved resource/policy gate, pending obligations, cleanup retries, retention expiry and failure alerts |

Firestore triggers must exist before the activity that generates their events. Schedules can execute as soon as deployed; deploying them is an operational change, not inert packaging. Emulator Scheduler does not execute automatically; local deletion tests/runner use the same maintenance function with explicit demo resources. Define schedule retry/dead-letter or documented incident recovery and alerts before enabling real execution.

## Expiry / TTL qualification

`expiresAt` validity checks are not physical deletion. The committed index file currently has no TTL declarations for these active-data records. No production TTL was enabled or examined.

| Collection group | TTL field | Existing source lifetime |
| --- | --- | --- |
| `marketplaceEvents` | `expiresAt` | 90 days |
| `intelligenceQuotas` | `expiresAt` | 3 days |
| `discoverySessions` | `expiresAt` | 2-hour validity |
| `discoveryAttributions` | `expiresAt` | 7-day validity |

After separate retention/privacy and platform approval: confirm the target project and field timestamp types, review exclusions/backups/cost and any existing records, configure one Firestore TTL policy per listed collection group/field through the approved console or reviewed infrastructure, wait until policies are active and validate expiry in an approved staging environment. Document asynchronous deletion timing rather than promising immediate expiry; TTL is not an authorization or account-deletion substitute. Do not blindly backfill timestamps or purge legacy data. Account-deletion deadlines use the explicit gated maintenance queries/recursive cleanup described in `docs/account-deletion.md`, not assumed TTL.

## Future coordinated release and rollback

1. Obtain final legal/policy/publication and production deletion authorization; reconcile retention/provider/backup/recovery disclosures and a real dispute resolution owner. Approve non-draft Terms/Privacy versions and publication state in `functions/src/release-policy.ts`; regenerate its marked blocks in both rules and run build/release drift checks. Publish actual final legal content through a separately approved change; central approval alone does not bypass the existing public-route publication guards.
   For first production activation, an authorized Admin/server operator must create the write-protected `releasePolicies/current` mirror with `releaseTarget: production`, the explicitly approved `projectId`, and the exact `publicationApproved`, `termsVersion`, `privacyVersion`, `minimumAge` values from that source. Review the generated object before the separately approved write; clients cannot write it. The current initializer creates only a missing demo mirror and never overwrites an existing revoked/mismatched record or initializes production. Do not use acceptance clients to create or repair this mirror. Version changes/revocation require coordinated source/rules/mirror review and rollout; Storage uses the generated version gate rather than a third Firestore lookup, so mirror-only revocation does not replace Storage rule regeneration/deployment. No production mirror or draft policy activation is authorized during this sprint.
2. Independently confirm the exact hosting/Firebase targets, registered Web SDK resources, live rules/indexes/Functions/data/schema, billing/IAM, monitoring and maintenance window. Capture current release artifacts/ruleset IDs, schedules and rollback decisions through separately approved read-only review.
3. Deploy approved additive indexes and wait for READY. Qualify TTL separately. Stage compatible Functions/triggers/schedules, then matching rules and web cutover with traffic control; do not leave old direct-write clients active against new callable-only rules.
4. In the approved build environment run `release:validate`, `build` and `release:check` on the exact reviewed source, then obtain separate deployment permission. Local test passes never authorize deployment or publication.
5. After separately approved deployment, start with non-mutating HTTPS/config/rules/index/Function health checks. Any real signup/listing/bid/message/deletion smoke action requires its own approved data plan. Monitor denials, errors, jobs, cleanup failures and costs against agreed rollback thresholds.

Preserve previously verified compatible web/Functions artifacts and prior reviewed rules/index inventories. Rolling back the web alone can reintroduce incompatible direct writes; reverting to weaker historical rules is not a safe automatic rollback. Additive indexes may remain. Stop traffic or problematic jobs under incident authority before choosing a compatible rollback. Never delete Functions/schedules or restore deleted accounts blindly; backup restoration must reapply deletion state/cleanup before activation. Actual protected backups/log retention and recovery validation remain operational approval requirements.
