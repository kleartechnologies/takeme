# TAKEME Cloudflare website qualification

3 October 2026. Local preparation only. Baseline HEAD `040fb9a9b4cc902d06e3c75c47fd01fd871e5306` remains unchanged. No commit, push, upload, deployment, Git connection, DNS change, Netlify removal or production Firebase access was performed. The owner selected GitHub → Cloudflare Workers / Workers Builds → existing Next.js website → Firebase backend. Canonical remains `https://takeme.my`.

This report records the pre-adoption qualification. The subsequent supported dependency adoption after checkpoint `0fdfcc18fef073dd2c523ebf232192bcdb77422a` is recorded in [Cloudflare dependency adoption](cloudflare-dependency-adoption.md); the version table below is historical.

4 October update: current staging identity, disabled routing, Access safeguards and branch/deployment procedure are described in [staging preview preparation](staging-preview-qualification.md), which supersedes the provisional preview configuration below. No cloud deployment or production migration has occurred.

## Recommendation and exact versions

**Use OpenNext for this migration. Do not release the current dependency tuple.** It adapts native Next output and retains the existing App Router implementation, self-hosted fonts and fail-closed release tooling. Cloudflare currently recommends vinext, but its beta implementation replaces Next APIs/build behavior through Vite; that creates more regression work for this approved application. Vinext also documents a different Google-font pipeline. This is a TAKEME risk assessment, not a claim that Cloudflare recommends OpenNext for new apps. [Cloudflare Next guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [vinext implementation/status](https://github.com/cloudflare/vinext).

| Component | Approved checkout | Private supported trial |
| --- | --- | --- |
| Next.js | 16.3.5 | 16.3.8 |
| React / React DOM | 19.2.8 | 19.2.8 |
| Firebase Web SDK | 12.19.0 | 12.19.0 |
| OpenNext Cloudflare | Not installed/locked in checkout | 1.20.8 |
| Wrangler | Not installed/locked in checkout | 4.147.0 |
| Node | Installed 22.23.2 | Same, session only |
| Compatibility date | Prepared 2026-10-03 | Same |

The latest adapter requires Next `>=15.5.27 <16 || >=16.3.8`. Its release notes raise the floor for security fixes; the preceding release identifies a critical `next/og` issue affecting 16.3.5. TAKEME has no first-party `next/og`/`ImageResponse` usage, so this audit does not demonstrate exploit reachability. Nevertheless, using an older adapter to bypass the support/security floor is not the recommended production approach. A reviewed Next/eslint-config-next patch and locked adapter/Wrangler dependencies must be adopted in the checkout and requalified before release. No peer override or root dependency upgrade was performed. [OpenNext releases](https://github.com/opennextjs/opennextjs-cloudflare/releases).

An initial private exact-version probe with Next16.3.5/OpenNext1.20.6 packaged successfully but ordinary pages returned 500 in workerd. A successful build alone did not establish runtime compatibility. That output remains nondeployable and is not the recommended release tuple.

## Application feature findings

| Feature | Actual application and qualification |
| --- | --- |
| App Router / RSC / SSR | Used throughout. Supported private Worker rendered public/auth/client-shell routes; login RSC response returned 200 `text/x-component` |
| Server Actions | None found in first-party website source; adapter supports them, but no app-specific execution claim |
| Route handlers | No custom website API route handlers found; Firebase callables remain separate backend endpoints |
| Middleware / Proxy | Existing `src/proxy.ts` is preserved. Experimental Node Proxy support is implemented upstream, despite stale overview tables. Twelve legal-route/basic/query/trailing-slash/RSC/prefetch checks retained final 404 after ordinary path normalization, no-store, noindex and no draft body |
| Auth redirects | Existing client routing and guarded internal return intents preserved. Login/register render; prior local auth/redirect tests pass. No real production password/Google/reset operation was performed |
| Dynamic listing routes | `force-dynamic` metadata fetch remains no-store, fixed public callable endpoint and field-filtered. Offline trial disables the fetch and produces neutral metadata; missing listing route returns the existing shell 200, not certified item-specific metadata or a true missing-item 404 |
| Public seller routes | Dynamic seller shell rendered, private data not fetched; actual seller projection remains Firebase-backed |
| Images | Existing allowlist retained. IMAGES local binding resized a local PNG to 6,023 bytes; loopback and unapproved remote origins rejected 400. No production Storage object or Google avatar was fetched |
| Fonts / metadata | Twelve Poppins WOFF2 assets returned 200 from local static paths; no Google-font CDN URL in sampled HTML. Canonical apex appears in rendered metadata |
| Legal pages | Draft routes deliberately blocked; local compatibility does not authorize publication |
| `/account-deletion` | Public route rendered 200. No deletion request, production availability check or Auth-user deletion performed |
| Firebase client SDK | Existing SDK APIs and initialization/proof guards retained. Cloudflare server compilation now selects Firestore's browser entry to avoid eager Node dependencies |
| Server Firebase usage | Listing metadata uses credential-free HTTP to a public callable. Website has no Firebase Admin SDK. All Admin/Functions/schedules remain on Firebase Node22, asia-southeast1 |
| ISR / cache infrastructure | No active time-based ISR/revalidation requirement identified. No R2, Durable Object, Queue or Cron resources configured |

The upstream Proxy implementation is experimental and not officially maintained; pin the tuple and retain these runtime tests after dependency changes. No instrumentation module requiring its known Node instrumentation path was found. [Proxy support PR](https://github.com/opennextjs/opennextjs-cloudflare/pull/1309), [OpenNext features](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/).

## Concrete Workers dependency fix

The static import path `AuthProvider → firebase/firestore → @firebase/firestore Node entry → gRPC/proto-loader → protobufjs descriptor → Function(source)()` caused import-time `EvalError: Code generation from strings disallowed`. The `window` guard prevents initialization, but cannot prevent module evaluation. This affected public Help and account-deletion pages before any Firebase network request.

`scripts/firebase-worker-aliases.mjs` resolves the installed SDK's public browser entry metadata. `next.config.ts` applies exact Firestore aliases only to server compilation when `TAKEME_WEB_RUNTIME=cloudflare`. Ordinary Next/demo/Netlify builds retain their existing resolver. It does not change global resolver conditions, swap Firestore for Lite, introduce async initialization, change client APIs or touch Firebase Functions. The generated supported-trial server handler no longer contained the gRPC/proto-loader/descriptor/proto-path identifiers checked in the failing chain. [OpenNext workerd resolution](https://opennext.js.org/cloudflare/howtos/workerd).

Node `fs`, process spawning and hashing are confined to local build/release scripts and Next configuration. They are not Worker request handlers. Native image/filesystem/child-process code in backend Functions is not being migrated. Other framework dependencies are handled by the adapter; no general Node runtime equivalence is claimed.

## Prepared configuration and commands

Root `wrangler.jsonc` is manual OpenNext configuration: `.open-next/worker.js`, `.open-next/assets`/ASSETS, compatibility date2026-10-03, `nodejs_compat`, `global_fetch_strictly_public`, `WORKER_SELF_REFERENCE`, IMAGES, worker-first routing. It contains **no production routes/custom domains, account credentials or public SDK values**. Default workers.dev and alternate preview URLs are disabled. A separate named `preview` environment prepares `takeme-web-preview` with workers.dev enabled but preview URLs disabled; this is dormant local configuration, not an uploaded Worker or an Access policy. Names are proposed pending owner/account review.

Worker-first assets routing prevents static assets from bypassing Proxy/publication guards. `public/_headers` sets immutable caching only for versioned Next static assets. Observability remains disabled pending purpose-limited log/access/retention review. IMAGES enablement and costs must be qualified before cloud deployment. OpenNext image cache/local-IP semantics differ from Node Next, so preserve explicit origin tests; no custom loader or Storage migration was added. [OpenNext images](https://opennext.js.org/cloudflare/howtos/image).

`open-next.config.mjs` invokes `npm run build -- --webpack`; the existing release wrapper and rules/configuration gates remain authoritative. `cloudflare:build` supplies only the Cloudflare compilation selector, checks the supported Next floor, adapts the output, revalidates transformed Next provenance and records the final Worker/assets. `cloudflare:check` accepts no approval/offline override and verifies hashes/proofs/configuration. The manifest binds Wrangler, OpenNext config, lockfile, Next provenance and final output; no SDK values are logged in it.

Future local build/check, after approved dependency adoption and all actual release prerequisites:

```sh
npm run cloudflare:build
npm run cloudflare:check
```

Future deployment command, **not executed**:

```sh
npm run cloudflare:check && npx --no-install opennextjs-cloudflare deploy --config wrangler.jsonc
```

Future protected preview deploy would select `--env preview`, only after separate access/backend/artifact approval. Upload, cache population and Git auto-deploy are cloud writes and are not authorized here. Current root cloud build deliberately refuses unapproved legal/policy/deletion configuration and unsupported/missing dependencies. Do not enable flags to make it pass.

## Environment inventory

Owner-confirmed identity: project `takeme-52b80`, number367115645204, Web App TAKEME Web, exact bucket `takeme-52b80.firebasestorage.app`. Registered values were used only in private offline configuration; no tracked SDK config, dotenv or secret file was created.

| Name / group | Mapping |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Exact registered owner-supplied values via Workers Builds public build variables; not reproduced in source/report |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Owner-confirmed registered Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `takeme-52b80` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Exact confirmed `.firebasestorage.app` bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Owner-confirmed project number |
| `NEXT_PUBLIC_SITE_URL` | `https://takeme.my` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Explicit `false` for real web release |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional supplied value; current app does not initialize Analytics; do not activate it implicitly |
| `TAKEME_RELEASE_TARGET`, `TAKEME_FIREBASE_PROJECT_ID`, `TAKEME_STORAGE_BUCKETS` | Explicit production build qualification identity/exact bucket, matching public proof |
| `TAKEME_DELETION_ENVIRONMENT`, `TAKEME_ENABLE_PRODUCTION_DELETION` | Existing build qualification requires separately approved deletion readiness. Execution remains off now; these are not Worker runtime activation controls |
| `TAKEME_WEB_RUNTIME` | Cloudflare build wrapper supplies `cloudflare`; ordinary development unchanged |
| `NODE_VERSION` | Workers Builds22.23.2; Next/adapter supply production mode |
| `PROTECTED_PAYMENTS_ENABLED` | Absent/false; no payment activation |
| Emulator/debug/offline variables | Never inherited into real CI/release; offline marker forces nondeployability |
| Future private server credentials | Cloudflare Secrets/runtime or scoped build secrets as appropriate, never NEXT_PUBLIC/Git/logs. Current website needs no service-account, Admin or OAuth private key |

Build variables and Worker runtime bindings are separate. Browser Firebase settings are compiled; runtime variables cannot repair a mismatched browser bundle. SSR references and public proof must remain consistent. No raw Firebase service-account credential is needed to move the website. [OpenNext environment handling](https://opennext.js.org/cloudflare/howtos/env-vars).

## Local validation and limits

- Owner SDK/project/bucket consistency passed offline structural checks. The compiled deletion validator accepted only the exact project/bucket in pure test data and refused actual disabled/unapproved execution and mismatches. No Admin initialization or production IO occurred.
- App tests135/135; lint, TypeScript and diff checks pass. Earlier backend build65/65 and22 serial demo integration suites remain valid because Functions/rules/SDK runtime logic were not changed by hosting preparation.
- Supported private standalone Next/OpenNext build passed. Final adapted artifact:1,876 hashed files, four browser proofs and six worker proofs. Ordinary release validation refuses its offline purpose.
- Local workerd HTTP checks covered app shells/RSC, legal guards, static JS/fonts, image resizing and origin rejection. Account actions, real OAuth, Storage uploads, messaging/deals and production resources were deliberately not exercised by this offline trial; they belong in the approved preview smoke checklist.
- Final local Wrangler JS bundle measured11,396,727 raw bytes and2,628,997 gzip bytes, below the documented compressed free/paid script limits at this observation. This is local measurement, not platform admission/startup/CPU/billing certification. Assets and module overhead need final platform validation. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- Build Node transports were denied, except the reviewed native esbuild executable for local compilation. Local runtime allowed loopback Node transport; Wrangler's external Request.cf probe was denied and used a placeholder. No Firebase application fetch/init occurred. These guards are not an OS-wide/native-workerd network sandbox.
- Raw Next artifacts were inspected: no forbidden local/fixture/emulator values in served HTML/CSS or effective configuration. Vendor/dead helper demo-recognition strings remain distinct from configured endpoints. Final Worker hashes/proofs and sampled runtime HTML were checked; no raw-zero-substring claim is made.

## Remaining blockers and owner handoff

Adopt the supported dependency tuple and lockfile in the checkout, repeat final local qualification, approve Cloudflare account/Worker/plan/Images and protected preview backend/access, and complete actual release prerequisites. Live Firebase index/rules/Functions/scheduler/TTL/IAM/retention/monitoring status remains unqueried. Legal publication/final policy acceptance/deletion activation remain blocked. Preview Auth hostname authorization, real OAuth, browser hydration/commerce/upload smoke and DNS/certificate/Netlify rollback inventory need a separately approved plan.

The full GitHub integration requirements, all requested screen/action smoke checks, workers.dev access/backend isolation, apex/www308 cutover and Netlify rollback are in [Cloudflare migration plan](cloudflare-migration-plan.md). No Firebase backend service migration is proposed.

## App Check follow-up (hardening, not independently a launch blocker)

No `initializeAppCheck`, provider initialization or callable `enforceAppCheck` exists in current app/backend source. Owner Storage console observation shows Configure App Check; it is evidence of apparent non-enforcement, not a live API check. Nothing was enabled.

Future rollout: register TAKEME Web with a reviewed reCAPTCHA Enterprise provider/domain/privacy configuration, add attestation/auto-refresh and deploy only after separate approval, then observe valid/missing/invalid token metrics before enforcing Storage and Firestore. Add callable `request.app` observability without rejection first where applicable, cover supported clients, then selectively enable `enforceAppCheck`. Keep local debug tokens out of production/Git. Scheduled/background Admin jobs use IAM rather than browser attestation.

The current SSR metadata HTTP callable has no App Check header. Blanket callable enforcement would break that caller; design verified caller coverage or a separately secured public metadata path before enforcement. App Check complements ownership/rules/authentication and endpoint abuse controls; it does not replace them. Roll out one service/endpoint group at a time with metrics, compatibility checks and documented rollback. [Web setup/monitoring](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [metrics](https://firebase.google.com/docs/app-check/monitor-metrics), [enforcement](https://firebase.google.com/docs/app-check/enable-enforcement), [callable handling](https://firebase.google.com/docs/app-check/cloud-functions).
