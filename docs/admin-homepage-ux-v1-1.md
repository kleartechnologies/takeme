# Admin Homepage UX V1.1 local qualification

## Scope and baseline

Fetched origin before editing. Main remains at approved consumer control-state checkpoint
cff3dc60a0e1bb223e45653daf892037f1267f1c, one commit ahead of origin/main
9a250b10bd1ff46f25d8d217794ee9260b23fe4f. Work is isolated on
feature/admin-homepage-ux-v1-1. No push, production deployment, DNS or OAuth configuration change.
Parked Media Pipeline work is not included.

## Owner workflow

Homepage → Banners / Homepage Sections / Announcements. New Banner contains a name,
desktop/mobile uploads, friendly destination and Publish Now or Malaysia-time schedule.
Versions, asset IDs, placement and campaign references are internal or collapsed technical details.
Overview opens Homepage; advanced campaigns and collections remain available. Audit IDs remain
available only in a collapsed technical audit panel.

One logical banner optionally holds mobileAssetId and its own start/end times. Legacy records
without these keys preserve their original shape and single-artwork behavior. No data migration.
Paired artwork is compiled into the existing public schemaVersion 1 desktop/mobile representation.
Banners with campaign references retain the campaign's visibility/schedule restrictions.

State controls: LIVE → Pause; SCHEDULED → Edit schedule / Activate now / Cancel schedule;
INACTIVE → Activate; ENDED → Reactivate / Duplicate. Duplication creates an inactive draft,
clears the schedule and never publishes. Activation replaces an elapsed schedule with a current
start and retains a future end. Schedule timestamps are authoritative server UTC instants;
operator inputs/displays use Asia/Kuala_Lumpur.

Save Draft leaves public projection unchanged. Publish, Schedule, Pause and Activate atomically
check banner, Homepage draft and public revisions, update public assets and write an audit record.
Pending Homepage edits must be reviewed/published first; a banner action cannot silently publish
them. Conflicts preserve local edits and offer reload. Empty paused/scheduled manual slots do not
render empty consumer headings. Existing automatic Home fallback remains available.

## Destinations and sections

Category picker uses the existing 14 marketplace categories, not an invented taxonomy. Product
search supports title tokens, exact listing ID and selected seller. Bounded batch seller-name
lookup enriches only editorial listing-picker responses with public metadata. Seller prefix search
sorts before setting bounds; this fixes an existing Firestore query-order error found in the browser.
Collection destinations use real Homepage anchors and require active curated collections.
Explore is direct. Advanced Custom Link accepts safe internal TAKEME routes / the canonical
https://takeme.my equivalent, rejects external schemes, encoded separators and protected routes.
Product/seller targets are revalidated by the server before publication.

Homepage Sections have on/off switches, accessible up/down reorder controls, named content
pickers, title editing and section addition/removal. Save → Preview → confirmation → Publish.
Preview is desktop/mobile and never publishes. Section IDs/order/source/version stay internal.
Announcements share the friendly destination picker and workspace tabs.

## Admin artwork format evaluation

JPEG, PNG and WebP input is decoded and redrawn to a new PNG, with no inherited EXIF/GPS,
up to 1920px edge / 4 megapixels and the existing 2 MB encoded upload cap. Upload uses the
real Firebase SDK uploadBytes path and existing Admin permit/finalize validators. Draft thumbnails
use authenticated Storage getBytes and revoked object URLs; unpublished assets are not exposed.
Filename is shown for the current upload; after refresh the existing asset metadata supplies size
and dimensions with a generic artwork name. No new filename Storage schema.

Measured local synthetic desktop fixture: PNG 3,026 bytes; WebP quality 85 2,972 bytes.
This simple gradient is not representative campaign photography and does not establish a
production compression benefit or visual-quality parity. Existing browser-normalized fixture
uploads were approximately 14 KB desktop and 22 KB mobile. Keep PNG until a separate Admin-only
WebP contract qualification covers complete-byte validation, MIME/path, Storage rules, finalize
metadata, previews, transparency/quality and legacy assets. Do not merge the parked media pipeline.

## Qualification environment

Full offline checks run in a clean private copy with existing locked dependencies. Original ignored
node_modules/@types and .next contain pre-existing duplicate files; these were preserved.
TypeScript uses explicit node types for private Functions compilation only. No source/dependency
workaround is committed. Integration and UI tests use demo-takeme on isolated emulator ports
9098/8088/9198/5101 to avoid disturbing the user's existing default-port emulators. Private
transport fixtures map the demo-only localhost endpoints; production runtime source is unchanged.
Credentials, synthetic images, logs and generated builds stay outside Git.

Results:
- App/legal/policy: 539 PASS, two existing skips (541 total).
- Functions: 193/193 PASS.
- Editorial emulator: 88 counted assertions plus seller-name/prefix/private-data assertions PASS.
- Revoked-admin/removed-claim session emulator: 20 assertions PASS; no cloud calls.
- Admin and consumer TypeScript: PASS; ESLint: PASS, no warnings; diff whitespace: PASS.
- Next production-mode build and OpenNext Cloudflare packaging: PASS using existing locked
  dependencies and an isolated demo configuration. The package is not a production release artifact.
  Webpack is used because an external node_modules symlink is unsupported by Turbopack;
  Cloudflare packaging passed after private dependencies were copied normally.
  Wrangler deploy --dry-run: PASS; 7,346.46 KiB raw / 1,516.64 KiB gzip Worker, 58 assets.
  Credential-pattern scan: zero findings in the scoped source/test/docs files.
- Browser: actual desktop/mobile uploads, category/product/seller/collection/Explore/custom
  selection, draft persistence/refresh, immediate publish, future schedule, cancel schedule,
  activation, duplication, section toggle/reorder/save/preview/publish confirmation PASS.
- Chrome requested viewport overrides verified against actual innerWidth/innerHeight:
  1440×900, 1366×768, 1024×768, 768×1024, 390×844. Banner editor/list, Homepage Sections,
  Announcement list/editor have no document horizontal overflow. Visual/touch/focus checks
  were local; physical devices and remote staging are not qualified by these checks.
- Chrome extension injected data-scribe-recorder-ready into the root HTML, producing one
  extension-attributed login hydration warning. No corresponding application error was observed
  in the in-app browser. Do not suppress hydration warnings to hide extension interference.

## Rollout boundary

This is not an Admin-frontend-only release. Coordinated narrow Functions changes are required:
getAdminPage, getAdminEditorialPage, getAdminEditorialRecord, mutateAdminEditorial,
previewAdminHomepage and publishAdminHomepage (shared compiler behavior). The consumer
renderer needs the small paired-banner/collection-anchor/empty-slot compatibility patch.
No Firestore indexes, rules, Storage rules, legal content or Auth configuration changes are included.
Qualify these source changes on protected staging and verify existing published Home before
requesting a coordinated production deployment. Keep old frontend/Functions rollback references.
Do not deploy the Admin frontend alone against the old banner mutation contract.
