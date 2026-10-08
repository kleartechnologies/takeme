# Admin Dashboard MVP production qualification

Production rollout qualified on 8 October 2026 from reviewed source `40b5e5be7d11d27320bb8d981dc2253db8862b74`. This record documents the completed rollout; it does not authorize unrelated changes. Private receipts, fixtures, screenshots and credentials remain outside Git.

## Resource scope and readback

- Firebase project `takeme-52b80`, bucket `takeme-52b80.firebasestorage.app`, region `asia-southeast1`.
- Eighteen reviewed Functions deployed: four updates (`getAdminPage`, `getAdminRecord`, `updateAdminReport`, `getPublicListingPage`), eleven new callables (`getAdminSession`, `getAdminControlOverview`, `getAdminEditorialPage`, `getAdminEditorialRecord`, `mutateAdminEditorial`, `previewAdminHomepage`, `publishAdminHomepage`, `getPublicHomepage`, `requestAdminAssetPermit`, `finalizeAdminAsset`, `loadAdminReportContext`) and three invalidation triggers (`invalidateEditorialListing`, `invalidateEditorialSeller`, `invalidateEditorialLifecycle`). Readback: 106 ACTIVE Functions, all 18 reviewed revisions qualified, 88 unrelated Functions unchanged. Node 22, reviewed service identity and production runtime pins verified.
- Exactly two transaction COLLECTION indexes added: `buyerId ASC / status ASC / amountSen ASC` and `sellerId ASC / status ASC / amountSen ASC`, each with the normal `__name__ ASC` suffix. Both READY; previous 49 preserved, total 51.
- Storage additions are confined to `admin-assets/{assetId}/image.png`. Active ruleset `2e240c90-4df1-441e-8f0b-e61129490095`, SHA-256 `a2080e2cff9fb77bfa982bc9491dc0319fc025a142ff934f935bbc84d562d437`. Consumer media rules preserved. Firestore rules release remains `a44062ea-2d44-415e-a32b-e6cb1468cdd6`.
- Bucket CORS changed from empty to the exact Admin origin `https://admin.takeme.my`, GET/HEAD, Content-Type response header, 3,600-second max age. No wildcard origin.
- Consumer Worker `takeme-web`: version `5a39ec41-7ee7-4ae1-951b-35c0335472f7`, 100% traffic. Dedicated Admin Worker `takeme-admin`: version `a3aa9d29-8d62-41db-b760-fd8d7c152b40`, 100% traffic. Logs and query-string redaction preserved; traces disabled.
- `admin.takeme.my` attached to the dedicated Worker with valid HTTPS. Admin workers.dev and temporary previews disabled. Only `admin.takeme.my` added to Firebase authorized domains; existing domains and consumer Auth configuration retained. Apex/www routing, Hostinger and Netlify unchanged.

## Identity and security

The explicitly approved existing owner account is `support.takeme@gmail.com`. Its Admin claim and consumer Terms/Privacy 1.0, age and profile readiness were verified. This account uses Google sign-in; it has no password provider. Real Google sign-in in normal Chrome on `admin.takeme.my` reached the verified Admin Overview. The in-app browser did not complete this flow reliably; no authentication protection was relaxed.

Signed-out access, forged cookies, cross-origin/missing-origin session requests and an actual ordinary synthetic account were denied. An actual issued cookie was denied following refresh-token revocation, and fresh owner login and logout passed. Claim-based admission has no tester email allowlist. Operator removal remains the procedure in [Admin session security](admin-session-security.md): remove only the Admin claim, revoke refresh tokens, read back, then verify old token and cookie denial.

All thirteen Admin screens loaded: Overview, Campaigns, Homepage, Banners, Collections, Announcements, Listings, Auctions, Users, Sellers, Categories, Reports and Settings. Marketplace tables remained bounded and excluded email/private addresses by default. Synthetic user aggregate summaries worked with the new indexes. No real report conversation was inspected; the ordinary synthetic account was denied access to report-context loading.

## Editorial, asset and publication smoke

One clearly labeled internal campaign was saved as a private draft. A synthetic 1200×400 PNG was uploaded through the actual Admin browser Firebase SDK permit/finalization flow. Private SDK preview succeeded; token-free anonymous and ordinary-user reads returned 403, and ordinary-user asset endpoints were denied. Create-only, ownership and publication protections retain the reviewed source/emulator qualification. No production Admin overwrite attempt was made. Firebase SDK object metadata can include download tokens; no token-bearing URL was emitted in the public projection or audit record.

Only the separately owner-approved text announcement, “TAKEME marketplace” linking to `/explore`, was temporarily published. Its public projection and consumer Home placement were verified. The campaign was then ended, the announcement disabled, and the test section removed from the homepage draft. Invalidation produced a null public homepage projection and restored the existing consumer Home. The image was never published, so production public-image publication was not exercised by this text-only smoke.

The ended campaign, disabled banner/announcement, unpublished private asset and audit evidence are retained for traceability. No real customer record was changed or deleted. Eleven synthetic action audit events had bounded summaries without tokens, cookies, full messages or raw image data. Seller-paid promotion source and unrelated deployment resources were unchanged; no customer promotion payloads were inspected.

## Consumer and qualification evidence

Signed-out and signed-in consumer Home rendered the existing public-first feed. The homepage projection adds one bounded document lookup in parallel with feed work, within the existing response; this is the source query budget, not a measurement of billed reads.

Reviewed Home client-reference gzip inventories were approximately 378,894 bytes before and 379,150 after (about +256 bytes, 0.07%). Bounded paired feed-call median latency was 125.929 ms without editorial versus 126.595 ms with editorial. Home document TTFB varied across unpaired cold/warm samples; no causal runtime speed improvement is claimed. Existing controlled mobile fallback qualification and the bounded live checks found no material regression. Live FCP/INP and first-product timings were not measured in this rollout.

Reviewed source qualification: 527 passing app tests, two existing skips; 189 passing Functions tests; consumer/Admin TypeScript, ESLint, independent Next/OpenNext builds, artifact validation and Admin Wrangler dry run passed. Credential scan found no credentials in the reviewed changes. All 651 recorded tracked source hashes matched before this documentation-only completion checkpoint.

Fresh aggregate monitoring showed zero Cloud Run 5xx in the bounded twenty-minute window. Admin dashboard metrics showed zero Worker errors and asset 5xx; consumer monitoring showed no critical Worker failure. Google/Firebase contacts remain the verified primary and backup. Cloudflare custom alert capability remains unavailable under the previously accepted account/query permission restriction; operator dashboard inspection remains the approved monitoring fallback.

Release policy, protected-write and auction controls were read back unchanged. Payments, deletion execution and TTL remain OFF. Approved legal content and the parked Media Pipeline are unchanged.

## Git and rollback

Both production Workers' Dashboard Build sections showed no connected Git repository. Netlify site `mytakeme` retained deploy `6abf53aff357408229eafa09` and had `stop_builds=true`. No GitHub deployment workflow was present. These read-only checks qualify the authorized normal main push without a second serving deployment; no build connection or Netlify setting was changed.

Consumer rollback version: `47737175-8239-43ea-a4a9-63ad1cc4a89d`. Captured previous Storage ruleset: `3439c396-c2df-497a-a5ef-d4ba0c59a461`; prior bucket CORS was empty. Private backend and deployment readbacks are retained outside Git. If Admin fails, disable/detach only its domain; consumer remains live. If projection regresses Home, restore the known-good consumer Worker. If asset authorization regresses, restore the exact captured Storage rules/config. Stop editorial admission during inconsistent state. Do not delete editorial/audit evidence as a first rollback action. Any rollback is a separate operator action, not performed here.

## Next consumer task: GLOBAL CONTROL-STATE AUDIT

The square focus/double-border issue is deliberately unchanged. The next task should inspect search, inputs, textareas, selects, chips, buttons, icon buttons, tabs, sheets, dialogs, auth forms, Sell, Settings, Product/Auction and Messaging. Remove mismatched square focus rings/double borders while preserving visible keyboard focus, accessible semantics and touch targets. No such UI changes belong to this Admin rollout.
