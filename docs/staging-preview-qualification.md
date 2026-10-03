# TAKEME staging safeguards and preview deployment plan

4 October 2026. **Owner-approved local checkpoint; no deployment or staging branch creation approval.** Reviewed dependency baseline: `main` at `62fc03421d0d4f38b8796dfe38c56ca61b4ffda7`. The owner approved committing these safeguards, tests and plans locally. Next.js/eslint-config-next 16.3.8, OpenNext 1.20.8, Wrangler 4.147.0 and Node 22.23.2 are retained; no dependency installation or global configuration change was needed.

## Confirmed identities and current state

| Environment | Firebase resources | Website |
| --- | --- | --- |
| Local | `demo-takeme`, loopback emulators | `http://localhost:3000` |
| Staging | `takeme-staging-822a5`, project number 887697506010, TAKEME Staging Web, exact bucket `takeme-staging-822a5.firebasestorage.app` | Planned `https://takeme-web-preview.takeme-technologies.workers.dev` |
| Production | `takeme-52b80`; completely outside this task | `https://takeme.my`; current Netlify/DNS untouched |

Owner confirms staging Blaze, `(default)` Firestore, Storage and registered Web App, plus Email/Password and Google Auth enabled. These are owner confirmations, not observations from a cloud API. Cloudflare account is `3ade68940865285d676a83971b23b4d4`; confirmed account subdomain is `takeme-technologies.workers.dev`.

The prepared Worker name is `takeme-web-preview`, Wrangler environment `preview`. Its hostname is derived from that name and the confirmed subdomain; no Worker or live URL was created or queried. The account subdomain alone is not the TAKEME application URL. A changed Worker name/origin requires coordinated review of the shared identity, build variables, Access, Auth domains and artifact bindings.

`staging` is the sole approved future branch for this Worker. It does not yet exist. Create it later from the reviewed **main commit containing these approved safeguards**, not from a dirty checkout or a guessed remote revision. All other branch previews must initially remain disabled.

## Implemented local safeguards

- The shared staging identity is explicit and contains no registered API key, App ID, credentials or tester email. Staging release validation binds the six SDK fields, project number, exact Auth domain/bucket and exact HTTPS origin; it refuses missing SDK values, emulator variables, production/demo/local resources and conflicting activation flags.
- Staging builds use purpose `staging-preview`. Production release checks reject their purpose, project and policy versions. Browser initialization checks both build proof and the actual reused Firebase app options before acquiring services. Server listing metadata resolves an approved staging Functions endpoint before fetch, refuses redirects and filters media to the staging bucket.
- The preview entry wraps the existing OpenNext Worker. An exact staging origin/configuration and a live RS256-signed Cloudflare Access assertion with the reviewed issuer, audience and approved tester email are required before Next or assets execute. Missing Access configuration denies requests. Public signing keys are fetched only from the reviewed Access issuer, with a bounded timeout/cache; tokens and addresses are never logged.
- Worker-first asset routing covers static files as well as application routes. Responses carry `noindex, nofollow`; dynamic responses are `no-store`. Staging has a visible test-environment banner. A staging-only image CSP restricts browser-direct/unoptimized Firebase images to the exact bucket; Next's remote image pattern is also bucket-specific. Local upload previews and Google profile images remain permitted. These image restrictions still require real browser/redirect and adapter-image tests.
- The separate test policy version is `1.0-staging`, with 18+ confirmation enforced by the existing backend/rules architecture. Demo remains `1.0-draft`. Production policy publication remains false with null final versions, and independent legal-publication readiness remains blocked. Test acceptance cannot qualify as production acceptance.
- Functions policy/deletion qualification checks managed project metadata, Admin app project/bucket, explicit staging selection and absence of emulator/production contradictions. Staging deletion is **off by default** and needs its own explicit activation after resource review; production deletion remains off. The explicit staging policy-mirror initializer creates only a missing matching mirror, accepts an already matching mirror, and refuses an existing revoked/mismatched mirror without overwriting it. It is not a public callable or automatic onboarding side effect.
- Next and Worker/assets provenance checks bind configuration, output inventories, Wrangler environment/account/Worker/origin/routing, lockfile, Access wrapper source hashes and the recorded Git revision/build branch/build-source fingerprint. The deployment plan requires an artifact originally built on `staging`. A copied artifact from another revision/branch or a changed source inventory is refused. Changing routing or wrapper/configuration after recording requires rebuilding/rechecking. Inert source/vendor strings used for refusal checks are distinct from effective resource configuration; a raw string's presence alone is not proof of a production request.
- Checked-in `workers_dev` and `preview_urls` remain false at both default/preview scopes; no custom-domain routes exist. Only the reviewed preview `workers_dev` switch may later be activated, after separate approval; other routing remains disabled. The plan command has **no deployment implementation** and rejects execution overrides.

## Registered SDK input and environment mapping

No staging SDK configuration was loaded in this session. Repository inspection found only `.env.example`, and the current shell does not supply the registered staging values. The SDK **location/mechanism** is still needed; the owner should not paste values into chat. No `.env.local` was created or changed.

For local qualification, the scripts accept either all six public SDK environment variables or `TAKEME_STAGING_CONFIG_FILE` pointing to an existing ordinary absolute JSON file outside Git. The JSON may contain only `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` (or the corresponding six `NEXT_PUBLIC_FIREBASE_*` names). Scripts do not execute the file, load arbitrary dotenv, follow a file symlink, read provider credentials or print its values; conflicting shell/file values are refused. Extra fields, including a service-account key, are refused. The loader supplies known guard defaults, never missing registered SDK values. Format/project-number checks cannot independently prove that an API key/App ID belongs to the registered Web App; owner provenance and later staging-console verification remain necessary.

| Input | Future location and value |
| --- | --- |
| Six `NEXT_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/STORAGE_BUCKET/MESSAGING_SENDER_ID/APP_ID` fields | Registered staging Web App values in Workers Builds **build variables**; never production values or a tracked SDK file |
| `NEXT_PUBLIC_SITE_URL` | Planned exact preview origin, confirmed against the assigned Worker before activation |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Explicit `false` |
| `TAKEME_RELEASE_TARGET`, `TAKEME_FIREBASE_PROJECT_ID` | `staging`, `takeme-staging-822a5` |
| `TAKEME_STORAGE_BUCKETS`, `TAKEME_DELETION_ENVIRONMENT` | Exact single staging bucket, `staging` |
| `TAKEME_ENABLE_PRODUCTION_DELETION` | `false` everywhere in staging |
| `TAKEME_ENABLE_STAGING_DELETION` | `false` initially; future separate approval sets `true` for synthetic staging deletion tests |
| `PROTECTED_PAYMENTS_ENABLED` | `false`; no payment/integration activation |
| `TAKEME_WEB_RUNTIME` | Cloudflare build wrapper supplies `cloudflare` |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | Actual future Access HTTPS team origin and application audience; not guessed. Provision as preview-scoped runtime Secrets to preserve them across deployments; local plan also needs matching values |
| `CF_ACCESS_ALLOWED_EMAILS` | Preview-scoped runtime Secret containing a JSON array with only the single owner-approved tester address; not committed or logged |
| `TAKEME_PREVIEW_ACCESS_EVIDENCE` | Absolute private local JSON evidence file for the plan; not a Worker variable or tracked artifact |
| `TAKEME_PREVIEW_DEPLOYMENT_APPROVED` | `true` only after a separate actual owner approval; a local plan input, not permission inferred from this checkpoint |
| Cloudflare deployment authentication | Account-scoped approved integration/token through private provider/CI secret mechanism, never public variables/Git |
| Future private server credentials | Cloudflare Secrets if ever needed. Current website needs no Firebase Admin service-account JSON, OAuth client secret or payment key |

`NEXT_PUBLIC_*` values are frozen into the Next build; changing dashboard runtime values does not rebind an earlier artifact. Runtime guard values are separately scoped in `env.preview.vars`; the Access Secrets must also be set for that environment. Do not inherit production/local `.env`, emulator/debug/offline variables, dashboard production bindings or CI credentials into staging. [OpenNext build/runtime variables](https://opennext.js.org/cloudflare/howtos/env-vars).

## Owner setup and approval sequence

1. Review this source/diff and provide only the existing local SDK location/mechanism. Run the real registered staging build/check in an isolated checkout/output so the running demo `.next` is preserved. A missing configuration must remain a failure, not be replaced with guessed values.
2. Separately authorize the local checkpoint commit, reviewed main revision, later `staging` branch creation/push and GitHub integration. No such actions occurred here. Keep the four pre-existing unrelated untracked audit/probe files outside the release. A deployment plan requires a clean checkout, including no nonignored untracked files.
3. Before real staging writes, approve the exact Firebase backend deployment inventory and test-data/cost plan. All future Firebase commands must explicitly name `--project takeme-staging-822a5`; never use the production default in `.firebaserc`. No `firebase init`, Firebase Hosting, production data copy or production console change is needed.
4. Separately authorize staging Worker/resource creation. Bootstrap an inert **always-deny** Worker under the exact planned identity, with public routing disabled and no TAKEME app, Firebase calls or credentials. This is a distinct approved cloud write, not an operation performed by the plan command. Configure Access before any application deployment; do not connect an auto-deploying repository first.
5. In the exact Cloudflare account, complete Zero Trust setup if needed. For the dedicated Worker, use **Workers & Pages → that Worker → Access**, protect **All traffic**, then review its Access application in Zero Trust. Set an exact-email Allow policy for the approved tester, without Everyone, email-domain, Bypass or broad account-member allowance. Record actual application/policy IDs, team origin and AUD. Do not protect unrelated Workers account-wide. Worker-level protection covers its associated endpoints; preview-only protection would omit the stable workers.dev URL. [Cloudflare Access configuration](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
6. Review alternate routes/URLs and keep alternate previews disabled. Separately approve enabling only the inert Worker's workers.dev route for an Access probe, after its policy is configured. Verify the actual Access application/policy and tester allowlist, approved-user Access login and anonymous edge denial: 401/403, or 302 only when the redirect origin is exactly the reviewed Access team origin. A route 404 or the inert/app guard's own 403 alone is not proof of Cloudflare Access protection. Keep app content absent throughout this probe; record evidence for the reviewed target revision and refresh it within 24 hours of the plan check. Do not retain full login URLs/query tokens.
7. Set matching preview Access Secrets. After separate full-app routing/deployment approval, change only the source preview `workers_dev` to true, rebuild/revalidate on `staging`, and run the plan against matching evidence/revision. The full app is still undeployed at this point. Deploy only after the checks and owner approval; immediately verify assertion delivery and both platform/in-Worker gates before interactive tests. Keep top-level routing and all `preview_urls` false. There is no requirement to attach a custom domain or change DNS.
8. Only after the first protected/manual preview passes should the owner connect the selected GitHub repository to this dedicated Worker. Configure the **staging** branch before enabling automatic builds, and do not accept Cloudflare's default repository branch. Keep automatic deployment paused until explicitly approved. Review the installed app/token's repository and account scope.

Cloudflare's dashboard calls the branch that deploys this particular Worker its “production branch.” Set that field to **staging** for this staging Worker; it is not TAKEME production. In **Settings → Build → Branch control**, leave **Enable Preview Builds unchecked**. Do not run `wrangler preview` or enable builds from main/other branches. Use root directory `.`, Node 22.23.2 and reproducible `npm ci --include=dev`; OpenNext/Wrangler are required build dependencies. [Workers Builds branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

## Future staging build and deployment commands

These are **commands to run after the relevant approvals/input setup**, not commands executed by this document. Use a clean, isolated reviewed checkout on `staging`; provide the registered SDK fields through the approved local/CI input. Default unqualified production commands are not staging aliases.

```sh
npm ci --include=dev
npm run release:validate:staging
npm test
npm run test:functions
npm run lint
npm run cloudflare:build:staging
npm run release:check:staging
npm run cloudflare:check:staging
npm run cloudflare:preview:plan
```

The adapter uses the existing gated webpack Next build and explicit `--env preview`. Output `.next`/`.open-next` remains generated and excluded. The plan binds the recorded build source/revision/branch as well as the current checkout (and Workers CI branch/commit when present), configuration/output provenance, actual routing and explicit owner approval. Evidence must record account/environment/Worker/site/revision, Access application/policy IDs, confirmed tester policy, anonymous-denial result/time, issuer/AUD and SHA256 of the canonical tester allowlist. It contains no passwords, JWTs, mailbox contents or Firebase credentials. Source/header tests and supplied evidence are not a live Access verification; the evidence must be reviewed independently. No fake evidence or approval flag is created here.

Future deployment command, **not executed**:

```sh
npx --no-install opennextjs-cloudflare deploy --config wrangler.jsonc --env preview
```

The plan never invokes this command. A successful plan does not independently authorize cloud writes. For approved Workers Builds, use build/check as the build command and plan-check followed by this exact named-environment deploy as the deploy command; a failed check must stop the chain. Private Access evidence must be supplied afresh through a controlled file/CI mechanism, not a committed fixture. Keep automatic deployments off until that review/refresh process is configured. Avoid invoking the bare deploy command outside this reviewed procedure.

## Firebase staging backend plan

Firebase remains Auth/Firestore/Storage/Functions/schedulers/deletion. No privileged SDK is added to the website Worker. Functions stay Node 22 in `asia-southeast1`; current source contains 100 deployable Functions (76 callables, 17 Firestore triggers, 7 schedules), with 49 composite indexes and 13 single-field overrides. These counts describe source, not remote readiness. Deploying all Functions also creates schedules that can execute immediately; review a restricted initial manifest and approve only the jobs needed for the planned smoke tests. Do not silently omit business-critical triggers or indiscriminately enable jobs.

After approval, configure Functions guard inputs from the mapping above in the **staging-only** server environment. Leave deletion false initially. The platform supplies managed project identity/Admin metadata and the exact default bucket; do not forge `GCLOUD_PROJECT` or supply a private service-account key. Verify resource/API readiness, managed IAM (including Storage rule cross-service Firestore access), scheduler identities, billing/alerts and required indexes READY. No remote availability/IAM was checked here.

Future deployment operations use explicit target selectors, for example reviewed additive indexes/rules with `firebase deploy --project takeme-staging-822a5 --only firestore:indexes,firestore:rules,storage`, and the reviewed named Functions subset with `firebase deploy --project takeme-staging-822a5 --only functions:<approved-function-name>`. The second string is a manifest placeholder, not a runnable whole-backend command. Release sequencing must keep traffic denied until compatible Functions/triggers, rules/indexes and the server-owned policy mirror are ready. No Hosting deployment is included.

An approved managed Admin operator must explicitly initialize `releasePolicies/current` using the staging-only helper and reviewed object: releaseTarget `staging`, exact project ID, publicationApproved `true`, termsVersion/privacyVersion `1.0-staging`, minimumAge 18. Test-policy approval is only for protected staging. No browser/public endpoint may create/repair the mirror. A mismatch/revocation stops initialization for review. Changing/revoking versions needs coordinated source/rules/mirror review; do not assume a mirror change alone revokes all Storage access.

Then independently qualify exact project/bucket/app/worker resources before enabling `TAKEME_ENABLE_STAGING_DELETION=true` in staging Functions and rebuilding the web availability configuration. Use only disposable synthetic accounts. Verify recent auth, pending obligations, idempotent retries, scoped Storage cleanup, Firestore cleanup/anonymisation, Auth deletion and actual retained records. Existing approved retention semantics remain:operation/audit data30days; other marketplace/case deadlines follow [account deletion](account-deletion.md). A requested or pending operation is not completed deletion.

Future TTL review is separate: `marketplaceEvents.expiresAt` 90 days, `intelligenceQuotas.expiresAt` 3 days, `discoverySessions.expiresAt` 2-hour validity, `discoveryAttributions.expiresAt` 7-day validity. No TTL was enabled; validity timestamps do not prove physical expiry. Deletion uses explicit gated cleanup rather than assuming TTL. App Check also remains unchanged; any future monitoring/non-enforced rollout and enforcement needs separate review. Do not enable unrelated Cloudflare Images/Stream/R2 products automatically; review the existing IMAGES binding's availability/usage/cost before upload qualification.

## Remote smoke-test acceptance checklist — not yet executed

Use separate approved tester-owned staging personas with synthetic marketplace names/data; Google OAuth may use the approved real tester identity. Password reset goes only to a tester-controlled mailbox. Never copy production accounts, conversations, listings, media or credentials. Access protects website requests, not direct Firebase API endpoints; before exposure, review staging API admission/rules/quotas and cost alerts. Do not claim Access makes Firebase inherently private.

Instrument the browser **and Worker/server fetch path** during qualification to deny unexpected production/project/bucket endpoints before a request is sent. Inspect Auth, Firestore, Storage and callable destinations against the exact staging identity; an inert denial-string reference is not a network request. Keep credentials/tokens/Storage download URLs out of network evidence and screenshots. Missing server-side instrumentation is a qualification gap, not evidence of zero production traffic.

| Area | Required acceptance checks |
| --- | --- |
| Access/isolation | Anonymous/deauthorized/unapproved tester blocked on Home, legal routes, dynamic routes, static assets and image optimizer; approved tester accepted; invalid/expired/wrong audience assertions refused; alternate URLs disabled; noindex/banner; no production requests |
| Public screens | Home, Explore, normal Product Detail, Auction Detail, public seller/Profile, Privacy, Terms, Help, Contact and `/account-deletion`; truthful test-policy/deletion wording; direct links/refresh/back/client navigation/RSC/metadata |
| Auth/onboarding | Email/password signup/login/logout/reset, 18+ and correct staging Terms/Privacy acceptance, profile/welcome, returning user and intent-safe redirects; real HTTPS Google popup/callback/onboarding/returning login; cancelled popup/Access session expiry |
| Auth configuration | Authorize only the actual staging Worker hostname in staging Auth; retain the registered staging Firebase Auth helper domain; review OAuth origins/redirect URIs if actually required. Never add takeme.my to staging or create broad Access bypasses. Qualify Secure/SameSite cookies and domain assumptions |
| Listings/images | Normal listing draft/publish/edit; multiple uploads, gallery/thumbnail/resize/fallback; avatar and listing ownership; forbidden production-bucket URL blocked; unauthorized/oversized uploads denied; deleted listing cleanup; check actual staging CORS before any staging-only change |
| Messaging/offers | Two staging personas: conversation/message, buyer offer → seller counter → buyer acceptance, stale/invalid/replayed actions, truthful deal status, keyboard/focus and sticky sheets |
| Auctions | Synthetic scheduled/start/live auction, bid/outbid/stale bid/self-bid/invalid bid rejection, end/winner state; only reviewed scheduled jobs; verify no unintended real purchase/payment |
| Updates/Saved | Generated updates, read/unread/deep links; saved listing/auction,followed seller, saved search and removal/privacy projections |
| Settings | Profile/address/meet-up/notification preferences, password reset/logout, account-deletion entry and policy/current-acceptance routing |
| Deletion | Disposable account, re-auth/recent-auth checks, pending/failure/retry, truthful cleanup/retention, Auth and exact bucket/Firestore outcomes,withdrawal/anonymisation and lifecycle guards |
| Responsive/runtime | 390×844, 430×932, 1440×900 and preferably one physical phone; hydration, safe areas, keyboard, sticky bars, modal focus, image upload/auth intent; Worker errors, deep links, RSC/client transitions |
| Bounded abuse | Small rapid-message/offer sequences, invalid/self/stale bid, unauthorized object, deleted/pending user, oversized upload, malformed listing; no stress/load test |
| Performance/cost | Record Home/Explore/Product first-load, cold Worker/image/RSC behavior; observe a single active auction's read rate. Current source polling is 10 seconds and lacks hidden-tab pause; do not infer improved behavior or rearchitect in this task |

Set purpose-limited staging logs/alerts only after review; record error classes/routes/timing rather than passwords, tokens, private messages, addresses or deletion evidence. Initially observability is disabled. Use short retention and restricted evidence access. Clean only scoped synthetic fixtures after checks pass; preserve necessary failing-test evidence privately for review. Repeat any failed area after a scoped fix before approval.

## Migration and rollback boundaries

Remote staging failure: keep the application denied or disable its workers.dev routing, pause staging Builds, preserve private evidence and restore the last reviewed **staging** Worker/backend-compatible version after incident approval. Before the first good preview there is no known-good Cloudflare version to invent. Do not roll back to weaker rules or restore deleted users. Stop failing staging jobs under approved incident scope; DNS/Netlify/production Firebase are unaffected.

Production cutover is a later task after this checklist passes and production legal/deletion/backend/artifact gates are separately satisfied. Record actual current Hostinger nameservers, DNS records/TTLs and Netlify targets/site/release before changes; these values were not queried and cannot be supplied as an “exact rollback” now. Review the Cloudflare zone/custom domain, TLS and canonical `https://takeme.my`; permanently redirect `www` to apex preserving path/query; verify production Auth and the separately built production artifact. Keep Netlify healthy and available through monitoring/rollback approval. Rollback restores the **recorded** original routing/targets, then verifies TLS and Netlify; DNS propagation is not instantaneous. Firebase production backend stays in Firebase. See [migration/rollback plan](cloudflare-migration-plan.md); nothing in this checkpoint changes DNS or authorizes cutover.

Future Stream/R2/video/seller/admin subdomains remain possible with separate Workers/services and resource/IAM/Access review; this preparation adds none of them.

## Verification and remaining holds

Completed locally: 163/163 app tests; 77/77 compiled Functions unit tests; full app TypeScript and ESLint; focused staging release/Access/artifact/isolation tests; generated-rule drift/diff checks. Existing demo services were verified loopback/`demo-takeme` before running representative suites serially: eligibility 9/9 groups (37 guarded mutation entries), onboarding 11/11, account deletion 32/32. Updated Firestore/Storage rules compiled and demo positive/negative acceptance/revocation/privacy/deletion checks passed. Demo mirror restored and services stayed healthy. Logs, random credentials, fixtures and results remain private/excluded.

The real staging validation was deliberately run without SDK input and **refused before any build/network operation**, naming missing fields without values. No registered staging optimized build/OpenNext artifact or workerd/browser runtime was qualified in this checkpoint. Pure tests use fabricated format-only SDK strings and ephemeral signing keys; they do not establish Web App registration or deployed Firebase behavior.

Holds before deployment:local SDK location and real build/artifact checks; reviewed clean commit/branch; actual Access team/app/policy/AUD/Secrets and denial evidence; staging backend/mirror/IAM/index/scheduler/deletion/cost qualification; IMAGES availability/cost; explicit permission for cloud resource configuration and preview deployment. Live Access, OAuth, Storage/CORS, Functions, remote responsive/runtime smoke checks remain unperformed. This is ready for **owner review of local preparation**, not a declaration that the remote preview is healthy.

This checkpoint authorizes a local commit only. No push, branch creation, GitHub connection, Worker creation/deployment, Firebase cloud access, DNS change, Netlify removal, production policy/deletion activation or production modification occurred.
