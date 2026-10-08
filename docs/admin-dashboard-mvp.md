# Dedicated TAKEME admin application

`apps/admin` owns its Next entry, route tree, layout, authentication, CSS, Firebase app and future Cloudflare Worker configuration. The consumer application does not import it. Only the pure editorial contract and public projection types are shared from `functions/src`; they have no Firebase/admin SDK side effects.

Future hosts remain separate: `takeme.my` uses the existing consumer Worker; `admin.takeme.my` would use `takeme-admin`. No Worker, domain, DNS, Firebase Auth setting or production backend was changed.

## Operator workflow

Overview, Content (Homepage/Banners/Campaigns/Collections/Announcements), Marketplace (Listings/Categories/Auctions/Sellers/Users), Moderation (Reports), Settings. Read-only auction operations never edit bids, clocks or winners. Report triage uses the existing authoritative callable. This is not Seller Centre, payment administration or a new account model.

Login uses existing Firebase email/password or Google authentication. Every protected layout independently validates an HttpOnly, HTTPS-Secure, SameSite Strict session token through the claim-guarded backend handshake. Missing/forged/expired/non-admin identity denies direct URLs. Session POST/DELETE require same origin; POST has a bounded JSON stream. Server-side actions independently validate the claim, not the cookie alone. No token is logged or exposed to components through the session API.

Create/edit/schedule/publish/end/duplicate campaigns with version conflicts. Upload create-only banner artwork, bind desktop/mobile hero, strip or secondary placements. Curated collections have optional artwork and product selection. Announcements have bounded relative destinations and authoritative windows. Homepage edits remain draft: save, review desktop/mobile preview (including disabled-section labels), then explicitly confirm publish. Category visibility/order/featured choices affect Home, not taxonomy deletion.

Product picker searches title token, exact ID, seller or category, with public-safe eligibility filtering and server revalidation. Seller picker uses public display-name prefix or UID. Operational seller rows show bounded active-listing/report counts and public rating; no email/address. Tables preserve pagination and expose a clear retry/error state rather than inventing unavailable analytics.

## Build and qualification

Run from repository root after `npm ci`:

- `npm --prefix apps/admin run typecheck`
- `npm --prefix apps/admin run build`
- `npm --prefix apps/admin run cloudflare:build`
- `npm --prefix apps/admin run cloudflare:check` (local Wrangler dry-run only)

The app uses the root lockfile/runtime dependencies, with matching package constraints, and installs no new UI dependency. Consumer TypeScript excludes `apps`; admin TypeScript owns its sources. An explicit admin proxy prevents inheritance of the consumer publication proxy. Separate metadata and response headers keep the control room noindex.

Qualification uses `demo-takeme` Auth/Firestore/Functions/Storage emulators with synthetic users and records. The browser blocks every external request. A production-configured build was also compiled privately with Node network transports blocked; it contacted no production service. Build output is excluded from Git. Desktop/mobile browser checks cover 13 screens at 1440×900, 1366×768, 1024×768, 768×1024 and 390×844. Keyboard focus, 44px controls and horizontal table scrolling are retained.

## Verified local result

- App suite: 512 tests total, 510 passed, two existing skips, zero failures.
- Functions: 174 passed after explicit Node type selection; the checkout has pre-existing duplicated ignored `@types` directories that break implicit type discovery. No dependency directory was deleted or committed.
- Editorial Auth/Firestore/Storage/Functions integration: 70 assertions passed. Existing admin emulator regression passed.
- Browser: 79 checks passed, including signed-out/direct-URL and normal-account denial, HttpOnly session, campaign actions, actual Firebase SDK asset upload/finalization, private preview, explicit publish, stale/dirty protection and 13 screens at all five requested viewports. Zero browser JavaScript errors and zero external requests were observed.
- Admin TypeScript, isolated consumer production TypeScript/build, ESLint, credential scan and diff review passed.
- Both OpenNext packages and local Wrangler dry-runs passed. The production-configured admin package is independently qualified offline; no Worker was deployed.

Private browser images, emulator logs, test identities, profiling evidence and build output remain outside Git. No approved legal source, payment/deletion/TTL control, production schedule, DNS or main baseline was changed.

## Exact future deployment requirements

1. Owner approves a dedicated admin rollout and least-privilege operator claim assignments. Assign `admin: true` through the trusted Firebase administration process, never an email list or client UI. Establish revocation/incident ownership.
2. Deploy/read back the narrowly scoped backend and rule changes in the companion backend runbook. Verify existing runtime pins, release policy, maintenance semantics and Storage cross-service permissions. Admin mutations still require the operator's normal current policy eligibility.
3. Set the six `NEXT_PUBLIC_FIREBASE_*` Web App values to the approved target and `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`. Auth domain must match `<project>.firebaseapp.com`; bucket must match `<project>.firebasestorage.app`. Allowed non-demo projects are explicitly pinned to TAKEME production/staging. Never deploy the demo qualification output.
4. Build the admin independently, then verify all compiled project/bucket/endpoint values and server session behavior in staging. Retain source/package checksums and previous artifacts. Google popup authentication requires a separately approved authorized-domain update for the eventual admin hostname; no such update was made here.
5. After separate approval, create/deploy only `takeme-admin` in the existing approved Cloudflare account. Bind `ASSETS` and `WORKER_SELF_REFERENCE` to that Worker. No R2, Durable Object, queues or new scheduler is required. Preserve enabled Logs/query-string redaction, disabled Traces, disabled workers.dev/previews and no domain until the owner approves attachment.
6. Only after backend/auth/worker verification, separately approve `admin.takeme.my` routing/DNS. Validate HTTPS, cookie origin/Secure behavior, normal-user denial, direct-URL denial, upload, preview, version conflicts, publication and monitoring. Preserve consumer routing and rollback.

The source is ready for review. Immediate production deployment is not authorized or qualified by this local task; staging/operator/domain configuration and coordinated deployment readbacks remain release gates.
