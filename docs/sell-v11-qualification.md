# Sell V1.1 native-only release qualification

Source baseline: `fe02334f9c9c8c385023a3a89fdf19800d42b116`.
Owner-approved release scope: four-stage Sell, consumer photo normalization, and frontend recovery; no non-native HEIC decoder and no conversion endpoint. This record describes predeployment qualification. Deployment and live-smoke receipts are private operational evidence outside Git.

## Contracts and flow

Both fixed-price and auction listings use Photos → Category → Item details → Review / Publish. Type choice is on Photos; selecting a category opens Details. Existing title/description/condition, MYR precision, auction timing, general-location privacy, optional saved public meet-up place and eight-photo limits remain enforced. No payments, shipping, inventory, reserve price or backend feature is introduced.

The existing draft/create/update/publish callables are unchanged. Firebase Storage remains canonical. Uploads use `requestUploadPermits`, Firebase SDK `uploadBytes`, existing owner/listing object paths and immutable metadata. Functions, Firestore rules, Storage rules, legal content, policy/control state and runtime configuration are outside this patch.

Photos prepare sequentially while the user edits Category/Details. A failed retained photo keeps the other photos and fields, shows a placeholder with Replace/Remove, and blocks final review/publication until resolved. Missing files after reload behave the same way: honest reselection placeholders, preserved entries and no fake images. Reordering, arrow controls and cover selection remain available.

Details combines title, condition, description, price or bid/timing fields and safe general area. Switching format retains shared fields/photos and confirms clearing incompatible amounts. A created server draft keeps its format. The final sheet summarizes photos, condition, amount and general area. Publication disables repeated submissions and displays progress. Success retains View/Share/My listings/Sell another; sharing requires an explicit action. Sell another clears old photos and entries while keeping safe defaults.

## Native-only photo support

| Input | Release behavior |
| --- | --- |
| JPEG/JPG, PNG | Native decode → normalized WebP |
| WebP | Native decode; qualified metadata-free small WebP may be reused |
| AVIF | Native decode/normalization where the browser supports it |
| HEIC/HEIF | Native-conditional; friendly per-photo failure when native decode fails |

HEIC failure copy: “We can’t process this photo on this device yet. Please choose another photo or convert it to JPG or PNG.” Unsupported originals cannot reach upload.

`heic-to`, its worker, licence asset and decoder chunk have been removed from the release path. `package.json` and `package-lock.json` exactly match the baseline; no unrelated package was upgraded. Earlier decoder/Cloudflare evaluations are preserved with hashes in a private historical-review directory outside Git and are not release files.

Content inspection precedes successful pixel decoding. Renamed non-images, malformed/empty data, photo sequences and excessive dimensions fail closed. Header walking is bounded. Input limits are 30 MiB/file, 50 million pixels and 16,384 pixels/edge. The queue retains at most 60 MiB of originals with one preparation at a time. Output is genuine WebP, long edge at most 1,600px, quality 0.82, original aspect ratio and no upscaling; the existing Storage output-size bound remains enforced.

Native decode applies EXIF orientation. Canvas normalization strips metadata; output validation rejects metadata/animation/unknown chunks and strips browser-added ICC data. Source colour-profile WebP is re-encoded through decoded pixels. Decode/render operations have 25-second timeouts and release bitmap/canvas resources. Browser-native decoding has no enforceable heap quota; physical-phone memory/picker behavior is not claimed qualified by desktop fixtures.

## Recovery and retry safety

Owner-scoped 30-minute session recovery retains bounded fields, category, format, stage and submission identifiers. Old eight-step drafts migrate to four stages. Processed Files stay in memory only; reload cannot restore File objects and asks for reselection. No tokens, image bytes or download URLs enter persisted submission recovery. Recovery never automatically uploads, saves or publishes.

Same-URL stage history preserves Next router state and supports browser/UI Back/Forward. Meaningful unsaved exits require an explicit choice. Busy publication prevents stage changes.

A known draft ID and bounded digest/object-path pairs survive retries. Owner/type/status and immutable upload metadata are checked before reuse. A successful publish with a lost response is read back without creating another listing. Definite creation rejections can be explicitly retried; unknown creation outcomes direct the user to My Listings instead of blindly creating duplicates. Recovery retains owner-scoped uploads; replacement history is bounded to 24 paths.

## Qualification results

- Focused tests: 29/29 pass.
- App tests: 482 total, 480 pass, two pre-existing skips, zero failures.
- Functions tests: 169/169 pass; no Functions source changed.
- Emulator: permit/ownership/path/type/size/expiry/overwrite/deletion guards pass (11 groups), maintenance ON/OFF pass (10 groups), genuine WebP Firebase SDK fixed/auction publication and security pass. Clients use only loopback `demo-takeme`.
- TypeScript and ESLint pass. Diff/source/artifact review excludes credentials and private/generated artifacts.
- Isolated publication-compatible Cloudflare build/check pass with zero outbound application calls. The private build preserves the already-live publication/runtime/observability configuration; no configuration change enters this source commit.
- Browser: fixed and scheduled auction four-stage flows, success, photo isolation/replacement, cover selection, browser Back/Forward and missing-file recovery pass. Chrome confirms real 390×844, 430×932, 768×1024 and 1440×900 viewports with no horizontal overflow. Review sheets fit with reachable actions. Local preview uses synthetic service doubles outside Git; real SDK behavior is separately exercised in emulator and bounded live smoke after deployment.
- Chrome development hydration diagnostics identify only the injected `data-scribe-recorder-ready` extension attribute. The clean in-app browser did not show an application hydration mismatch. Its viewport override was unreliable, so responsive measurements use Chrome. Physical iOS Safari/native HEIC success remains unverified; unit tests cover native success and failure, and actual Chrome HEIC/HEIF failure is verified.

Synthetic Chrome fixtures: small JPEG 800×600/48ms; large JPEG 5000×3750 → 1600×1200/154ms; PNG 800×600/20ms; transparent PNG 700×500/14ms; optimized WebP 800×600/4ms; AVIF 800×600/18ms; EXIF orientation-6 JPEG → 600×800/19ms. HEIC/HEIF display the approved friendly failure. Corrupt JPEG, renamed non-image, empty file and excessive dimensions are rejected. Timings are examples, not device performance guarantees.

## Bundle and dependency impact

Measured same-build initial Sell assets: before 1,313,802 bytes (400,565 gzip); after 1,313,680 bytes (400,552 gzip). Delta: −122 raw / −13 gzip bytes. The removed lazy decoder was 3,188,997 bytes / 768,203 gzip bytes; it was not part of the initial Sell payload. Browser artifact scan finds zero decoder references/chunks.

Dependency audit still reports six high-severity affected package entries in the unchanged baseline graph: Firebase/Firestore/compat/grpc-js, sharp and source-map-js. No new dependency/audit finding is introduced, and no automatic upgrades/downgrades were applied. This is not a clean-audit claim or a proof of advisory reachability; existing dependency remediation remains separate work.

## Deployment and rollback boundary

Frontend-only target: `takeme-web`, account `3ade68940865285d676a83971b23b4d4`. Fresh control-plane readback confirms baseline version `1904a043-49a6-4fdc-9d75-457adf2e2b62` at 100%, existing ASSETS/IMAGES/self-reference bindings, logging enabled, query-string redaction enabled and traces disabled. Preserve these settings and current domain/routing behavior.

After the scoped clean commit, validate the retained artifact and deploy only the frontend Worker version. Bounded live smoke must use synthetic identity/data and actual frontend Firebase SDK upload/publication. If launch-critical frontend behavior regresses, restore the retained Worker version only. No Functions/rules/policy/DNS/Hostinger/Netlify/payments/deletion/TTL change is authorized by this patch.

## Scoped files

Sell presentation: `src/components/forms/sell-form.tsx`, `sell.module.css`.
Photo processing: `src/lib/consumer-photo.ts`, `listing-image-upload.ts`.
Flow/recovery: `src/lib/sell-flow.ts`, `sell-history.ts`, `listing-submission.ts`, `transient-recovery.ts`.
Frontend service adapters: `src/lib/services/listings.ts`, `fixed-listings.ts`, `auctions.ts`.
Tests: `tests/sell-flow.test.mts`, `listing-image-upload.test.mts`, `sell-v11.test.mts`.
Documentation: this file.

Credentials, fixtures, screenshots, logs, emulator exports, build output and private review/deployment bundles remain outside Git.
