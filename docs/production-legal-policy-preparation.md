# Production legal and policy bootstrap preparation

Prepared 5 October 2026 against approved compatibility checkpoint `4d3176592c2be1c68af8d956a265843694f5a631`. This document prepares a reviewed activation procedure; it does not approve legal content, policy versions, publication, production writes, deployment, deletion, payments or website cutover. Local tests use `demo-takeme` only. No production customer data is needed for this preparation.

## Current boundary

The completed Phase 1 report records 49 READY composites, 12 relevant field overrides, 91 ACTIVE Functions, six unchanged schedules, zero TTL policies, unchanged Firestore/Storage rules and an unchanged Netlify frontend. The five preparation Functions are deployed: `getAccountSetupStatus`, `acceptWebPolicies`, `completeFirstTimeProfile`, `finishAccountWelcome`, `requestUploadPermits`. Their existence grants no policy approval. `releasePolicies/current` remains absent/inactive; deletion and protected payments remain OFF. This preparation does not independently repeat the production inventory or change it.

Do not deploy the current root rules: their generated production policy branches intentionally evaluate to `false`. Do not update existing serving Functions before the legal, acceptance and compatible-client transition is ready. Do not enable TTL/deletion, change schedules, DNS, Cloudflare routing, Hostinger or Netlify.

## Source inventory and owner/legal decisions

| Source | Purpose and current status |
| --- | --- |
| `src/content/operator.ts` | Confirmed operator `TAKEME TECHNOLOGIES`, SSM `KT0622373-U`, customer support and privacy/legal contact `support.takeme@gmail.com`; address still needs an explicit publishable value or a legally reviewed not-required decision. |
| `src/app/terms/page.tsx` | English Terms draft; production publication remains independently gated. |
| `src/app/privacy/page.tsx`, `src/app/privacy-policy/page.tsx` | English Privacy draft and compatibility route; no approved BM notice may be inferred from the English draft. |
| `src/app/help/page.tsx`, `src/app/contact/page.tsx` | V1 Help and Contact; support links and scope need final production route review. |
| `src/app/account-deletion/page.tsx` | Public ownership/authentication route with honest unavailable-state handling; publishing this route does not enable deletion execution. |
| `src/content/marketplace-rules.ts`, `src/app/help/prohibited-items/page.tsx` | Owner-supplied V1 prohibited-items list; final publication/content approval remains separate. |
| `functions/src/release-policy.ts` | Central Terms/Privacy version, publication intent and minimum-age source. Production remains false/null/null/18. |
| `functions/src/legal-publication.ts` | Independent final-content, BM, registration/address and final-route gates. Registration approved; other outstanding gates stay closed. |
| `src/lib/public-information.ts` | Route availability, public-information exemptions and document display metadata. Proposed/draft dates must not become final dates implicitly. |

The exact file names above are source references, not production publication evidence. The final English documents, an approved BM Privacy notice, final date metadata and address applicability must be approved in source before any future publication or bootstrap. Final content must retain truthful V1 claims: TAKEME does not currently process buyer-to-seller payments, provide Stripe Connect payouts or shipping, guarantee every listing's authenticity, or provide V2 video/live features.

### OWNER/LEGAL ACTION REQUIRED

Obtain explicit decisions on all of the following; do not replace them with engineer assumptions:

1. Approve the final English Terms and Privacy texts separately, including the marketplace's role, direct buyer/seller arrangements and limitations of implemented moderation.
2. Supply/approve a Bahasa Melayu Privacy notice and its relationship to the English notice. No unapproved machine translation is published.
3. Approve the exact publishable operator/business address, or confirm the legally applicable alternative/not-required decision and disclosure wording. A private contact address must not be inferred.
4. Approve separate exact final Terms and Privacy identifiers. Neither is chosen in this preparation. Each may differ from the other; neither may contain draft/demo/test/staging markers or whitespace.
5. Approve each final effective date and last-updated date for the final content. Existing proposed dates are not automatically reused.
6. Confirm which seller identity, contact, registration, pricing/item and fulfilment disclosures apply to TAKEME V1 and how the existing public/general-area projection should satisfy them without exposing private street addresses.
7. Confirm retention/legal-hold purposes and periods for marketplace records, messages, disputes, security/fraud evidence, backups and logs, including the approved 30-day deletion operation/audit period and restoration procedure.
8. Confirm applicable marketplace intermediary obligations, reporting/takedown process, prohibited-items scope and moderation escalation responsibility; do not claim all listings are preapproved.
9. Confirm supplier/processors, international-transfer disclosures, user rights/request process and the intended Malaysia jurisdiction wording through final counsel review.
10. Approve final production routes and independently approve publication, bootstrap and each subsequent activation/deployment operation. These are separate decisions.

Registration and contact values alone do not close these gaps.

### Concrete Malaysian-law review questions

These sources identify decisions for counsel, not a declaration that this draft satisfies the law:

- The [2024 Electronic Trade Transactions Regulations, official KPDN repository](https://repositori.kpdn.gov.my/bitstream/123456789/5299/1/PERATURAN%20URUSNIAGA%20PERDAGANGAN%20DALAM%20ELEKTRONIK%202024.pdf) contain seller disclosure/language requirements (regulations 3–4), marketplace operator duties (regulation 7) and a three-year record provision (regulation 8). Counsel must determine their exact applicability, required record categories, content and retention start point for TAKEME V1, including its direct buyer/seller arrangement model.
- Specifically reconcile that record requirement with the implemented 12-month pseudonymised deal history, 90-day counterparty messages, 180-day closed case evidence and 30-day deletion operation/audit periods. Do not silently increase them, delete required evidence or promise legally required erasure before review; any changed retention map/implementation needs separate approval and tests.
- The [official Privacy Notice guide](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/01/A-Quick-Guide-to-PRIVACY-NOTICE-1.pdf) supports the bilingual notice review. Confirm English/BM completeness, operator/address/contact disclosures, purposes, processors/transfers, choices/rights and request channels for the final actual data flows.
- Use the [official PDPA and related instruments](https://www.pdp.gov.my/ppdpv1/en/akta/pdp-act-2010-en/) to assess applicable current obligations, including DPO/breach-notification and international-transfer questions. Applicability and operational responsibilities remain OWNER/COUNSEL decisions; do not add unsupported compliance claims.

## Central version and date model

The existing central release model remains:

```ts
productionReleasePolicy = {
  publicationApproved: false,
  termsVersion: null,   // OWNER/LEGAL: exact final Terms identifier
  privacyVersion: null, // OWNER/LEGAL: exact final Privacy identifier
  minimumAge: 18,
};
```

Nulls are inactive placeholders, not publishable identifiers. Do not add environment/CLI overrides for versions or approval. Final document dates belong to approved central legal metadata, independently validated by the legal-publication gate, rather than being invented in the runtime enforcement record. Date metadata, operator identity and document revision evidence must remain traceable in the reviewed source checkpoint. A source-policy/date/publication change requires regenerating rules and rebuilding/requalifying the frontend artifact; runtime mirror resolution does not waive these requirements.

The prepared date fields are `legalPublicationReadiness.effectiveDate` and `legalPublicationReadiness.lastUpdated`, both `string | null`, both currently `null`. Their final values require explicit approval and must pass the strict calendar-date validator in `YYYY-MM-DD` form. Demo preview preserves historical proposed dates only as draft display values; production publication cannot inherit them when final source date fields are null.

These source dates are document metadata, not a scheduled activation timestamp. The current six-field runtime record becomes available immediately when valid and approved; it does not wait for a future `effectiveAt`. Owner/legal must approve the activation time, timezone and notice plan relative to the approved effective date before any create. Do not activate early by assuming that a future display date delays enforcement.

The policy dependency chain is: approved central versions and legal metadata → matching generated rules and frontend proof → separately approved create-only server record → genuine owner acceptance of those same versions → eligibility-guarded mutations. Runtime policy availability and legal route publication are independent gates; a valid mirror cannot publish unfinished legal pages.

## Exact `releasePolicies/current` schema

Preserve the existing six-field schema. Runtime production resolution rejects extra fields; adding `effectiveAt`, `updatedAt`, operator text or revision fields to this record would currently make it malformed and deny acceptance/mutations. These are therefore not added casually. Firestore's document create/update metadata can provide operation timing; legal effective dates/operator/revision remain reviewed source metadata. If a future schema needs audit fields, review and qualify the resolver, bootstrap, rules, frontend and migration together first.

| Field | Type | Exact requirement |
| --- | --- | --- |
| `releaseTarget` | string | `production` |
| `projectId` | string | `takeme-52b80` |
| `publicationApproved` | boolean | `true` only under independent real owner/legal publication approval |
| `termsVersion` | string | Exact final Terms identifier from central source; unresolved here |
| `privacyVersion` | string | Exact final Privacy identifier from central source; unresolved here |
| `minimumAge` | integer | `18` |

No client may create, list, merge, update or repair this record. The approved Firestore source allows a public `get` only of this nonpersonal current release metadata. A get is not permission to accept or mutate. The Functions resolver independently requires exact managed/Admin project and default bucket `takeme-52b80.firebasestorage.app` and refuses emulator/staging resource context.

## Fail-closed and valid-policy behavior

The exact runtime production resolver rejects missing/null/non-object records, wrong project/target, false/string approval, missing/null/empty/whitespace/draft Terms or Privacy identifiers, malformed/missing age, additional fields and mismatched resource context. No client timestamp, frontend flag, environment approval or version input can create eligibility.

| Endpoint/group | Missing/inactive/malformed mirror | Valid current mirror, active owner |
| --- | --- | --- |
| `getAccountSetupStatus` | `step: acceptance`, `policyAvailable: false`, null versions; deletion lifecycle takes precedence | Checks current acceptance, saved profile and welcome prerequisites and returns their authoritative step. |
| `acceptWebPolicies` | `failed-precondition`, `policy-release-unavailable`; no acceptance write | All three booleans must be literal true and request versions must match the resolved current Terms/Privacy. Same-version retry retains original timestamps. |
| `completeFirstTimeProfile` | Refuses without changing completion | Requires current acceptance and a saved valid display name. |
| `finishAccountWelcome` | Refuses without changing completion | Requires current acceptance and completed profile; completion is idempotent. |
| `requestUploadPermits` | Refuses without permit issuance | Requires current acceptance, active lifecycle, exact owner path/type/size, editable owned listing where relevant and bounded upload cadence. |
| `marketplaceMutationCall` | Refuses protected mutations before the handler and again inside guarded transactions | Current acceptance and lifecycle apply to the same server-owned policy truth. Revocation races abort writes. |
| `marketplaceCall` public/read projection | Policy availability is not a new read prerequisite | Existing authentication, ownership, privacy projection, disabled-account and deletion-lifecycle behavior remains. |

Emulator qualification must exercise fresh account → independent Terms/Privacy/18+ confirmation refusal → private server acceptance → profile → welcome → ready; outdated/missing acceptance; current accepted mutation; upload eligibility; mirror revocation; transaction recheck; deletion lifecycle; no autoexecuted marketplace action. A final-shaped production record used in a pure/local test is not a real policy approval. No production authenticated customer flow is needed or authorized for these tests.

## Existing-user migration

Policy activation does not fabricate acceptance, migrate customer records automatically, change buyer/seller account types or recreate users.

| Existing state | Prepared source behavior after a valid current policy is available |
| --- | --- |
| No acceptance | Account status is `acceptance`; future guarded mutations require genuine Terms/Privacy/18+ confirmation. |
| Older Terms or Privacy version, revoked or incomplete evidence | Account status is `acceptance`; old timestamps do not authorize the new policy. No version is silently upgraded. |
| Current acceptance, valid profile, prior profile/welcome completion | `ready`; ordinary login enters `/explore` or the explicit safe return target. |
| Current acceptance but no profile completion | `profile`; an existing public seller profile alone does not fabricate the private completion marker. |
| Current acceptance and profile but no welcome completion | `welcome`. |
| Existing seller/listings/conversations/auctions/Saved/following | Records are not deleted or rewritten by bootstrap. Reads remain subject to original ownership/privacy/lifecycle protections. Creating/editing/publishing, messaging, bids/offers, Save/follow and preference/read-marker changes require current acceptance when their guarded serving/rules versions become active. |
| Existing authenticated session | On mount/sign-in/setup refresh or eligibility rejection the compatible frontend rechecks status. An already-open stale client is still rejected by backend guards; no refresh event is treated as consent. |
| `deletion_pending` | Normal marketplace access remains blocked; only the existing approved deletion and obligation-resolution surfaces/actions are retained. A policy change cannot reactivate that account. |

### Read-only access: distinguish backend and frontend

Public browsing, listing detail and seller projections remain available without signup/acceptance for signed-out visitors, subject to public projection and availability checks. Lifecycle-only authenticated read callables do not gain a policy acceptance prerequisite. Owner reads such as history, conversations, Saved/Following and preferences continue to require the original owner/participant checks.

The **approved current frontend** is stricter than the read API: `AccountSetupGate` redirects a signed-in non-ready user from all non-auth/non-public-information pages, including Explore, Product Detail and seller routes, to setup while preserving the intended destination. It does not currently provide an exempt signed-in read-only browsing mode. The user can sign out to browse publicly; legal/help/contact/deletion routes remain exempt. This preparation preserves that approved behavior rather than adding wider route exemptions. Owner review must explicitly confirm this migration experience; do not report that signed-in outdated users can browse all screens before reacceptance.

For `deletion_pending`, the frontend preserves only deletion/transaction/message resolution routes. The backend still limits mutation capability to designated resolution actions; a message page exemption is not permission to send a new message.

### Acceptance evidence limitation and rollback decision

The private current acceptance lives at `users/{authenticatedUid}/private/onboarding`; its UID is the server-selected path. It stores `termsVersion`, `privacyVersion`, `termsAcceptedAt`, `privacyAcceptedAt`, `age18ConfirmedAt`, `acceptanceSource: web`, then optional profile/welcome completion and short upload-permit fields. Client UID/source/timestamps are ignored. No IP, user agent, OAuth token, cookie, date of birth or unnecessary sensitive context is collected.

**Current implementation limitation:** genuine reacceptance replaces the current onboarding evidence while preserving only profile/welcome completion markers. It does not yet create an immutable historical acceptance ledger, and replacement drops prior permit leases. Idempotent same-version retries preserve current timestamps. Do not claim complete historical acceptance evidence is already retained.

Before an update to an already-active production policy version, owner/legal must decide the evidence retention requirement and separately review any minimal append-only implementation, deletion/retention handling, indexes/rules and tests it requires. Initial production bootstrap must not overwrite or fabricate prior customer acceptance. Rollback must never delete/alter acceptance documents, write older versions onto users, bulk reaccept users, or erase any existing evidence. A historical-evidence requirement remains an explicit decision; it is not silently solved by policy bootstrap.

## Read/write enforcement model

| Operation | Existing prepared enforcement |
| --- | --- |
| Public Home/Explore/listing/seller/review/category reads | Original public field-whitelisted projections, privacy/version/location safety and availability rules. No new blanket acceptance requirement. Signed-in callers retain lifecycle/disabled-account checks where wrapped. |
| Authenticated own conversation/history/notifications/preferences/Saved/Following reads | Original owner/participant/lifecycle checks. No automatic marketplace eligibility prerequisite in read wrappers. Frontend setup gate still applies as described above. |
| Sell drafts/create/edit/publish/remove; auction create/edit/publish/cancel/bid; offer/counter/accept; opening chat and sending messages; Save/follow/search; reports/reviews | Current policy acceptance and active lifecycle through guarded mutations/direct rules as already designed. Backend transaction recheck prevents revocation races. |
| Mark conversation seen, notification read/open/all-read; preference changes; discovery/engagement tracking | These change state and remain eligibility-guarded; viewing content must not be described as implying unrestricted read-marker/tracking writes. |
| Profile/meet-up/private-address update and Saved direct writes | Owner, current acceptance and lifecycle in final Firestore rules; public profile creation preserves its existing safe onboarding bootstrap exception. Private addresses are never public projections. |
| Avatar/listing object creates | In final Storage rules: exact owner, current source versions/18+ timestamps, valid type/size, exact path permit, editable listing and no existing object. Update/overwrite denied. |
| Existing deal resolution for `deletion_pending` | Only the previously approved narrow resolution wrappers bypass ordinary new-activity eligibility, using retained alias ownership. No new resolution capability is added. |
| Account deletion/protected payments | Separate approvals, runtime/resource/legal/retention gates and existing OFF flags. No activation in this task. |

## Auth and onboarding routing

- New email or Google account: acceptance → profile → welcome. Normal signup/login intent defaults to `/explore`; email signup may collect the same confirmations on signup before entering the profile step.
- Welcome primary is **Start Exploring** → `/explore`. Without a preserved intent, optional secondary is **Sell Something** → `/sell`. With an explicit preserved intent, secondary is **Continue where you left off** → that exact safe context. Choosing Start Exploring remains possible even when an intent exists.
- Returning compliant user skips completed setup and enters `/explore` or the preserved target. Returning outdated-policy user must reaccept; previously completed profile/welcome markers are preserved rather than inventing a seller-first path.
- Sell/Offer/Chat/Bid/Save/Follow route/query/fragment survive the setup journey. External origins, control characters, backslashes and auth/onboarding loops fall back to `/explore`.
- Authentication and redirects only return context. They do not publish, bid, offer, send, Save or follow automatically. The user must invoke the action after return.
- Deletion lifecycle wins over all return intents; only approved resolution/deletion paths remain.

Existing routing unit tests cover normal email/Google signup, returning default/intended login, every explicit context, welcome alternatives and unsafe target rejection. Demo auth integration additionally checks the resulting account has no new listings/conversations/offers/transactions/bids/messages/Saved/following/search actions created merely by signup/login/welcome.

## Generated Firestore and Storage rule inputs

Final generation needs **actual final approved** central `termsVersion`, `privacyVersion`, `publicationApproved: true`, `minimumAge: 18`, plus the independently approved legal/date source. Keep demo `1.0-draft` and staging `1.0-staging` pinned separately; a demo test must not edit production source approval.

`renderPolicyRules()` creates the marked identical policy block in root `firestore.rules` and `storage.rules`. `assertFirestorePolicyRules`/`assertStoragePolicyRules` and `scripts/check-release-rules.mjs` require byte equality with that output. There is currently no general deploy-time approval override or automatic policy-generation deployment command. Regenerate only those marked regions in the reviewed worktree, then inspect the full rule diff and qualify it. Never replace complete rule files or loosen unrelated rules to make a test pass.

The current production branch generation excludes demo and staging audiences and pins source versions. Exact project/deployment/runtime isolation must continue to use `takeme-52b80`; production resources are not inferred from `.firebaserc`. Storage resource/bucket selection must be reviewed against exact approved `takeme-52b80.firebasestorage.app` before a future final-rule apply. Do not claim a broad audience-derived bucket fallback is an exact resource check.

Firestore uses the server-owned mirror plus private acceptance and lifecycle/owner checks. It retains public general-area seller/listing projections, safe private-address owner access, callable-only raw conversations/messages/offers/bids, Saved owner/version controls and all existing protected collections. Storage uses the private acceptance and, for listing images, the existing listing document within its two-document cross-service budget. Deletion initiation atomically removes acceptance/permits, so deletion cannot revive owned writes. No third policy lookup is added casually to Storage.

Storage permits are short leases rather than physical single-use counters. Mirror revocation blocks new permits and guarded Function writes immediately. Already-issued permits are not independently revoked merely by a mirror flip; final Storage versions/acceptance/owner/listing checks and lease expiry still apply. Removing acceptance at deletion blocks its permits. A finalized rule version must pass permitless/overwrite/wrong-owner/path/type/size/lifecycle denial tests before any future deployment.

**Rule-generation readiness:** the mechanism is prepared, but exact production rule inputs remain NOT READY until final identifiers/publication/legal decisions exist. Current generated rules are valid inactive source, not deployable final production policy enforcement.

## Serving Function dependency groups

The reviewed `docs/production-rollout-compatibility.md` per-export table remains authoritative; this preparation does not expand its selectors.

| Group | Existing classification | Prerequisites / treatment |
| --- | --- | --- |
| Five setup/upload endpoints | Preparation/backend first; already deployed OFF/inactive | Actual legal/source/rules/frontend versions aligned, mirror separately approved and created; genuine owner acceptance before protected activity. No unrelated Function rebuild is needed solely for runtime mirror resolution. |
| 40 backward-compatible exports | 29 read callables + 11 derived event handlers, eight optional | No new ordinary caller input/acceptance prerequisite in inspected source; still require exact deployment/runtime/contract/IAM and derived-event deduplication review. Not approved for deployment here. |
| 40 coordinated exports | 34 mutation callables + six eligibility-gated intelligence handlers, four optional | Legal source finalized, active exact mirror, real accepted users and compatible frontend/refresh transition. Derived eligibility failures can skip events and must be operationally qualified. |
| `sendConversationMessage` contract | Coordinated mutation plus keyed/legacy transition | Compatible keyed client first unless a separately approved exact finite legacy-message window is active. Fallback is absent-key only, automatically expires and never bypasses eligibility/lifecycle. No new deadline chosen here. |
| Required existing schedules | Auction lifecycle, offer expiry, engagement jobs, review release | Separate schedule/runtime verification and approval; policy preparation changes none. Optional promotion/ending-alert schedules remain separate. |
| Deletion exports/maintenance, payment stubs, optional admin/promotions | Existing separate exclusions/conditional parity | No blanket deployment/activation. Existing account deletion, TTL/security holds/retention and payment readiness require their own owner approval. |

Do not deploy the 85 general exports as a preparation selector. Prepared runtime policy resolution is separate from legal publication/source-built frontend/rules/deletion requirements. The old live serving code has not been reconstructed merely by listing resource names; do not claim deployed parity for updates not yet performed.

## Compatible frontend and upload rollout

The current frontend obtains setup status from the server but uses source-compiled policy availability/versions when rendering/accepting. A mirror update cannot make the current false/null source frontend accept policies. After legal approval, build the compatible final-version frontend against the exact production SDK through the existing private environment mechanism and requalify its release proof/artifact; do not embed credentials/config files in tracked source or permit client-controlled versions to substitute for the trusted mirror.

Inactive policy UI must remain honest: setup unavailable, safe retry/logout/deletion links, no marketplace action. Legal route availability requires independent final legal approvals and exact production build proof. Use demo/staging previews only under their existing guards; production route copy cannot show staging/draft labels after actual publication. No final production frontend is deployed in this task.

Upload sequencing stays phased:

1. **Phase A completed:** additive setup/upload endpoints; historical production Storage rules unchanged; inactive policy refuses new permits/acceptance.
2. **Phase B future separate approval:** legal/bootstrap and compatible acceptance/keyed/permit-aware frontend; old rules retained for bounded adoption. Verify avatar/listing UUID path uploads, metadata/readback, cleanup, stale-client refresh and compatible rollback.
3. **Phase C future separate approval:** final generated rules enforce permits and create-only paths only after compatible frontend adoption. Permitless/stale clients must refresh or use an explicitly approved write pause, never a permissive final-rule exception.

No zero-downtime write transition is established. It is impossible to retain unaccepted old-client writes indefinitely while enforcing Terms/Privacy/18+ fail-closed. Public reads can remain available, but the prepared signed-in frontend setup experience must be reviewed as described above.

## Exact future bootstrap procedure — do not execute now

### Before any apply

1. Obtain actual owner/legal decisions, exact final versions and final dates. Update approved central source, legal metadata and BM content/wiring. Review final production routes; close the independent publication/readiness gates only when those decisions are real.
2. Regenerate marked rule blocks from those exact source versions and run rule/source tests without deploying them. Requalify source identity, demo tests, TypeScript, ESLint and production frontend build/artifact. Record the exact reviewed source SHA and proposed six-field record in private deployment evidence.
3. Refresh bounded read-only production resource metadata under the separately approved operation. Confirm exact project `takeme-52b80`, number `367115645204`, bucket `takeme-52b80.firebasestorage.app`, five prep Functions in `asia-southeast1`, expected identity/revisions and no unexpected rules/schedule/TTL/serving drift. Do not read customer documents.
4. Establish the compatible frontend/client transition and operational owner. Confirm deletion/payments remain OFF. Inspect existing `releasePolicies/current` only; absent means eligible for create-only under explicit approval, identical means idempotent confirmation, any mismatch/revocation/extras means STOP. Do not overwrite or re-enable it.
5. Obtain explicit approval for the exact create-only cloud write. This task and a successful dry run grant no such approval.

### Safe environment and dry run

Use installed Node 22.23.2 in the local shell. Use an existing authorized managed credential mechanism; never create/paste a service-account key. The following nonsecret selectors identify a **future** controlled operation, not final legal approval:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" \
TAKEME_RELEASE_TARGET=production \
TAKEME_FIREBASE_PROJECT_ID=takeme-52b80 \
GCLOUD_PROJECT=takeme-52b80 \
TAKEME_STORAGE_BUCKETS=takeme-52b80.firebasestorage.app \
TAKEME_DELETION_ENVIRONMENT=production \
TAKEME_ENABLE_PRODUCTION_DELETION=false \
TAKEME_ENABLE_STAGING_DELETION=false \
PROTECTED_PAYMENTS_ENABLED=false \
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false \
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
scripts/bootstrap-production-policy.mjs --dry-run
```

All inherited emulator selectors must be absent. Inherited `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT` and `FIREBASE_CONFIG`, if present, must match the exact approved project/bucket or be removed from the isolated operation environment; do not edit unrelated global system configuration. The default/dry-run validates real source/legal/rule/resource inputs before loading Admin SDK/ADC, performs no cloud access and refuses while source approvals remain closed.

### Separately approved create-only apply

Under the same reviewed isolated selector environment, only after explicit owner approval:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
scripts/bootstrap-production-policy.mjs --apply --project takeme-52b80 --owner-approved-create-only
```

The script accepts only this exact argument sequence, no policy/version/approval overrides. It creates only `releasePolicies/current`; repeats confirm an exact existing record. It cannot update/merge/delete/repair a mismatched or revoked record. Post-create readback must verify the exact six fields before reporting success. If create succeeds but readback fails, treat the outcome as unknown/possibly created, stop affected activation work, inspect only this fixed document and do not retry with an overwrite. Capture safe metadata, never tokens/SDK values or customer evidence.

### Independent read-only verification

After future approved apply, independently read exactly `releasePolicies/current` and compare field names, types and values to the reviewed six-field plan; confirm Firestore create/update metadata separately. No customers are queried. Verify relevant prep endpoint runtime identity/source/runtime controls and use separately approved dedicated noncustomer qualification paths where needed. The write script's readback is necessary but not independent evidence of serving contracts, final rules, frontend, acceptance migration or deletion activation.

Bootstrap does not deploy generated rules or serving Functions, enable TTL/deletion/payments, publish legal pages, change schedules or cut over the website. Stop after the approved operation's bounded verification for the next owner decision.

## Policy rollback and incident procedure

Capture exact policy record/create metadata, legal/source artifact, frontend/Function artifact and runtime configuration, ruleset release IDs and unchanged schedule/TTL state before each separately approved phase. Keep Netlify available until a compatible rollback is qualified. Do not use a historical rules fixture as automatic production rollback.

| Action | Scope, effect and restriction |
| --- | --- |
| Temporarily set `publicationApproved: false` | A **separate authorized revocation operation**, not supported by create-only bootstrap. Prepared runtime setup/new permits/protected Function writes fail closed. Existing short Storage permits may survive mirror-only revocation until acceptance/rule/expiry conditions deny them. Existing old deployed code/rules may not consume the mirror; do not assume universal production suspension. Preserve all acceptance data and investigate before re-enable. |
| Roll frontend back | Use a qualified acceptance-capable/keyed/permit-aware rollback after guarded rules/serving enforcement. An old frontend may be unable to accept current policies or upload under final rules. It cannot bypass backend denial. Keep Netlify unchanged until this rollback is deliberately verified. |
| Roll Functions back | Exact reviewed artifact/config/identity subset only under separate approval. Do not automatically restore handlers that bypass current acceptance, deduplication, ownership or lifecycle. Policy mirror resolution alone does not certify legacy serving parity. |
| Roll rules back | Exact reviewed ruleset release under separate approval with ownership/private-data/lifecycle/eligibility safeguards preserved. Never silently restore weaker permitless/overwrite rules to mask a client problem. Prefer a bounded affected-write pause/refresh when needed. |
| Revert version identifiers | Do not silently downgrade the current record or acceptance evidence. An older identifier can incorrectly reauthorize users and mismatch source/rules/frontend. Requires a reviewed legal/version/schema migration, not bootstrap overwrite. Use explicit suspension when safety is uncertain. |
| Re-enable after suspension | Obtain explicit owner/legal incident approval, inspect exact record and source/rules/frontend alignment, preserve evidence and qualify behavior. Create-only bootstrap refuses a revoked record; it is not a reactivation tool. |

Never bulk-delete/current-rewrite historical evidence as rollback, fabricate 18+ confirmation, reuse revoked consent, restore deleted accounts, delete additive indexes, enable deletion/payments or change DNS automatically. Preserve customer access to legal/deletion/resolution information under the approved rules. Explain operational limitations rather than claiming a global kill switch that does not exist.

## Local verification checklist and readiness decision

Record actual results from this preparation, independently of the prior Phase 1 cloud report. Test logs/screenshots/private fixtures remain outside Git.

| Check | Required evidence |
| --- | --- |
| Missing/inactive/malformed/version-mismatched policy | Pure resolver and actual compiled handler controls; no acceptance/permit/protected write side effects. |
| Valid current demo policy | Loopback-only Auth/Firestore/Storage/Functions integration, fresh/returning/outdated owner states, explicit three confirmations, private server timestamps, upload permits and marketplace guarded transactions. |
| Source/rule equality | Both generated marked blocks exactly match central inactive source until approval; owner/lifecycle/projections/permits/overwrite behavior unchanged. |
| Routing and no automatic action | Unit targets and demo integration absence of unintended marketplace records. |
| Legal rendering/mobile | Local demo legal/help/contact/deletion/prohibited-item routes, 390×844, 430×932, 1440×900; inspect readable copy, metadata, missing final-date/BM/unpublished handling. No publication. |
| Qualification | App/Functions tests, frontend TypeScript, ESLint and final diff review, isolated emulators, no cloud access/config/credentials/artifacts introduced. |

### Completed local preparation checks

| Check | Result and limit |
| --- | --- |
| App and Functions suites | 229 app tests and 124 Functions tests passed. These are local source tests, not authenticated production customer-flow checks. |
| TypeScript, ESLint, diff | Passed. `checkReleaseRules` passed for the unchanged inactive source/marked-rule alignment; this is not final production rule approval. |
| Real demo legal/policy integration | Eight groups passed using the isolated `demo-takeme` environment, including fail-closed/current-policy setup and eligibility behavior. No production policy was written or activated. |
| Offline frontend build/artifact | Network-blocked offline qualification passed; 646 artifact files checked. The artifact is explicitly nondeployable and does not establish production publication or live backend parity. |
| Legal/auth browser checks | Six legal routes plus auth, acceptance and welcome checked locally at 390×844, 430×932 and 1440×900; no horizontal overflow or hydration errors observed. Fresh demo acceptance → profile → welcome → `/explore` passed. Returning compliant email login without intent → `/explore`, direct Settings refresh, logout and explicit Sell login → Sell step 1 also passed. Returning-session checks used isolated Auth/Functions with the preserved Firestore service after the Storage harness failure; they do not qualify image rendering. Google and the other safe return contexts are covered by routing tests, not a live Google OAuth claim. |
| Actual Storage byte rollout suite | Zero groups completed: the Storage emulator could not discover the preserved standalone Firestore service through its emulator registry, and its harness crashed before the scenarios ran. A later image read reproduced the same harness failure. This is a qualification limitation, not an established product defect. No fresh actual Storage-byte rollout PASS is claimed in this preparation. Existing unit/permit eligibility evidence does not substitute for that suite. |

Screenshots, build output, logs and disposable verification data remain private local artifacts outside tracked source. These checks do not close outstanding legal, evidence-retention or signed-in read-only migration decisions.

The owned browser fixture was removed after verification. Bounded exact-owner checks found no listings, offers, conversations, transactions, messages, bids, Saved/following or discovery/cadence records created by login/welcome; its single private onboarding record and Auth identity were cleaned, with zero remaining owned records verified. The local synthetic credential file was disposed and only this task's Auth/Functions/UI and port-3300 Next processes were stopped. The pre-existing standalone Firestore and main local Next services were preserved.

The final owner report must distinguish implemented preparation mechanisms from unapproved inputs, emulator evidence from live production evidence, backend read access from frontend redirects, current evidence from acceptance history, and bootstrap from deployment/activation. Passing technical tests cannot resolve legal decisions.

Until the owner/legal checklist and evidence-retention/migration decisions are closed:

```text
LEGAL SOURCE: NOT READY
POLICY BOOTSTRAP: NOT READY
RULE GENERATION: NOT READY
SAFE TO ACTIVATE PRODUCTION POLICY: NO
```

Stop for owner approval. Do not activate or deploy anything.
