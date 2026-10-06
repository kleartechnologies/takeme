# V1 final owner/legal launch gate

Current owner approvals are recorded locally on preparation checkpoint `5f2fd8a84e7e9071566abd92af581e2a5d7a83a8`, following the owner's instruction “APPLY FINAL OWNER APPROVALS FOR TAKEME V1 LEGAL CONTENT”. The initial preparation baseline was `07a420acb59304325c13d2245691a074e8d83ae4`. This checklist grants no production authority. The later owner-approved RC task applied only the shared local date pair `2026-10-12`. Publication approval, runtime policy, rules, Functions, deletion, payments, TTL, schedules, domains and hosting remain unchanged. On 6 October 2026, read-only metadata and fixed system-control checks reconfirmed absent `releasePolicies/current`, `releaseControls/current` and `releaseControls/auctionCreation`; no customer data was read. See [Final release candidate](v1-final-release-candidate.md) for current evidence and limits.

## Verified source and product model

| Document | Version | Owner content approval | Counsel review | Publication | Effective / updated dates |
| --- | --- | --- | --- | --- | --- |
| Terms | 1.0 | OWNER APPROVED | OUTSTANDING | false | 2026-10-12 / 2026-10-12 |
| Privacy EN | 1.0 | OWNER APPROVED | OUTSTANDING | false | 2026-10-12 / 2026-10-12 |
| Privacy BM | 1.0 | OWNER APPROVED | OUTSTANDING | false | 2026-10-12 / 2026-10-12 |
| Prohibited Items | 1.0, linked to Terms | OWNER APPROVED | OUTSTANDING | false | 2026-10-12 / 2026-10-12 |

The shared production policy is Terms 1.0 / Privacy 1.0 / minimumAge 18, publication false. Operator: TAKEME TECHNOLOGIES, SSM KT0622373-U; support/privacy contact: support.takeme@gmail.com. All approved sections, review markers and social URLs are preserved. The four documents retain their existing centralized disclosure wiring; this owner-approval task changes none of their wording or metadata.

V1 permits public browsing without current acceptance. Sell, Chat, Offer, Bid, Save, Follow, uploads and other protected writes require current acceptance plus normal authorization, lifecycle and maintenance checks. Login, refresh and browsing do not establish consent. Existing-user reacceptance preserves profile/content and profile/welcome completion. Return intent resumes context without executing an action. One TAKEME account can buy and sell. Current V1 does not provide integrated TAKEME checkout/payment processing, seller payouts, shipping/AWB, Seller Centre or live/short-video commerce. Production deletion remains independently gated. No product-model contradiction was identified in the reviewed sources.

These content/product decisions are now **OWNER APPROVED** for release preparation, including the current intermediary, prohibited-items enforcement, direct-transaction and account-deletion models. `functions/src/v1-owner-approvals.ts` records the approval scope; `currentV1LaunchApprovals` records the nine approved preparation items separately from deferred address/activation/cutover decisions and separately approved launch date and unchecked counsel review. Approval is bound to V1.0 and cannot silently approve a later document version.

The existing `finalContentApproved` and `bmPrivacyNoticeApproved` publication-readiness flags remain false: no final counsel/publication approval is supplied. Those broader publication gates do not rewrite or undo the separately recorded owner content approval.

## External legal checklist — counsel review outstanding

Owner approval of the current documents is complete; no separate counsel approval has been supplied. Record final review decisions/references for unresolved legal topics without undoing that owner approval. An explicitly accepted unresolved legal issue needs a documented disposition; content approval does not establish an answer to an unresolved legal question. No legal rule, deadline, exemption, retention requirement or acceptable alternative is assumed here.

| ID | Required final decision | Status |
| --- | --- | --- |
| A | Terms v1.0 final counsel approval | Owner approved; counsel outstanding |
| B | English Privacy v1.0 final counsel approval | Owner approved; counsel outstanding |
| C | BM Privacy v1.0 final counsel approval and EN/BM parity | Owner approved; counsel outstanding |
| D | Prohibited Items v1.0 final counsel approval | Owner approved; counsel outstanding |
| E | Whether a public address is required and any legally approved alternative | Intentionally deferred/not supplied; legal question outstanding |
| F | Individual seller disclosures | Outstanding |
| G | Business seller disclosures | Outstanding |
| H | Bahasa Malaysia seller-disclosure obligations | Outstanding |
| I | Statutory marketplace records, scope, retention and start points | Outstanding |
| J | Retention/account-deletion reconciliation | Outstanding |
| K | Actual providers and international-transfer disclosures | Outstanding |
| L | Malaysian data-subject rights wording and request process | Outstanding |
| M | Backups, logs, legal holds, expiry and restoration controls | Outstanding |
| N | Breach-notification obligations and responsibilities | Outstanding |
| O | DPO applicability | Outstanding |
| P | Final limitation-of-liability wording | Outstanding |
| Q | Final indemnity wording | Outstanding |
| R | Marketplace/intermediary obligations | Outstanding |
| S | Regulated-goods enforcement/reporting duties | Outstanding |

The owner-approved content still contains explicit draft/unpublished and LEGAL REVIEW wording within body paragraphs. Switching a publication flag hides the shared review banner and removes “draft” from link labels; it does **not** remove these paragraphs. The RC task changed only the four obsolete date-status sentences to follow the shared approved date; legal obligations and review markers remain unchanged. Accurate publication text remains a later publication-review concern, not a reason to undo owner approval or block engineering preparation. No automated prose stripping is authorized or implemented.

## One public disclosure insertion point

`src/content/operator-disclosure.ts` holds `operatorDisclosureDecision`, currently kind `unresolved`, English/BM text null, both approval flags false. All four legal records use its fail-closed resolver. A later approved decision can be either `address` or `reviewed-alternative`, with exact reviewed English/BM text and explicit owner approval for public use and counsel approval. Unapproved/blank/malformed text remains unpublished and the documents keep their existing unresolved markers in each language. An alternative does not fabricate an address; BM wording is not generated or guessed.

Do not use a home address, infer an address from registration/account data, or publish an SSM address without specific owner public-use approval. Final EN/BM prose must accurately describe the selected decision; a central metadata change alone does not approve the surrounding publication wording. `legalPublicationReadiness.address` remains pending until this separate decision is reviewed.

**Address is intentionally deferred and not supplied.** Its absence does not block owner content approval, source qualification, launch-date planning, production build preparation, review rule generation, frontend candidate preparation or activation-preflight preparation. `reviewV1ReleasePreparation()` checks only the nine owner-approved preparation items and reviewed V1 policy identity; it does not require an address or claim counsel approval.

The existing public-launch gate still requires an approved address decision or explicit legally reviewed alternative/not-required disposition. That question remains separately outstanding. No such disposition is fabricated here, and production routes remain unavailable/noindex under the current publication gate. Unresolved review markers are not published as a substitute address to end users.

## One date input and reviewed local application

The only owner input for this mechanism is `TAKEME_V1_LAUNCH_DATE`, the actual approved public launch date in exact YYYY-MM-DD. There is no current date, staging/draft fallback, clock calculation or runtime activation override. Both dates in all four documents resolve through the existing `legalPublicationReadiness` pair. The new planner validates a real calendar date and checks all eight fields against that same input. A separate last-updated date would require a later explicitly approved change to this V1 mechanism.

The owner supplied and approved `2026-10-12` for RC preparation. A private proposal was generated, its original/proposed hashes reviewed, and only its shared date pair applied. All eight current fields match; publication remains false. The planner now refuses to overwrite this dated source. The original, already executed proposal workflow is retained below for audit context; it is not a command to rerun or activate:

Before that application, Codex could prepare a local proposal with the installed Node 22, using a **new file in an existing directory outside every Git checkout**:

```sh
TAKEME_V1_LAUNCH_DATE='<owner-approved YYYY-MM-DD>' /opt/homebrew/opt/node@22/bin/node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prepare-v1-legal-launch.mjs --output /private/tmp/<new-reviewed-date-proposal>.json
```

This proposal command was run privately with the approved date during the RC task; it was not a cloud apply operation. It writes a private review JSON only; it has no apply mode, SDK, cloud operation or approval override. It refuses missing/invalid dates, in-Git output, existing output files, or an already dated/published central source. The proposal records the exact before/after pair, original/proposed SHA-256, all eight dates and the future six-field policy candidate.

Future application is explicit and reviewable: verify the original central source hash against the proposal, apply **only** its `effectiveDate: null, lastUpdated: null` → approved equal-date pair in `functions/src/legal-publication.ts`, then compare the proposed hash. Do not overwrite changed source, use stale proposals, or set any approval flag as part of this date edit. Verify actual Terms/EN/BM/Prohibited dates after the edit and regenerate/review the final artifacts only under later approval. The isolated-copy test proves propagation through the real modules without changing the checkout or publication flags.

## Future policy record and publication conditions

The exact future `releasePolicies/current` record is:

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

`prepareV1PolicyRecord()` derives identity and versions from the existing central sources and validates this six-field candidate with the existing trusted runtime schema. This is a proposed object, never a write or a publication permission. Existing create-only bootstrap/readback and resource checks remain mandatory later; do not add dates, approval notes or other fields to the runtime record.

Before changing publication to true, all must hold:

1. Final owner and counsel legal/content approval is complete, with recorded evidence.
2. The actual owner-approved launch date is supplied and valid.
3. The approved public address/alternative decision is complete.
4. All A–S legal issues are resolved or explicitly accepted with a recorded review reference.
5. All eight source date fields equal the approved date.
6. All seven final candidate legal/support routes pass publication checks.
7. The final frontend artifact is built and verified, including production resource/provenance guards.
8. Final policy and Firestore/Storage artifacts are regenerated, validated and aligned.
9. Independent owner production-activation approval is granted.

`reviewV1PublicationGate()` reports every unmet publication condition. The current record has the nine owner preparation approvals checked, counsel boxes unchecked and separate launch decisions pending. `pendingV1LaunchApprovals` is only a blank test/template record, not the owner's current status. Neither preparation review nor the current owner record changes existing runtime publication guards, grants counsel authority or bypasses activation prechecks. Domain-cutover approval is separately required later; it is not inferred from content approval or technical readiness.

## Final candidate route and indexing checks — future execution

| Route | Required final candidate evidence |
| --- | --- |
| `/terms` | Terms1.0, operator/SSM/contact/disclosure, equal dates, Privacy/Prohibited/deletion links, approved publication text |
| `/privacy` | Privacy1.0, identity/disclosure/dates, Terms/deletion links, EN/BM selector, final provider/rights/retention text |
| `/privacy/bm` | Privacy1.0, matching dates/identity, approved translation parity, EN link, final BM publication text |
| `/help/prohibited-items` | Terms-linked version1.0, identity/disclosure/dates, Terms/Privacy/reporting links, approved category/enforcement text |
| `/help` | Accurate current product help, legal/deletion/contact links, no staging/draft/unsupported claims |
| `/contact` | Confirmed operator/SSM/support/privacy/disclosure, correct mail links, no draft banner or invented address |
| `/account-deletion` | Secure owner path and accurate delay/retention caveats; deletion execution stays separately gated |

Check direct loads, navigation, canonical/alternate metadata, mobile 390×844 and430×932, desktop1440×900, heading/contents readability and accessible links. Version/date checks apply to the four policies; support/deletion pages must link to the correct current documents rather than invent document dates. Record actual rendered final-artifact evidence for every route; source tests/local draft previews alone do not complete this gate.

Current Terms/EN/BM/Prohibited drafts remain noindex/nofollow. Their existing metadata builders become indexable only through independently approved publication; BM additionally requires its final approval/content guard. Preserve draft robots now. Rebuild and inspect final emitted robots/canonical/EN–BM alternates when approved. Keep the account-deletion page's existing appropriate noindex behavior; do not make sensitive account flows indexable. Do not apply a blanket indexing change to Help/Contact or private routes.

## Acceptance UX, migration and evidence

Production onboarding resolves trusted current Terms/Privacy1.0 and minimumAge18. Links remain `/terms` and `/privacy`, with BM through the Privacy selector. The server requires explicit `acceptTerms`, `acceptPrivacy` and `confirmAge18`; unchecked, mismatched-version and revoked/lifecycle-invalid requests fail. Public browser navigation and authentication do not call acceptance automatically.

Outdated/unaccepted existing users may browse; protected actions require genuine reacceptance. Current1.0 users may write only after normal ownership/authorization, lifecycle and maintenance checks. No profiles, listings or messages are reset during reacceptance. Accepted return intent navigates to context, not an automatically executed Sell/Chat/Offer/Bid/Save/Follow operation.

`auth-onboarding.ts` creates private immutable acceptance events transactionally, separately from the bounded current onboarding/eligibility projection. New evidence contains Terms/Privacy versions,18+ confirmation, server timestamps, web source and server-derived release/project context. Same logical acceptance keeps its original event/time; version migration adds history rather than overwriting it. Legacy evidence is copied only if genuine existing evidence is complete, during explicit acceptance, without inventing original time/provenance. Client history writes remain denied. This is implementation verification, not permission to alter retention or activate production policies.

## Internal approval record — owner approved, counsel outstanding

Approval reference: the owner's “APPLY FINAL OWNER APPROVALS FOR TAKEME V1 LEGAL CONTENT” instruction. The launch date `2026-10-12` is separately owner approved and applied locally; it does not approve publication or activation. Content and strategy approval is not a checked publication, activation or domain-cutover box.

OWNER APPROVES:

- [x] Terms 1.0
- [x] Privacy EN 1.0
- [x] Privacy BM 1.0
- [x] Prohibited Items 1.0
- [x] Product policy model
- [x] Public-browsing migration
- [x] Immutable acceptance history
- [x] Protected-write maintenance strategy
- [x] Production activation runbook

ADDRESS:

- [ ] Intentionally unresolved/deferred; no address supplied

LAUNCH DATE:

- [x] Owner-approved `TAKEME_V1_LAUNCH_DATE=2026-10-12`; eight local source fields verified

PRODUCTION ACTIVATION:

- [ ] Separate explicit approval required

DOMAIN CUTOVER:

- [ ] Separate explicit approval required

The statutory retention/deletion and other external legal decisions remain unresolved; current model approval does not invent their final legal disposition.

LEGAL / COUNSEL APPROVES:

- [ ] Terms
- [ ] Privacy EN
- [ ] Privacy BM
- [ ] Seller disclosures, individual/business/Bahasa Malaysia
- [ ] Retention/deletion reconciliation
- [ ] Providers/transfers
- [ ] Rights/breach/DPO
- [ ] Liability/indemnity
- [ ] Prohibited/regulatory categories and enforcement

## Next preparation input and later execution authority

The next primary owner input is **`TAKEME_V1_LAUNCH_DATE`**, the actual owner-chosen public launch date. Do not choose it automatically. Engineering may prepare and qualify local candidate source/builds/review rules with address deferred and publication OFF; a compiled preparation candidate is not a publicly approved release. The following final publication/execution sequence remains separately gated:

1. Apply the approved equal launch-date pair and approved disclosure/final wording through reviewed local edits.
2. Regenerate and inspect legal metadata/publication candidate, including body text and EN/BM parity.
3. Regenerate final policy/rule artifacts; verify exact runtime schema/source consistency.
4. Build and qualify the final frontend artifact with existing release/Worker/assets guards.
5. Run final app/legal/policy/Functions/rules/auth/retention tests and final route/responsive smoke.
6. Verify compatible rollback artifacts and unchanged deletion/payment defaults.
7. Run the final activation precheck: zero active auctions, creation-freeze strategy, maintenance,900-second drain, resource identity, deployed parity and explicit approval gates.
8. Request owner GO on concrete artifacts and the unchanged [36-step activation runbook](v1-production-activation-runbook.md).
9. Execute only separately approved coordinated production steps under that runbook, with fail-safe/open-ended abort/recovery. Never infer TTL, schedules, deletion, payments or domain authority.
10. Perform bounded authorized smoke checks and monitor/recover against the approved runbook.
11. Prepare and obtain separate production domain-cutover approval, preserving Netlify rollback.

No final build, rule regeneration, production or activation step is executed by this owner-approval recording task. The technical runbook remains intact and owner-approved; counsel review and final activation inputs remain outstanding. Publication and production activation are blocked.

## Previous preparation checkpoint evidence

- App suite: 413 cases,411 passed,0 failed,2 existing capture-dependent maintenance-bridge tests skipped because previously reviewed private captures are absent. These skips are not new legal tests and do not establish live bridge parity.
- Focused legal/date suite:104 passed; included in the final app run. Seven new launch-gate cases cover real-module date propagation in an isolated copy, missing/invalid inputs, disclosure approvals, exact policy schema, independent gate failures and proposal-only CLI safety.
- Functions TypeScript build and offline tests:165 passed, including current eligibility, immutable history and reacceptance handlers.
- App TypeScript, full ESLint and whitespace/diff review:passed.
- Diff review proved the four approved legal sources differ only in centralized disclosure metadata wiring. All section prose, titles, links and legal-review wording remain unchanged; pending rendered disclosure stays identical. Central actual dates/publication/policy, rules, operator/social URLs and the final technical runbook are unchanged.
- Main HEAD/ref remain `cfedcd26ad7288e97caa4a003eac54223a3f58fa`; its pre-existing review/probe changes remain untouched. Qualification HEAD remains the baseline above. No staging, commit, push, deployment or production access occurred.
- No credential-pattern matches in the ten changed source/test/documentation files. Test-owned temporary proposals/module copies are removed; ignored dependency/build/type-generation outputs remain outside the changed-file set.

Final rendered publication checks and final-artifact qualification are future gates, not claimed complete from these local tests. Source OFF state is verified; deployed production state is not re-read.

## Owner-approval recording verification

- App/legal/policy suite: 417 cases,415 passed,0 failed,2 pre-existing maintenance-capture tests skipped because private captures are unavailable. All 165 Functions tests and their TypeScript build passed. App TypeScript, full ESLint and diff review passed.
- Four new cases verify current owner approval independently of counsel; approval cannot carry to another version; deferred address/counsel do not block preparation; publication/robots/runtime policy remain closed; and the existing production build validator accepts preparation without an address. Date proposal tests also verify truthful owner/counsel status in review output.
- Terms, EN Privacy, BM Privacy, Prohibited Items, disclosure state, actual publication/dates/policy, Firestore/Storage rules, operator/social URLs and the technical runbook remain byte-for-byte unchanged from the preparation checkpoint. No business address or substitute is supplied.
- Launch date remains unset, no runtime policy is written, activation/cutover boxes remain unchecked, and no counsel box is completed. Main HEAD/ref and its pre-existing review/probe changes are unchanged. No commit, push, deployment, production access or hosting/DNS operation occurred.
- Changes are limited to the owner approval source, internal launch-gate record, proposal status reporting, two affected test files and this checklist. Test-owned temporary proposals are removed; no private/generated artifact enters the changed-file set.

**Owner content: APPROVED. Counsel: OUTSTANDING. Business address: DEFERRED. Publication: BLOCKED. Next primary owner input: TAKEME_V1_LAUNCH_DATE. Safe to prepare a local final release candidate: YES; safe to publish/activate: NO.**
