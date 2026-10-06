# V1 final RC blocker sprint — local review

Baseline: `39f38f33d7e44df176fc9fbb32e1adb673017b0c`. Changes are uncommitted. No deployment, policy activation, customer-data access, DNS or hosting change is authorized by this report.

## Rollback evidence

Frontend rollback remains **NOT READY**: the exact current Netlify deploy/source revision and its saved deploy artifact are not available locally. The reviewed main ref is not evidence of the live Netlify baseline. An owner-confirmed deploy ID/source commit or saved artifact is required; do not label the new RC or a guessed revision as the rollback baseline. After identification: capture the immutable original artifact/source, verify the registered production client identity without printing SDK values, rebuild from its lockfile, compare inventories, record hashes, and document its Netlify restore action. Do not replace a current production-compatible frontend with a policy-forward build.

Functions: read-only control-plane metadata and generation-pinned deployment-source archives captured for all **91** serving Functions. No production customer objects/documents, Auth accounts or logs were read. Each archive’s bytes and complete source tree were verified against its representative; six source groups were recovered. All six rebuild using their historical lockfiles to byte-identical archived JavaScript. All 91 endpoint transport/options definitions match the independently compiled maintenance bridges. Safe runtime manifests record exact Function names, serving revisions, entrypoints, Node 22 / GEN2 / asia-southeast1, service/IAM/resource options, source generations and hashes. Raw runtime credentials are excluded; environment names/fingerprints are not a replacement for owner-managed secret references.

Source groups:

| Historical source | Serving Functions | Protected endpoints |
| --- | ---: | ---: |
| `086b84f1ba96d2093bad13864a7e1a8e3fdfc80a` | 11 | 3 |
| `28d99ce67d121200a0acad4e241bb912b834ee23` | 11 | 5 |
| `c19b2f0115c3f09a634fca5d464e9ede0f885c55` | 1 | 1 |
| `cd14bbb2d8ae8e5c646637ff23957b3e693df9ef` | 62 | 24 |
| `ee4342a3283a9fb2b053f4fc7c2654bdcf3cd945` | 1 | 1 |
| `ff1e122fc235ff2b7b95a868a5c55b47ffca842e` | 5 | 1 |

Private rollback inventories are verified offline with:

```sh
node scripts/verify-rollback-package.mjs --manifest "$TAKEME_ROLLBACK_MANIFEST"
```

The verifier checks resource/disabled-activation identity, safe paths, byte sizes and SHA-256. `baselineVerified` is an evidence assertion supplied after the archive/revision comparison; the checksum verifier alone cannot identify the live deployment. Private packages and generated manifests are outside Git.

### Future targeted restoration procedure — do not execute now

1. Keep protected writes paused and auction creation frozen; retain the required 900-second drain and zero-active-auction gates. Never reopen writes merely because an old artifact was restored.
2. Re-read the serving revision identity at the authorized restoration time. Verify the archived exact package, lockfile, checksum inventory and runtime/IAM/secret-reference mapping. Abort on drift or missing owner-managed runtime configuration.
3. Choose only affected names from the captured group manifest. Prepare an isolated Firebase Functions codebase selector for those names, with `asia-southeast1`/Node 22 and exact options. A later owner-approved command has the shape `firebase deploy --project takeme-52b80 --config <reviewed-private-group-config> --only functions:<reviewed-codebase>:<affected-name>`; never use broad `--only functions` or this document as deployment approval.
4. Historical raw baselines are suitable only for a pre-policy compatible phase. Once new eligibility/evidence/rules are active, use a coherent reviewed secure rollback set under maintenance; never blindly restore legacy handlers that bypass the new policy model. Regenerated historical bridges preserve historical handler bodies, adding only the fail-closed maintenance/freeze boundary.
5. Verify expected revision/options, signed-out public reads, existing-client browsing, maintenance ON denial for every protected endpoint, wrong-owner rejection, and maintenance OFF compatibility in an isolated qualification environment. Only an independently approved recovery decision may unpause. No deletion/payment activation belongs to rollback.

## Historical bridge/harness qualification

All six actual historical packages are now available and compile independently. The old unavailable-package conclusion is superseded by this captured source evidence, not by a guessed newer implementation. The two historical harnesses are retained and repaired: provenance-bound private package paths, canonical demo emulator ports, explicit default demo Admin app, and complete SDK cleanup. A private composite shares one SDK class identity; it is non-deployable and never substitutes for the independent package archives.

- `legacy-maintenance-emulator.integration.mjs`: eight assertion groups pass with actual 35 protected historical endpoints; OFF retains legacy behavior, ON/inconsistent controls deny, public reads remain available, transactions recheck a control flip, the historical auction lifecycle runs, upload eligibility remains required.
- `auction-creation-emulator.integration.mjs`: ten assertion groups pass covering current/historical creation and publish, source rule bridges, public reads and transaction-level freeze races.

## Continuity/recovery design

Explore caches at most six history/query/account contexts for five minutes in tab memory. Next’s history segment ID separates visits. Search/category/filter/sort remain in the URL. Previously loaded pages (up to 120 items) revalidate against fresh cursors; removed items reconcile and pagination deduplicates. Product/seller navigation uses existing routes.

Sell, offer and message recovery uses explicit field allowlists, eight session records, at most 16 KiB each, and a 30-minute expiry. No credentials/tokens or bid draft have a storage path. Recovery is scoped to the same owner/context; account switch/logout clears it. Images remain memory-only, one selection of at most eight images / 64 MiB; after reload/eviction the form clearly requests re-selection. No uploaded image is fabricated. Location-profile consent is never restored checked.

Restoration updates form presentation only. Sell/offer/send still require fresh server eligibility and explicit confirmation. Messages preserve the existing logical retry key; changing the body generates a new key. Bid retains context only and revalidates the current price/state. Save/Follow return to their context without automatic execution. Existing policy/lifecycle/maintenance, idempotency and upload gates remain authoritative.

## Qualification receipts

Final local results: **432/432 app tests**, **165/165 Functions tests**, **31/31 current-source emulator suites**, and both actual historical emulator suites pass (eight legacy and ten auction-freeze assertion groups). TypeScript, full ESLint, credential scan and diff whitespace review pass. Both original rollback packages and all six bridges freshly compile; archived original JavaScript is byte-identical. The final production-identity RC runs fresh `npm ci`, `cloudflare:build` and `cloudflare:check` successfully with launch date **2026-10-12**, publication/deletion/payments OFF. Private SDK values are not written to tracked source or logs.

Browser journeys use only `demo-takeme` and synthetic fixtures. Explore → Product → Back preserves 24 loaded items and exact query/category/condition/type/price/sort. A settled deep-scroll round trip restored **2174.5px → 2174.5px**. Four-size filtered checks returned to the same result area (automated link scrolling/viewport changes measured within 272px), with identical query and loaded pages. Public data revalidation/pagination deduplication also passes unit tests. Browser Back exercises the same history/popstate path used by a browser back gesture; no physical phone or physical gesture test is claimed.

Offer amount **RM21.50**, payment proposal and same listing/sheet restore after actual demo reacceptance, with **zero offers** automatically submitted. Message text restores with **zero messages** automatically sent; explicit double-tap produces **one** message. Sell title, description, category, price and step restore with **zero listings** automatically saved/published. Browser testing found and fixed an empty-mount effect clearing retained files: a same-tab selected synthetic photo now restores; a full reload shows truthful re-selection guidance. Save and Follow return to the same listing/seller without execution. Bid opening and confirmation both recheck eligibility; after reacceptance the same auction reloads with fresh price and no stored/replayed bid.

Responsive checks at **390×844 / 430×932 / 768×1024 / 1440×900** cover Explore/Product, Messaging/offer sheet, Sell recovery, Saved and Auth: no horizontal overflow or broken images. Mobile/tablet composers sit above bottom navigation; the desktop composer stays inside the viewport. Offer focus remains inside the sheet; Escape from an explicitly opened sheet restores its trigger. No hydration errors were observed. Existing policy/lifecycle/maintenance, legal-route, idempotency, upload and auction server suites pass. Retry/lost-response deduplication uses the actual emulator suite and preserved retry-key unit cases; no unsupported browser network override was used.

All four approved legal-content files and central publication/policy sources are byte-identical to the approved checkpoint. Main is unchanged, including its pre-existing review/probe files. Qualification HEAD is still `39f38f33d7e44df176fc9fbb32e1adb673017b0c`; the 18 task changes remain local and uncommitted. Production, DNS, Cloudflare, Hostinger and Netlify are unchanged.

**Remaining blocker:** the exact compatible Netlify frontend deploy/source/artifact is not verified. The new RC is not a substitute for that rollback baseline. Overall final RC, technical production and combined rollback readiness remain **NOT READY**; marketplace smoothness passes the tested browser/server scope. Safe to move to final production activation precheck: **NO**.

Private rollback manifest hashes before durable-copy relocation:

- Functions (494 inventoried files): `a3dc9654e6acde2cab044b9b02cee2e4a19f5ae67a0d29362f0c315b74039c5f`.
- Historical bridges (425 inventoried files): `53a8bc173e5c8c93b77b4c744eb17709528aa12d50cbea8728b264a8884f77a7`.

A durable private bundle holds the current-source patch, exact Function packages/metadata, bridge sources/builds, RC artifacts and bounded non-sensitive receipts. It excludes SDK JSON, private fixture credentials, logs, installed dependency trees, build caches and emulator exports. The OpenNext artifact retains its required traced runtime files and prerender payloads. Its location/hash are reported with the final owner review. These artifacts confer no deployment or activation approval.

## Changed files

All 18 files remain uncommitted:

- `docs/v1-final-rc-blocker-sprint.md`
- `scripts/verify-rollback-package.mjs`
- `src/components/auth/auth-provider.tsx`
- `src/components/forms/sell-form.tsx`
- `src/components/listings/auction-panel.tsx`
- `src/components/listings/explore-browser.tsx`
- `src/components/messages/conversation-deals.tsx`
- `src/components/messages/conversation-view.tsx`
- `src/lib/explore-continuity.ts`
- `src/lib/firebase/auth.ts`
- `src/lib/transient-recovery.ts`
- `src/lib/use-transient-draft.ts`
- `tests/auction-creation-emulator.integration.mjs`
- `tests/explore-presentation.test.mts`
- `tests/legacy-maintenance-emulator.integration.mjs`
- `tests/helpers/historical-emulator-packages.mjs`
- `tests/marketplace-continuity.test.mts`
- `tests/rollback-package.test.mts`

The final documentation update lists this inventory after the successful build; compiled application inputs are unchanged. The task-owned demo server/emulators are stopped without exports after qualification. The user's existing local service and unrelated main-checkout files are preserved.
