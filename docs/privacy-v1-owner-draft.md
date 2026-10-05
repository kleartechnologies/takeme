# TAKEME English Privacy Notice v1.0 — owner draft preparation

This is a local English-only draft based on the owner's implementation request, the existing reviewed Privacy source and a read-only audit of actual V1 source. It follows the prepared Terms owner draft at owner-policy checkpoint `4f9c35bee362bfec9d9df4f083410426d74c9848`. The Terms files remain unchanged by this task. English legal approval, BM wording, publication and activation remain independent unresolved decisions.

No production access, policy-record write, rules/Functions/frontend deployment, deletion activation, cloud/DNS change or push is performed. A local preparation commit is separately owner-approved; it grants no publication or activation permission. The previously qualified absent/inactive production policy state is not rechecked remotely here.

## Identity and central state

`src/content/privacy.ts` exports `privacyDocument` and 29 ordered sections. The title is **TAKEME Privacy Notice**, language English, intended version **1.0** and minimum age **18**. Versions/age use the existing central `productionReleasePolicy`; dates use `legalPublicationReadiness`; business identity/contact use `marketplaceOperator`.

Operator: **TAKEME TECHNOLOGIES**; SSM Registration No. **KT0622373-U**; privacy/support: **support.takeme@gmail.com**. Business/correspondence address remains absent and marked **LEGAL REVIEW / OWNER INPUT REQUIRED**. No private/home address is inferred.

Both production policy and legal publication approval remain `false`; final-content and BM approvals remain `false`; effective and last-updated dates remain `null`. The actual public launch date must be supplied and independently approved; V1 last updated uses that date unless separately changed. Prepared identifiers do not activate acceptance or create `releasePolicies/current`.

## Notice structure

| Sections | Coverage |
| --- | --- |
| 1–5 | Who We Are; Scope; Personal Data Categories; User-Provided Data; Account and Authentication |
| 6–10 | Profile; Listing/Product Content; Messaging/Offers/Auctions; Saved/Following/Preferences; Technical/Security Data |
| 11–15 | Support/Reports/Disputes; Policy Acceptance Evidence; Uses; Legal/Compliance/Security Purposes; Marketplace Operation |
| 16–20 | Personalisation/Discovery; Fraud/Abuse Prevention; Service Providers; Sharing; International/Cross-Border Processing |
| 21–25 | Retention; Account Deletion; Legal Holds/Disputes/Backups/Logs; Security; Applicable User Rights |
| 26–29 | Children/Minimum Age; Browser Storage/Cookies/Analytics; Changes; Contact |

## Actual data-practice findings

| Practice | Verified source and disclosure boundary |
| --- | --- |
| Account/authentication | Firebase email/password and Google sign-in process email, UID/provider identity, status/timestamps and chosen profile information. Credentials are handled by Firebase Auth, not marketplace profile/message storage. See `src/lib/firebase/client.ts`, `auth.ts`, profile bootstrap and account lifecycle source. |
| Public/private profile | Public seller projection exposes approved display/photo/general-area/reputation fields. Email, private address, onboarding/acceptance state, Saved/follow relationships and restricted evidence are outside ordinary public projections. Follower counts are aggregate. See `functions/src/public-sellers.ts`, public-seller/general-location domain and location services. |
| Location and images | General areas and meet-up snapshots are explicitly user-entered/selected. No GPS collection. Private addresses are not auto-published. Listing photos are processed; avatar upload sends the selected file, so the Notice does not promise all images strip embedded metadata. |
| Marketplace interactions | Listings/photos, bids/results, offers/counters, agreement amounts, confirmations, reviews, private plain-text messages and read/open notification activity are implemented. Arrangement amounts/labels are not payment-card processing or platform payment receipts. |
| Promotion requests | Reachable owner UI can save a seller/listing/package request with example price/duration, setup status and timestamps. The Notice includes this collection while preserving that checkout/payment/paid activation are unavailable and no placement is purchased by saving a request. See `promotion-flow.tsx` and `functions/src/promotions.ts`. |
| Messages/case review | Participants have ordinary private-message access. Authorised relevant bounded context can be reviewed for reported concerns/support/disputes. No routine reading of all messages is claimed. Current messenger attachments, typing indicators and read receipts are unavailable. |
| Discovery | Authenticated marketplace signals, interests, actually served recommendations, Not interested/Undo and click/save attribution are supported. These are TAKEME marketplace signals, not cross-website advertising profiles. See intelligence/discovery-session source. |
| Technical/security | Operation IDs/timestamps, bounded quotas/upload permits and outcomes are supported. No app-source exact IP collection, device fingerprint, advertising ID or device-contact collection was found. Providers' network/browser/request processing is separately described. Query-deduplication hashes are not device fingerprints. |
| Notifications | In-app Updates/preferences are supported. Native push, marketplace email/SMS delivery and daily digest collection are not current web features; Auth reset email is separate. |
| Browser storage/analytics | Firebase Auth default browser persistence is used. No first-party cookie/localStorage/sessionStorage calls, Firestore persistent-cache opt-in, Firebase Analytics initialization, marketing pixel or advertising tracker was found. The staging-only Access cookie is not disclosed as a production customer cookie. |
| Support/providers | Published Gmail contact, Firebase/Google backend and reviewed Cloudflare hosting architecture are identified. Netlify remains temporary hosting/rollback. No support-ticket SaaS, unverified processing country or all-services location guarantee is invented. |

The Notice states TAKEME does not sell personal data to advertisers or as a marketplace service. It does not claim active card processing, Stripe payouts, shipping/AWB, Seller Centre, video/live commerce, push tokens or future V2 analytics.

## Acceptance and eligibility

The existing server architecture is unchanged. Private immutable acceptance history records Terms/Privacy versions, explicit 18+ confirmation, server timestamps, web source and supported release context. The bounded current projection establishes eligibility. History is immutable during ordinary acceptance/reacceptance, not a permanent retention exemption; account cleanup removes it.

Signup confirms 18+ without collecting DOB or independently verifying age. Login, refresh, status checks and browsing do not imply consent. Missing/outdated users may browse public marketplace content, but protected Sell/Chat/Offer/Bid/Save/Follow/uploads require current explicit acceptance. Return intent restores context without executing the action. No internal storage path or sensitive session/header/token detail is published.

## Retention and deletion limits

The Notice describes the technically implemented, owner-approved deletion treatment without changing it:

- Deletion operation/audit data: 30 days after successful completion.
- Surviving counterparty messages: up to 90 days after related deal closure; no-deal history within 90 days of cleanup, with restricted evidence exceptions.
- Minimal pseudonymised marketplace history: 12 calendar months under the existing clocks; deal-linked history uses closure while some associated history uses cleanup.
- Closed report/dispute evidence: up to 180 days after closure. Open cases can await valid resolution before closure-based expiry is set.
- Explicit security/fraud holds: documented purpose, restricted access and expiry; no indefinite default preservation.

These are deletion-related rules, not global active-account purge promises. Pseudonymised is not universally anonymous, and an expiry field is not evidence that every physical copy is erased. Actual marketplace pending conditions and conditional legal/statutory obligations are distinguished. Final success requires cleanup and Auth deletion; production execution remains off.

Protected backups/logs are outside synchronous live deletion. Deletion-safe restoration is an approved operational requirement rather than a certified automatic recovery mechanism. Statutory retention, case/hold handling, log/backup periods and deletion conflicts remain **LEGAL REVIEW REQUIRED**. No duration or backend schedule is changed.

## Providers, rights and legal review

Final provider details, transfer conditions/locations, statutory rights/exceptions/request process, breach notification, DPO applicability, address, retention reconciliation and final English/BM wording remain **LEGAL REVIEW REQUIRED**. User-rights language is conditional under applicable Malaysian law and provides the existing contact/ownership-check path; it promises no universal GDPR-style rights or invented response deadline.

Primary references support review, not a claim of legal compliance:

- [Firebase privacy/security](https://firebase.google.com/support/privacy) and [Firebase Auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence): provider technical processing and browser authentication persistence are distinct from app data collection.
- [JPDP privacy-notice guide](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/01/A-Quick-Guide-to-PRIVACY-NOTICE.pdf) and [notice-preparation guidance](https://www.pdp.gov.my/jpdpv2/assets/2022/01/Panduan-Penyediaan-Notis-PDP-2022-compressed.pdf): final disclosure/rights and English/BM completeness require review.
- [JPDP official Act and related instruments](https://www.pdp.gov.my/ppdpv1/en/akta/pdp-act-2010-en/): counsel must determine applicable current rights, transfer, breach and DPO duties.

## Route, metadata and BM wiring

`/privacy` retains the existing legal-render/publication gates, exact title, central intended version 1.0, unresolved launch dates and a draft notice with no staging text. Metadata prepares the canonical English route and Open Graph fields; draft robots remain `noindex, nofollow`. Missing/unapproved BM is not advertised as a published hreflang alternate.

`/privacy/bm` keeps its existing approval-required placeholder; no BM text or translation is created. The language selector offers the explicitly labelled placeholder only in an authorised draft preview. Outside preview, missing/unapproved BM is an unavailable label. Actual nonempty BM content plus approval and all publication gates remain necessary before production rendering. Terms and its cross-references were not changed.

## Local verification

Installed Node 22.23.2 only; no installs, global configuration or environment-file changes.

- Combined reviewed worktree app suite: **285 passed**, including **25 focused Privacy groups** and the prior uncommitted Terms/legal/policy tests.
- Independent staged Privacy snapshot: **267 app tests passed**, including all 25 Privacy groups. Installed Next route type generation, TypeScript and full ESLint passed without the uncommitted Terms source/routes/tests. This proves the eight-file Privacy/dependency commit is self-contained.
- Functions build and suite: **142 passed**, including existing acceptance/history/eligibility behavior; no Functions source change.
- TypeScript `--noEmit`, full ESLint and diff whitespace review: passed.
- Local explicit `demo-takeme` browser render at **390×844** and **1440×900**: 29 sections, readable layout, no horizontal overflow, no invented date or staging text, draft/noindex and no hydration errors.
- Mobile contents moves focus to the correct Contact heading; client navigation to the unapproved BM placeholder and back to English works.

Screenshots/logs remain outside Git in the private temporary verification directory. The temporary review server and viewport override are cleaned up after verification; unrelated local services and review files are preserved.

## Files changed by this task

- `src/content/privacy.ts`
- `src/app/privacy/page.tsx`
- `src/components/public-information/privacy-languages.tsx`
- `src/lib/privacy-notice.ts`
- `src/lib/privacy-metadata.ts`
- `tests/privacy-v1.test.mts`
- `docs/privacy-v1-owner-draft.md`

The Privacy-only preparation commit also includes the previously reviewed optional `reviewNotice` extension in `src/components/public-information/public-information.tsx`. This small shared dependency is required for the approved Privacy notice to compile and render without staging text when checked out independently. Its default notice is unchanged. Terms source, route, metadata, tests and review documentation remain outside the Privacy commit and are not rewritten.

English Privacy v1.0 owner draft: **ready for owner review**. Legal counsel review: **required**. BM Privacy: **blocked**. Publication: **blocked**. Safe to activate Privacy 1.0: **no**.
