# Owner-approved V1 policy model — local implementation only

This work starts at preparation checkpoint `576e93f1f0f1bfbf93cf57eb9706abdc9ee165f7`. The decisions below are owner product/policy decisions, not legal-counsel conclusions or permission to publish, deploy, activate policies or enable deletion. No production data migration is performed by this implementation.

## Source and launch inputs

The intended production Terms and Privacy versions are both `1.0`; minimum age remains 18. `productionReleasePolicy.publicationApproved` remains `false`. Final English content, BM content, publishable-address applicability and final publication remain independently unapproved.

The effective date is the actual public launch date. V1 last-updated is the same launch date unless separately changed. Both actual date values remain `null` until the owner supplies the real date; no historical draft/staging date is inherited. The source describes this date rule explicitly without converting it into a date or scheduled activation.

The strict six-field `releasePolicies/current` contract is unchanged. Version preparation does not write that record or make acceptance available in production. Generated production rule branches remain inactive while source publication approval is false. Demo `1.0-draft` and protected staging `1.0-staging` retain their existing resource-specific acceptance identities. Local legal review identifies the intended V1 `1.0` content separately from synthetic acceptance versions.

## Public browsing and protected actions

Signed-out visitors and active signed-in users with missing/outdated acceptance may browse the public marketplace: Home, Explore, public listings/auctions, seller profiles and other approved public projections. Browsing, refreshing and logging in never imply acceptance.

Sell/listing changes, Chat/message creation, Offer/counter/accept, Bid, Save/Follow, uploads and existing protected marketplace writes still require the server's current Terms/Privacy/18+ eligibility. Frontend action guards preserve the current route/query/fragment and send the owner to the appropriate authentication/setup checkpoint; they never execute or replay the intended action after return. Stale-session backend denials recheck account status without silently retrying the write.

Public-read wrappers remain public/lifecycle-aware. Background tracking/read-marker effects do not force reacceptance merely from public browsing. Protected route and action checks do not replace authoritative Functions/Firestore/Storage guards. Missing/inactive/malformed policy remains unavailable for protected writes. Deletion-pending, disabled and deleted-account safeguards retain their existing restrictions and narrow resolution exceptions.

## Existing accounts and onboarding

Policy changes do not delete or rewrite existing profiles, listings, conversations, messages, auctions, Saved/following records or sessions. Users needing new acceptance can keep browsing; a protected action leads to reacceptance and returns to the intended context. Previously completed profile/welcome markers remain valid after genuine reacceptance.

New email signup and genuinely first-time Google signup retain acceptance → profile → welcome → `/explore`. Terms and Privacy must both be accepted and 18+ explicitly confirmed. Normal returning login to public content can browse without current acceptance; returning protected intent still requires the checkpoint. Welcome retains Start Exploring as primary and the separate Sell/return-context option. No buyer/seller account split or new onboarding step is introduced.

## Evidence and truthful legacy migration

The current authorization read model stays at `users/{uid}/private/onboarding`. Eligibility uses that bounded document and the trusted current policy, never an unbounded history query. Current versions and server acceptance timestamps update only after explicit valid confirmations; profile/welcome completion markers are preserved.

Immutable private history uses `users/{uid}/private/policyAcceptances/events/{acceptanceId}`. This is a valid six-segment document path; the conceptual five-segment path is not a Firestore document path. History is server-authored and client-denied. It stores only version/18+ evidence, server-controlled timestamps, source and supported release identity, with no IP, user-agent, cookies, tokens or birth date.

A fresh logical consent gets a server-generated UUID chosen once before the transaction. The same transaction creates the immutable event and saves its `acceptanceHistoryId` pointer in the current projection. Valid retries, including concurrent calls, reuse the committed pointer and original timestamps. A changed policy combination or fresh consent after revocation creates a new UUID event. Missing, malformed, foreign or inconsistent pointed evidence fails closed; acceptance never repairs or overwrites it silently. Legacy archive IDs hash the exact owner, versions and original evidence timestamps, including an existing revocation timestamp when present, so repeating that archive does not create duplicate evidence.

Ordinary login, status checks and public browsing do not backfill history. During a later explicit acceptance/retry, valid pre-existing current evidence can be archived truthfully with its exact original versions and separate timestamps, marked `legacy-current`. No combined original `acceptedAt` or original release provenance is fabricated. Malformed prior evidence requires review rather than a false history event or silent destruction. Fresh consent and its current projection commit atomically; retries never overwrite historical records.

History remains immutable through normal acceptance/reacceptance. It is private user-linked data subject to the existing account-deletion user-subtree cleanup, not an indefinite retained audit ledger. This work adds no retention period, legal hold, production deletion activation or statutory-retention decision. Legal retention conflicts remain for review before go-live.

## Legal languages, prohibited items and deletion

English Privacy remains the review source at `/privacy`. `/privacy/bm` and language navigation prepare a BM content slot only. Actual BM legal text is absent and marked **OWNER/LEGAL APPROVAL REQUIRED**. The empty placeholder cannot become a production notice merely by changing a readiness boolean; approved nonempty content and all publication gates are required. No machine-approved translation exists.

Prohibited-items launch content is associated with Terms `1.0` and the independent publication/final-wording review. It does not claim counsel approval, universal listing authentication or preapproval. V1 content must not present Stripe/protected checkout, seller payouts, shipping/AWB, Seller Centre, live/short-video commerce or other V2 capabilities as currently live.

The public account-deletion route remains part of the intended V1 launch. Execution is a separate qualified/approved operation and remains disabled for production. No release bootstrap, rules/Functions/frontend deployment, TTL activation, Cloudflare/DNS/Hostinger change or Netlify removal occurs here.

## Remaining legal review

Outstanding: publishable business address; individual/business seller disclosures; statutory record retention and conflicts with deletion periods; platform/intermediary duties; cross-border/provider wording; backups/logs/legal holds; breach notification and DPO applicability; final English Terms, English Privacy, BM Privacy and prohibited-items approval. The launch date itself remains an explicit unresolved owner input.

Technical owner-model readiness is distinct from legal activation readiness. Passing local tests does not close these decisions or authorize production changes.

## Local verification

Verified with installed Node 22.23.2 and OpenJDK 21; no installation or global configuration change. Full app suite: 242 passed. Functions build/full suite: 142 passed. App TypeScript and full ESLint pass. Final diff/security review found only task source, tests and documentation; production flags/dates remain inactive and unresolved.

Demo-only integration: 12 acceptance/history groups and 6 public/protected groups passed. Coverage includes concurrent retry idempotency, immutable history client CRUD denials, truthful old-version/legacy evidence, null-revocation compatibility, fresh consent after revocation, projection/setup preservation, public signed-out/missing/outdated reads, protected writes/uploads, malformed/inactive policy and deletion-pending guards. Tests restored the original demo policy mirror and cleaned only their owned synthetic fixtures. Network isolation denied outbound cloud/metadata access. Existing standalone Firestore and unrelated demo data were preserved.

Local browser verification: outdated returning email login landed on Explore without changing consent or creating history; Sell routed to the policy checkpoint with its destination preserved; unchecked confirmations failed; explicit non-final demo acceptance returned to Sell while preserving completed profile/welcome and created no listing, offer, message, bid, Save or Follow. Terms/BM Privacy display intended V1 1.0 with launch date pending and unpublished warnings. No hydration error appeared in this checked journey. Browser proof files remain outside Git.

Scope limitation: upload acceptance/ownership permits were exercised through the real demo callable; Storage byte upload/readback was not rerun. The preserved standalone Firestore is not registered with the temporary CLI Storage emulator, so the isolated harness runs Auth and Functions only. No real Google OAuth or production migration/activation was performed by this local policy task.

Main and its pre-existing review/probe changes remain untouched. Qualification changes are uncommitted at the approved preparation checkpoint; no cloud, rules, Functions or frontend deployment occurred, and production deletion stays off.

## Changed-file inventory

- `docs/owner-v1-policy-model.md`
- `docs/production-legal-policy-preparation.md`
- `docs/production-policy-bootstrap.md`
- `functions/src/auth-onboarding.ts`
- `functions/src/legal-publication.ts`
- `functions/src/policy-acceptance-history.ts`
- `functions/src/release-policy.ts`
- `functions/test/account-eligibility.test.cjs`
- `functions/test/policy-acceptance-history.test.cjs`
- `functions/test/production-policy-handlers.test.cjs`
- `functions/test/production-policy-runtime.test.cjs`
- `src/app/help/prohibited-items/page.tsx`
- `src/app/privacy/bm/page.tsx`
- `src/app/privacy/page.tsx`
- `src/components/auth/account-onboarding.tsx`
- `src/components/auth/auth-form.tsx`
- `src/components/auth/auth-provider.tsx`
- `src/components/intelligence/for-you-feed.tsx`
- `src/components/listings/auction-panel.tsx`
- `src/components/listings/standard-product-detail.tsx`
- `src/components/messages/conversation-deals.tsx`
- `src/components/messages/conversation-view.tsx`
- `src/components/messages/message-seller-action.tsx`
- `src/components/profile/follow-seller-button.tsx`
- `src/components/public-information/privacy-languages.tsx`
- `src/components/public-information/public-information.tsx`
- `src/components/saved/save-button.tsx`
- `src/components/transactions/listing-deal-panel.tsx`
- `src/components/trust/report-action.tsx`
- `src/content/marketplace-rules.ts`
- `src/content/privacy-notices.ts`
- `src/content/privacy.ts`
- `src/lib/account-eligibility.ts`
- `src/lib/auth-routing.ts`
- `src/lib/firebase/auth.ts`
- `src/lib/privacy-notice.ts`
- `src/lib/public-information.ts`
- `src/lib/services/account-setup.ts`
- `src/lib/services/marketplace-call.ts`
- `src/lib/services/promotions.ts`
- `tests/auth-onboarding.test.mts`
- `tests/google-auth.test.mts`
- `tests/legal-policy-emulator.integration.mjs`
- `tests/policy-browsing-emulator.integration.mjs`
- `tests/production-build-gates.test.mts`
- `tests/production-policy-bootstrap.test.mts`
- `tests/protected-marketplace-actions.test.mts`
- `tests/public-information.test.mts`
- `tests/release-validation.test.mts`
- `tests/staging-isolation.test.mts`
