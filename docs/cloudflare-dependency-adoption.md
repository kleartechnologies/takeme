# TAKEME supported Cloudflare dependency adoption

3 October 2026. This extends the approved local hosting checkpoint `0fdfcc18fef073dd2c523ebf232192bcdb77422a` and records qualification before the owner-approved local dependency-adoption commit. No Cloudflare deployment, Git connection, DNS change, Netlify removal, production Firebase access, production policy activation or production deletion activation occurred.

## Before and after

| Component | Before | Adopted and installed |
| --- | --- | --- |
| Next.js | 16.3.5 | 16.3.8 |
| eslint-config-next | 16.3.5 | 16.3.8 |
| OpenNext Cloudflare | Absent | 1.20.8 |
| Wrangler | Absent | 4.147.0 |
| React / React DOM | 19.2.8 | 19.2.8, unchanged |
| Firebase Web SDK | 12.19.0 | 12.19.0, unchanged |
| Node | Installed 22.23.2 | 22.23.2, command/session selection only |
| npm | 10.9.8 | 10.9.8 |

Next accepts the existing React 19 peer range; no React update was necessary. The exact OpenNext and Wrangler package names and versions match the supported private qualification. No peer bypass or package-wide refresh was used.

## Changes and reproducibility

- `package.json`: pin Next and its matching ESLint configuration; add exact OpenNext and Wrangler development dependencies.
- `package-lock.json`: regenerated through normal npm resolution, then successfully installed with clean `npm ci --no-audit --no-fund` under Node 22.23.2. Installed target versions match the real lockfile.
- `scripts/build-cloudflare.mjs`: one metadata read now uses the installed ESLint package manifest file, because `eslint-config-next` does not export its `package.json` subpath. The same installed-version/lockfile check remains in place. Exact metadata resolution for all four build dependencies passes.
- This report and a historical-status link in the original hosting qualification document.

The lock contains 340 added and two removed package paths. Existing-version updates are the 12 Next-family entries only. Existing `picomatch` 4.0.7 and 2.3.2 and `fdir` 6.5.0 were relocated/deduplicated, not upgraded. Unchanged-version resolved URLs and integrity hashes remain identical; all tarballs use the HTTPS npm registry. Remaining metadata changes are npm's development/optional flags and libc metadata. This large textual lock diff comes from adopting the adapter toolchain and its transitive/platform packages.

Next configuration, OpenNext configuration, Wrangler bindings, the Cloudflare-only Firestore alias, application UI/CSS, Firebase configuration, Functions source, rules, policy source and deletion configuration are unchanged. No broad type casts or lint exceptions were added. Workers Builds must install development dependencies for the adapter/build tools; `npm ci --include=dev` is appropriate when the installation environment otherwise omits them.

## Verification

| Check | Result |
| --- | --- |
| Full application suite | 135/135 passed |
| Functions build and full unit suite | Build passed; 65/65 passed |
| Serial demo integration suites/probes | 24/24 scripts passed; no concurrent stateful suite |
| TypeScript | Passed with `--noEmit --incremental false` |
| ESLint | Full suite passed; changed build script also passed scoped lint |
| Cloudflare provenance regression tests | All eight groups passed again after the metadata fix |
| Ordinary optimized demo Next build, webpack | Normal gated build passed; 646-file Next provenance validated |
| Ordinary optimized demo Next build, default Turbopack | Exact `npm run build:demo` passed; 1,361-file Next provenance validated |
| Isolated production-mode Next build | Passed with fabricated offline configuration; ordinary release refused |
| Actual-lock OpenNext conversion and artifact checks | Both conversions passed: 1,876 hashed files, four browser proofs and six Worker proofs each; nondeployable outputs |
| Local Worker HTTP runtime | 75 assertions passed: 45 offline, 28 demo and two positive item-metadata checks |
| Demo Firebase SDK protocol reads | Four read-only callable checks passed; no production calls |
| Local Next HTTP route checks | 17 core route shells passed; login RSC and unavailable-route 404 passed |
| Positive Product / Auction / seller routes | Demo metadata titles and public seller route passed |
| Browser hydration and 390×844 visual checks | Not completed: browser URL security policy rejected the local-app action |
| Git diff / credential checks | Clean whitespace; no owner SDK literals, credentials or private paths in changed files |

The 24 integration scripts cover the existing 22-suite inventory plus the bounded marketplace-abuse suite and disabled-session probe. Coverage includes Auth/onboarding, Google emulator behavior, account deletion and retries, Settings, auction authorization/concurrency/finalization, transactions/offers, protected-flow denial, messaging/account isolation, engagement, Saved/Following, public seller/location privacy, metadata, listing lifecycle/removal, trust, promotions, profile, intelligence, admin and eligibility enforcement. The eligibility suite checks nine groups and 37 protected mutation entry points; account deletion checks 32 groups, onboarding 11 and Settings 10. Policy/18+ and deletion-pending guards remain authoritative. The demo policy mirror was restored after the suite.

Only the exact orphaned demo Firestore process was stopped before restoring the complete emulator environment. Auth 9099, Firestore 8080, Storage 9199, Functions 5001 and Emulator UI 4000 are healthy on explicit `demo-takeme`; the Next 16.3.8 demo app is available on port 3000. The background deletion worker remains off to preserve deterministic integration failure/intermediate-state assertions. No scheduler or TTL deployment occurred.

Positive item checks used a synthetic seller, fixed listing, scheduled auction and two images uploaded only to emulator Storage through the existing SDK/acceptance helpers and authoritative callables. No test password was saved or printed. Fixture identifiers and verification output are ignored/outside Git.

## Release and Worker boundaries

The actual `npm run cloudflare:build` and `npm run cloudflare:check` both refuse the current inactive production policy, legal publication and deletion approvals. This is the required fail-closed result, not a successful production release build. No flags or approval sources were changed to make those commands pass.

The equivalent isolated build/provenance checks use the installed, locked supported tuple with explicit nondeployable purposes. Offline output cannot initialize Firebase clients or pass ordinary release/artifact gates; demo output contains intentional emulator configuration and cannot become a production artifact. The shared development `.next` directory was not used for qualification builds. No generated Worker output was added to the repository inventory.

Worker checks cover route shells, RSC protocol responses, positive demo metadata, legal-path/query/trailing-path/prefetch guards, unavailable routes, immutable JavaScript assets, authentic self-hosted fonts, image resizing and origin restrictions. No tested request produced an unsupported Node API or protobuf/eval failure. The generated handler lacks the checked gRPC/proto-loader/protobuf-descriptor chain. Images were local/synthetic; no production Storage object was fetched.

The existing scan classifications and proof/hash checks were retained. The raw offline Worker scan reported 210 hit groups, with zero served HTML/CSS, fixture or emulator-host hits. Remaining localhost/demo/IP strings are inert SDK/framework/demo-recognition helpers; port occurrences are Next devtools and font metrics; two developer paths are framework example comments. Temporary-path occurrences are build module/trace identifiers, with no assets-JavaScript path groups or sampled runtime HTML leakage. They are classified rather than silently stripped. Demo artifacts deliberately contain emulator endpoints. Neither output is authorized for upload. Final artifact integrity was checked again after runtime tests, and all three isolated copies match the adopted lock hash.

The default Turbopack build needed an internal loopback IPC allowance and an enumerable font-response map. Its private font mock served the exact cached Poppins bytes through a temporary loopback HTTP server instead of webpack's filesystem URLs. The final build contains 12 SHA-verified WOFF2 assets and recorded 12 local font requests with no blocked external Node transport attempt. These were test-harness compatibility adjustments; the application font source and styles were unchanged. The owned font server was stopped.

Build/runtime transport guards are not an OS-wide native-code sandbox. Local Worker checks are HTTP/SDK protocol checks, not browser hydration or visual verification. Owned Worker runtimes were stopped after testing; shared demo services remain available.

## Compatibility and security findings

Next 16.3.6 fixes the critical `next/og` issue; 16.3.7 includes a Turbopack cancellation/read fix; 16.3.8 includes seven security fixes. The relevant TAKEME surfaces include image optimization and the local development server. No first-party `next/og`, metadata-image generators, Pages Router/ISR, root catch-all SSG, Cache Components, `use cache` or Draft Mode usage was found. No patch-level application API migration was required. [Next security release](https://nextjs.org/blog/september-2026-security-release), [Next 16.3.8 release notes](https://github.com/vercel/next.js/releases/tag/v16.3.8).

App Router/RSC, dynamic `force-dynamic` listing metadata and its `no-store` backend reads, public seller routes, image allowlists and authentication return-intent architecture remain unchanged. This website has no first-party custom API route handlers or Server Actions to exercise. No application cookie/header API migration was needed. Experimental upstream Node Proxy support remains an exact-version runtime assumption; the local legal publication boundary passed. These findings do not certify future unimplemented framework features.

Read-only npm audit reports nine high package entries and zero critical entries. These include propagated chains from two underlying high advisories, plus a low gRPC advisory, rather than nine distinct vulnerabilities. No advisory was reported for the adopted Next/OpenNext/Wrangler tuple. Remaining underlying packages predate this adoption:

| Package | Severity and conditions | TAKEME relevance and action |
| --- | --- | --- |
| `@grpc/grpc-js` 1.9.16 | High certificate authorization issue requires a gRPC server using `getAuthContext` with optional client certificates; low error disclosure also requires a gRPC server | No such server/API was found; TAKEME uses Firestore clients and the Worker alias excludes the Node entry. No applicable exploit path demonstrated. Review an upstream compatible patched dependency path separately; do not apply npm's suggested major Firebase downgrade. [High advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j), [low advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4). |
| `braces` 3.0.3 | High stack exhaustion with untrusted deeply nested glob input | Present only through the ESLint/Next plugin/fast-glob/micromatch development chain. No first-party untrusted-pattern use found. Keep CI/source inputs trusted and review upstream remediation separately. [Maintainer repository issue](https://github.com/micromatch/braces/issues/70). |

Installation warned about deprecated `node-domexception` 1.0.0, `glob` 9.3.5 and the existing ESLint 9.39.5 release. No automatic audit remediation, unrelated upgrades, overrides or downgrades were applied.

The disabled-session probe reconfirmed an existing limitation: a console-disabled account's cached token temporarily retains own Saved/avatar write access, while callables reject it. No cross-account access was demonstrated. This is a prior security finding, not a new dependency regression; it remains a separately scoped security decision.

## Remaining release prerequisites

The adoption does not authorize a workers.dev preview or production artifact. Final legal/policy approvals, production-route publication review and separately approved deletion readiness remain closed. Preview backend/data isolation, protected access, Cloudflare account/resource/binding and image-cost review, GitHub automatic-deployment boundaries, real browser/OAuth checks and explicit upload approval still follow the existing migration plan. No DNS cutover is authorized; Netlify remains rollback.

Mobile 390×844 inspection and browser hydration are still outstanding. The browser automation tool rejected opening `http://localhost:3000/` as a disallowed URL protocol. No raw CDP, alternate browser or UI workaround was used. HTTP checks and unchanged UI source are supporting evidence, not a visual pass.

Qualification was performed from HEAD `0fdfcc18fef073dd2c523ebf232192bcdb77422a` before staging or committing. The owner subsequently approved a local commit of this dependency adoption only. The earlier untracked production/abuse audit reports and two probes remain untouched and outside this commit's scope. Credentials, SDK values, screenshots, logs, emulator exports, generated output and private test tooling remain excluded. Push, deployment and cloud changes require separate owner approval.
