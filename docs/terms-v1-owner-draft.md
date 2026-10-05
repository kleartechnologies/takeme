# TAKEME Terms of Service v1.0 — owner draft preparation

This local work starts from approved owner-policy checkpoint `4f9c35bee362bfec9d9df4f083410426d74c9848`. The owner explicitly approved using the current Terms implementation request and the existing reviewed Terms as the wording source. The 35-section content is prepared from those sources; it is not a reproduction of a separate, unseen document.

Owner approval covers the draft content model. Malaysian legal counsel approval, publication, policy activation and production cutover remain separate decisions. No commit, push, deployment or production operation is part of this preparation.

## Source and approval state

`src/content/terms.ts` exports the document model and the 35 ordered sections. Version `1.0` and minimum age `18` come from `productionReleasePolicy`; operator name, SSM and support come from the existing central operator source. No second policy-version system is introduced.

- Operator: TAKEME TECHNOLOGIES; SSM: KT0622373-U; support: support.takeme@gmail.com.
- `productionReleasePolicy.publicationApproved` remains `false`.
- `legalPublicationReadiness.publicationApproved` and `finalContentApproved` remain `false`.
- Effective date and last-updated date remain `null`. The existing launch-date rule requires the actual owner-approved public launch date, with last updated using the same date unless separately changed.
- The business address remains absent and explicitly marked `LEGAL REVIEW / OWNER INPUT REQUIRED`. No private or home address is substituted.
- No `releasePolicies/current` record is read, created or activated by this work. The record's previously qualified absent/inactive status is not rechecked against production.
- Production deletion execution, rules, serving Functions and activation configuration are unchanged.

## Ordered Terms structure

| Sections | Content |
| --- | --- |
| 1–5 | About TAKEME; Eligibility; Browsing Without Acceptance; Your TAKEME Account; One Account for Buying and Selling |
| 6–10 | Role of TAKEME; Seller Obligations; Listings; Prohibited and Restricted Items; Offers and Negotiations |
| 11–15 | Auctions; Messaging; User Content; Intellectual Property; Counterfeit and Infringing Goods |
| 16–20 | Reviews and Ratings; Complaints and Reports; Records and Legal Retention; Privacy; Account Suspension and Restrictions |
| 21–25 | Account Deletion; Marketplace Safety; Payments Between Users; Shipping, Delivery and Collection; Fees |
| 26–30 | Third-Party Services; Service Availability; No Guarantee of Transactions; Limitation of Liability; Indemnity |
| 31–35 | Changes to These Terms; Governing Law; Severability; No Waiver; Contact |

The model preserves public browsing without current acceptance and requires explicit current Terms/Privacy acceptance and 18+ confirmation before protected marketplace writes. Login, refresh and browsing do not imply consent. Return intent restores context without executing an action. One account supports buying and selling; normal welcome points to Explore and selling remains optional.

TAKEME provides the marketplace platform; third-party sellers remain responsible for their items and users arrange their exchanges. The source does not claim current integrated protected checkout, escrow, Stripe Connect, payouts, shipping/AWB, Seller Centre or live/short-video commerce. Future references are conditional. Auction and offer outcomes do not guarantee payment or completion. The content licence remains operational and limited; ownership stays with the user, and private messages are not public promotional material.

## Unresolved legal decisions

Explicit review markers remain for the publishable business address, seller disclosure fields and individual/business requirements, national-language disclosures, intermediary/operator obligations, provider/cross-border wording, final prohibited-items approval, limitation of liability and indemnity scope. Malaysian law is stated without adding a new exclusive court/forum clause, and mandatory consumer rights are preserved.

The retention section conditionally identifies a possible three-year record requirement. [Regulation 8 of the official 2024 Electronic Trade Transactions Regulations](https://repositori.kpdn.gov.my/bitstream/123456789/5299/1/PERATURAN%20URUSNIAGA%20PERDAGANGAN%20DALAM%20ELEKTRONIK%202024.pdf) is the review reference. Counsel must determine applicability, required record categories and retention start point for TAKEME and reconcile them with the implemented deletion/retention model. No retention period, cleanup schedule or legal-hold mechanism is changed here.

The deletion section distinguishes current implemented pending conditions from possible legal, fraud/security or statutory constraints needing review. It does not promise immediate erasure in every case or claim that every legal hold is already an automatic blocker. Existing conservative liability wording is retained without a new cap or broader exclusion; the unresolved indemnity section adds no defence or open-ended reimbursement obligation.

English and BM Privacy content are unchanged. Terms link to the existing Privacy route; no notice or translation is drafted or finalised in this task.

## Route and metadata

`/terms` retains the existing `requireLegalInformation` rendering gate and central legal-document state. The page displays intended version 1.0, pending actual-launch dates and an unpublished owner-review notice without staging text. The optional `reviewNotice` renderer prop changes only this Terms notice; other information pages retain their existing default notice.

`src/lib/terms-metadata.ts` prepares the exact title, description, canonical `/terms` and Open Graph metadata. Robots follow the existing production-publication result; current draft output is `noindex, nofollow`. Metadata does not grant permission to render or publish. No publication gate is bypassed.

## Local verification

Verified with the installed Node 22.23.2, without installing dependencies or changing global configuration:

- Full app suite: **260 passed**, including **18 focused Terms tests**.
- TypeScript `--noEmit`: passed; full ESLint: passed; diff whitespace check: passed.
- Browser render at **390×844** and **1440×900**: all 35 sections, readable layout, no horizontal overflow, no hydration errors, draft/noindex output, no invented dates or staging text.
- Mobile contents navigation reaches the correct heading and moves focus; desktop contents navigation remains available.

The local render used explicit `demo-takeme` emulator mode only. No production Firebase request, cloud operation or SDK/config change was needed. Screenshots and logs remain outside Git in the private temporary verification directory.

## Changed files

- `src/content/terms.ts`
- `src/app/terms/page.tsx`
- `src/components/public-information/public-information.tsx`
- `src/lib/terms-metadata.ts`
- `tests/terms-v1.test.mts`
- `docs/terms-v1-owner-draft.md`

Terms v1.0 owner draft: **ready for owner review**. Legal counsel review: **required**. Publication: **blocked**. Safe to activate Terms 1.0: **no**.
