# V1 final owner/legal launch gate

Local preparation based on `07a420acb59304325c13d2245691a074e8d83ae4`. This checklist grants no production authority. No date, publication approval, runtime policy, rules, Functions, deletion, payments, TTL, schedule, domain or hosting change is applied. No live production inspection is performed; absent/inactive `releasePolicies/current` and production OFF state remain the previously approved baseline, not a new live readback.

## Verified source and product model

| Document | Version | Publication | Effective date | Last updated |
| --- | --- | --- | --- | --- |
| Terms | 1.0 | false | null | null |
| Privacy EN | 1.0 | false | null | null |
| Privacy BM | 1.0 | false | null | null |
| Prohibited Items | 1.0, linked to Terms | false | null | null |

The shared production policy is Terms 1.0 / Privacy 1.0 / minimumAge 18, publication false. Operator: TAKEME TECHNOLOGIES, SSM KT0622373-U; support/privacy contact: support.takeme@gmail.com. All approved sections, review markers and social URLs are preserved. Only the four documents' address metadata is wired to one unresolved source; their rendered metadata and wording remain unchanged.

V1 permits public browsing without current acceptance. Sell, Chat, Offer, Bid, Save, Follow, uploads and other protected writes require current acceptance plus normal authorization, lifecycle and maintenance checks. Login, refresh and browsing do not establish consent. Existing-user reacceptance preserves profile/content and profile/welcome completion. Return intent resumes context without executing an action. One TAKEME account can buy and sell. Current V1 does not provide integrated TAKEME checkout/payment processing, seller payouts, shipping/AWB, Seller Centre or live/short-video commerce. Production deletion remains independently gated. No product-model contradiction was identified in the reviewed sources.

## External legal checklist — every item outstanding

Record a final owner/counsel decision and review reference for each item. An explicitly accepted unresolved issue needs a documented counsel/owner disposition; technical tests or a preparation approval are insufficient. No legal rule, deadline, exemption, retention requirement or acceptable alternative is assumed here.

| ID | Required final decision | Status |
| --- | --- | --- |
| A | Terms v1.0 final legal approval | Outstanding |
| B | English Privacy v1.0 final legal approval | Outstanding |
| C | BM Privacy v1.0 final legal approval and EN/BM parity | Outstanding |
| D | Prohibited Items v1.0 final legal approval | Outstanding |
| E | Public business/correspondence address or legally approved alternative | Outstanding |
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

The drafts still contain explicit draft/unpublished/pending-date and LEGAL REVIEW wording within their body paragraphs. Switching a publication flag hides the shared review banner and removes “draft” from link labels; it does **not** remove these paragraphs. Final owner/counsel-approved publication text must resolve this contradiction and be re-reviewed before a final candidate can pass the route checks. No automated prose stripping is authorized or implemented.

## One public disclosure insertion point

`src/content/operator-disclosure.ts` holds `operatorDisclosureDecision`, currently kind `unresolved`, English/BM text null, both approval flags false. All four legal records use its fail-closed resolver. A later approved decision can be either `address` or `reviewed-alternative`, with exact reviewed English/BM text and explicit owner approval for public use and counsel approval. Unapproved/blank/malformed text remains unpublished and the documents keep their existing unresolved markers in each language. An alternative does not fabricate an address; BM wording is not generated or guessed.

Do not use a home address, infer an address from registration/account data, or publish an SSM address without specific owner public-use approval. Final EN/BM prose must accurately describe the selected decision; a central metadata change alone does not approve the surrounding publication wording. `legalPublicationReadiness.address` remains pending until this separate decision is reviewed.

## One date input and exact future application

The only owner input for this mechanism is `TAKEME_V1_LAUNCH_DATE`, the actual approved public launch date in exact YYYY-MM-DD. There is no current date, staging/draft fallback, clock calculation or runtime activation override. Both dates in all four documents resolve through the existing `legalPublicationReadiness` pair. The new planner validates a real calendar date and checks all eight fields against that same input. A separate last-updated date would require a later explicitly approved change to this V1 mechanism.

After the owner supplies and approves the date, Codex can prepare a local proposal with the installed Node 22, using a **new file in an existing directory outside every Git checkout**:

```sh
TAKEME_V1_LAUNCH_DATE='<owner-approved YYYY-MM-DD>' /opt/homebrew/opt/node@22/bin/node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prepare-v1-legal-launch.mjs --output /private/tmp/<new-reviewed-date-proposal>.json
```

This future command is not run with a real date now. It writes a private review JSON only; it has no apply mode, SDK, cloud operation or approval override. It refuses missing/invalid dates, in-Git output, existing output files, or an already dated/published central source. The proposal records the exact before/after pair, original/proposed SHA-256, all eight dates and the future six-field policy candidate.

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

`reviewV1PublicationGate()` reports every unmet condition; its default approval record has no completed boxes. This preparation helper does not change existing runtime publication guards, grant legal authority or bypass activation prechecks. Domain-cutover approval is separately required later; it is not inferred from legal publication or technical readiness.

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

## Internal final approval record — unchecked

For each completed item record approver, decision date and durable review reference. The final date is not filled now. A preparation checkpoint is not a checked launch box.

OWNER APPROVES:

- [ ] Terms1.0
- [ ] Privacy EN1.0
- [ ] Privacy BM1.0
- [ ] Prohibited Items1.0
- [ ] Address/disclosure decision
- [ ] Retention decision
- [ ] Launch date
- [ ] Production activation
- [ ] Domain cutover, separately after application qualification

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

## Engineering after final legal inputs and separate authority

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

None of these final-candidate/production steps is executed in this preparation task. The technical runbook remains intact; legal approval and final activation inputs remain outstanding. Publication and production activation are blocked.

## Local verification and limits

- App suite: 413 cases,411 passed,0 failed,2 existing capture-dependent maintenance-bridge tests skipped because previously reviewed private captures are absent. These skips are not new legal tests and do not establish live bridge parity.
- Focused legal/date suite:104 passed; included in the final app run. Seven new launch-gate cases cover real-module date propagation in an isolated copy, missing/invalid inputs, disclosure approvals, exact policy schema, independent gate failures and proposal-only CLI safety.
- Functions TypeScript build and offline tests:165 passed, including current eligibility, immutable history and reacceptance handlers.
- App TypeScript, full ESLint and whitespace/diff review:passed.
- Diff review proved the four approved legal sources differ only in centralized disclosure metadata wiring. All section prose, titles, links and legal-review wording remain unchanged; pending rendered disclosure stays identical. Central actual dates/publication/policy, rules, operator/social URLs and the final technical runbook are unchanged.
- Main HEAD/ref remain `cfedcd26ad7288e97caa4a003eac54223a3f58fa`; its pre-existing review/probe changes remain untouched. Qualification HEAD remains the baseline above. No staging, commit, push, deployment or production access occurred.
- No credential-pattern matches in the ten changed source/test/documentation files. Test-owned temporary proposals/module copies are removed; ignored dependency/build/type-generation outputs remain outside the changed-file set.

Final rendered publication checks and final-artifact qualification are future gates, not claimed complete from these local tests. Source OFF state is verified; deployed production state is not re-read.
