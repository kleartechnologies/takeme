# TAKEME Bahasa Melayu Privacy Notice v1.0 — owner draft preparation

This local work translates the approved English Privacy v1.0 source at `0466426ba873c3942fd4c7f50e742b3b5b697213`, following the owner-policy checkpoint `4f9c35bee362bfec9d9df4f083410426d74c9848`. Terms v1.0 at `9ecf354d4b8de1d34b21653f1c8a6cf11a64f44c` is unchanged.

The owner separately approved replacing only the stale English section 28 sentence with: “The Bahasa Melayu owner draft remains subject to final legal review and is not approved for publication.” No other English Privacy wording is changed.

## Shared source and approval state

`src/content/privacy-bm.ts` supplies the 29 Bahasa Melayu sections and document model. The English and BM sources share the same central Privacy version `1.0`, minimum age `18`, operator and launch-date state. Operator: TAKEME TECHNOLOGIES; SSM: KT0622373-U; privacy/support: support.takeme@gmail.com.

- `productionReleasePolicy.publicationApproved` remains `false`.
- Legal publication, final content and final BM legal approval remain `false`.
- Effective date and last updated remain `null`; the route shows unresolved actual-public-launch dates in BM.
- Business/correspondence address remains `null` and requires owner/legal input. The underlying English status metadata is preserved and its BM display remains visibly unresolved.
- No production policy record is read, written or activated. Previously qualified absent/inactive `releasePolicies/current` is not remotely rechecked.
- Backend retention, deletion activation, payments, rules and Functions are unchanged. No deployment, cloud configuration change or production request is part of this task.

## Translation scope and parity

The BM draft mirrors all 29 English topic IDs in the same order, with matching paragraph/list topology and link destinations. Product labels such as Chat, Saved, Updates and Settings are retained where they refer to the existing English interface. Provider names and technical product names remain recognisable.

The translation preserves the public marketplace/private account distinction; explicit Terms/Privacy/18+ evidence; supported marketplace purposes; limited case review; no personal-data sale to advertisers; provider/transfer qualifiers; conditional Malaysian-law rights; no absolute-security guarantee; and no current payment, shipping, Seller Centre, live/video or native-push claims.

The existing deletion-related retention model is translated without changing it: 30-day successful operation/audit cleanup, up to 90-day counterparty messages with the relevant deal/cleanup clocks, 12 calendar months for minimal pseudonymised history and up to 180 days after closed cases. Open cases, lawful restrictions, limited backups/logs and deletion-safe restoration remain qualified. Pseudonymised does not imply anonymous, and expiry does not prove every physical copy has disappeared.

Acceptance history remains immutable during ordinary acceptance/reacceptance, subject to deletion cleanup; current eligibility is bounded. Login, refresh and browsing do not create consent. Missing/outdated acceptance allows public browsing but blocks protected writes. Return intent restores context without automatically executing a marketplace action.

## Legal review remains required

Visible BM markers use `SEMAKAN UNDANG-UNDANG DIPERLUKAN`. Address input uses `SEMAKAN UNDANG-UNDANG / INPUT PEMILIK DIPERLUKAN`. Final English/BM legal approval, publishable address, provider and cross-border arrangements, statutory rights, Malaysian marketplace retention reconciliation, backups/logs/holds, breach-notification duties and DPO applicability remain unresolved. No unverified country, address, date or legal deadline is supplied.

This is a faithful owner-review translation preparation, not certified translation or Malaysian counsel approval.

## Local route and metadata

`/privacy/bm` renders the BM draft through the existing legal-information and BM-content gates. The populated draft does not satisfy the independent final BM approval requirement. The English/BM selector is available for authorised local review; BM review wording, pending-date labels and contents navigation are localised and the main document declares `lang="ms"`.

The shared renderer defaults remain English for existing routes. No Terms source, metadata, tests or policy state is changed. BM metadata uses the exact title `Notis Privasi TAKEME`, canonical `/privacy/bm` and `noindex, nofollow` while unpublished. Unapproved BM is not advertised as an approved public alternate.

## Verification

Verified with installed Node 22.23.2, without installing dependencies or changing global configuration:

- Full app suite: **311 passed**, including **26 focused BM/parity tests**, English Privacy, legal-route, Terms and policy-source guards.
- TypeScript `--noEmit`: passed. Full ESLint and diff whitespace checks: passed.
- BM browser route at **390×844**, **430×932**, **768×1024** and **1440×900**: all 29 sections, no horizontal or section overflow, readable title/markers/lists/selector and `noindex, nofollow`.
- The document declares `lang="ms"`; dates remain unresolved and no `<time>` date is emitted. Mobile contents navigation focuses the selected heading. Contact caveats and retention list render correctly; desktop contents remain available.
- English → BM → English client navigation, direct BM load and refresh passed. Console/hydration error count: **0**. English section 28 renders the exact approved status sentence.
- Shared-renderer regression: Terms retains all 35 sections, original English draft/date labels, review notice, exact title and noindex/nofollow output.
- Independent semantic translation review passed after clarifying live-commerce, retained-data holds and active-system cleanup terminology. This is not final counsel approval.
- Diff/source audit: Terms and central policy/readiness files are byte-for-byte unchanged; English Privacy differs by exactly the approved sentence. Main and the reviewed qualification HEAD remain unchanged, and no changes are staged or committed.

Browser review used explicit `demo-takeme` development emulator mode only. No production Firebase request or cloud operation was needed. Logs and screenshots are stored outside Git in the existing private temporary verification directory; generated caches and installed dependencies remain ignored. The temporary task-owned browser/server are closed after verification; unrelated local development services are preserved.

## Changed files

- `src/content/privacy-bm.ts`
- `src/content/privacy.ts` — only the owner-approved section 28 sentence
- `src/content/privacy-notices.ts`
- `src/app/privacy/bm/page.tsx`
- `src/lib/privacy-bm-metadata.ts`
- `src/lib/privacy-notice.ts` — approval guard comment; logic unchanged
- `src/components/public-information/privacy-languages.tsx`
- `src/components/public-information/public-information.tsx`
- `tests/privacy-bm-v1.test.mts`
- `tests/privacy-v1.test.mts`
- `tests/public-information.test.mts`
- `docs/privacy-bm-v1-owner-draft.md`

BM Privacy v1.0 owner draft: **ready for owner review**. EN/BM parity: **pass**. Legal counsel review: **required**. Publication: **blocked**. Safe to activate Privacy 1.0: **no**. Changes remain local and uncommitted for owner review.
