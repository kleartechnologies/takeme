# Cloudflare Workers website migration plan

Prepared 3 October 2026. **Local preparation only; no permission to upload, deploy, publish, connect GitHub, change DNS or activate Firebase production behavior.** Cloudflare replaces the website host only. Firebase Auth, Firestore, Storage, Functions, rules, indexes, scheduled jobs, policy mirror and account-deletion execution remain separately controlled. Preserve the existing Netlify website as a rollback option.

This plan does not certify the current Cloudflare/Netlify account, DNS, certificates, billing, OAuth providers or live Firebase configuration. No production API or customer-data access was used. The technical build/adapter results belong in [Cloudflare hosting qualification](cloudflare-hosting-qualification.md); this document is the owner checklist and future migration procedure.

## Adapter choice and compatibility hold

Use manual OpenNext qualification as the first candidate because it adapts the existing `next build` output, retaining TAKEME's approved Next.js implementation and release gates. Cloudflare's current default recommendation is vinext, which reimplements Next APIs through Vite and remains beta. Adopting it would require broader build/render/image/font and screen regression review. Do not allow automatic Wrangler configuration to select a framework migration silently. [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [OpenNext overview](https://opennext.js.org/cloudflare), [vinext compatibility](https://github.com/cloudflare/vinext).

The broad documentation still says Node middleware is unsupported, but upstream [OpenNext PR #1309](https://github.com/opennextjs/opennextjs-cloudflare/pull/1309) merged experimental Node middleware/`proxy.ts` support on 25 August 2026. Treat this as an exact-package/runtime qualification question rather than a categorical unsupported claim. TAKEME's `src/proxy.ts` is a publication boundary: the selected adapter must preserve legal-route 404, no-store and noindex behavior in `workerd`, including query and trailing-path variants. Do not remove the boundary or set a Proxy runtime override; Next 16 Proxy uses Node by default and rejects that override. [Next Proxy documentation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

Current repository Next.js is **16.3.5**. Package qualification found latest adapter **1.20.8** requires a newer compatible Next 16 patch, **16.3.8 or later**. A private **1.20.6** probe on exact Next16.3.5 packaged but failed ordinary Worker rendering. A supported private Next16.3.8/OpenNext1.20.8 trial with the Cloudflare-only Firestore browser alias subsequently passed local render/guard/image checks. That older probe is not approval to pin an outdated adapter for public release. **Owner review is required for a compatible current Next patch, matching tooling, adapter/Wrangler versions and lockfile update, followed by full regression/security/Workers-runtime qualification.** No root dependency upgrade or peer-dependency bypass is authorized by this plan. Do not use `--force` or `--legacy-peer-deps` to declare compatibility.

`next/image` also needs a reviewed Cloudflare Images binding or loader. Validate local assets, Firebase images, Google avatars, responsive sizing and failures. OpenNext documents differences in image cache behavior and local-IP handling, so retain the strict production host allowlist and reject loopback patterns. Images service enablement/cost is an owner action. No current ISR/time-based revalidation requirement was identified; avoid automatically creating R2, Durable Objects or Queues without a demonstrated need. [OpenNext images](https://opennext.js.org/cloudflare/howtos/image), [caching](https://opennext.js.org/cloudflare/caching).

## Local build contract

Root owns the local configuration and scripts. The candidate root configuration is `wrangler.jsonc`; it should point to `.open-next/worker.js` and `.open-next/assets` with `ASSETS`, pin a reviewed compatibility date, enable `nodejs_compat`, and explicitly set `workers_dev:false` and `preview_urls:false`. Prepared configuration has **no attached production routes/domains**. A compatibility date and local configuration file do not create a Cloudflare resource.

The intended local script contract is:

```sh
npm run cloudflare:build
npm run cloudflare:check
```

`cloudflare:build` must retain the existing gated build, then adapt it and record a manifest binding the effective configuration, adapter/tool versions, Wrangler configuration and final Worker/assets. `cloudflare:check` must verify those final hashes/proofs and reject stale, modified, demo, unknown or synthetic qualification output for ordinary release. Existing `.next` provenance alone does not qualify the converted `.open-next` artifact. OpenNext's CLI can invoke the package build script; do not replace TAKEME's checked build with bare `next build`. [OpenNext CLI](https://opennext.js.org/cloudflare/cli).

Local `workerd` checks must cover dynamic listing metadata, navigation/404s, static assets/fonts/images, Auth initialization proof, private/public routes, blocked legal drafts and account-deletion availability. Use only explicit demo emulators or the protected offline qualification harness; no production reads. Offline/synthetic artifacts remain nondeployable, even if their structural checks pass. A private-workspace probe cannot certify the root lockfile or a release artifact.

## Owner confirmations before connecting services

- [ ] Confirm Cloudflare account/zone ownership, Workers plan/limits, Images requirements, billing alerts and a release/incident owner.
- [ ] Confirm the intended GitHub repository, its actual root directory, reviewed branch/commit and authorized maintainers. A local directory name is not proof of the remote repository layout.
- [ ] Confirm the registered Firebase Web App/project/bucket values through the existing separate resource qualification. Supply no invented identifiers, Admin keys or provider secrets.
- [ ] Confirm the existing Netlify site/deployment, source commit, domain association, certificate and recoverable configuration. Preserve them until rollback retirement is separately approved.
- [ ] Confirm DNS ownership/nameservers, current apex/www records, TTLs, DNSSEC state and mail/TXT records. Do not infer these from repository prose.
- [ ] Confirm final legal/publication approvals, policy-version handoff, operational readiness and any separately approved deletion activation. Hosting preparation grants none of these approvals.
- [ ] Approve a named release window, smoke accounts/data plan, stop conditions and rollback authority before any remote upload or cutover.

## GitHub Workers Builds: future owner setup

Cloudflare's GitHub app should receive access to **only the intended repository**. Record the selected production branch rather than assuming `main`; The current checkout Git root is the application root and its origin host is GitHub, so the corresponding current repository build root is `.`; verify the selected repository/branch retains that layout. Pin `NODE_VERSION=22.23.2` in Build Variables; this version is available in the documented build image. Keep the reviewed package/lockfile installation reproducible. [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/), [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).

Future production Build command:

```sh
npm run cloudflare:build && npm run cloudflare:check
```

Future Deploy command, **only after separate upload/deployment approval**, using already installed locked tooling:

```sh
npx --no-install opennextjs-cloudflare deploy --config wrangler.jsonc
```

The adapter command must not rebuild an unchecked artifact or bypass the final check; root must verify the selected CLI version's exact packaging behavior. These are future instructions, not commands executed by this document.

**Connecting a production branch creates an automatic deployment path:** a push normally runs build then deploy, and the default deploy command is `wrangler deploy`. Do not connect or trigger it during local preparation. Disable preview builds until a separate preview plan is approved. Restrict review/merge access and do not let untrusted branch changes access production build secrets. Changes to build settings apply to the next/retried build, so capture the final reviewed settings with the release. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [branch behavior](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

## Build versus runtime values and secrets

Workers Builds variables/secrets exist only during the build; runtime Variables & Secrets are separate. Next embeds `NEXT_PUBLIC_` values in client output. Supply the six registered Firebase public Web values at build time, plus exact `NEXT_PUBLIC_SITE_URL=https://takeme.my`, explicit `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` and the approved release/resource qualification inputs. Record names and proof/hash, not values, in review output. [OpenNext environment variables](https://opennext.js.org/cloudflare/howtos/env-vars).

| Configuration | Handling |
| --- | --- |
| Six `NEXT_PUBLIC_FIREBASE_*` Web identifiers | Registered public client configuration; build-time consistency checks required; do not substitute demo/synthetic values |
| Site URL and emulator selection | Explicit build-time values; normal release must reject missing/loopback/demo state |
| Runtime metadata/resource configuration | Supply the required names separately at runtime where used; compare with the built proof and intended resources |
| Private Cloudflare build/deploy credentials | Managed scoped owner configuration; no Git, logs, public variables or printed values |
| Firebase Admin/OAuth private credentials | Not required by this website migration; do not request, copy or embed them |
| Firebase deletion/policy activation | Separately authorized Firebase/backend release controls; never copy activation flags into Worker runtime as a hosting shortcut |

The current normal release gate intentionally requires approved policy/publication/deletion qualification. Do not enable flags merely to make a build pass. A build-time qualification input does not authorize a change to the Firebase Functions environment, policy mirror, rules or Scheduler. Actual production policy source and independent legal publication readiness remain unapproved. No `.env.local` is created or modified. Dashboard-only runtime variables may need the adapter's reviewed `--keep-vars` handling on future deployment; otherwise manage a single reviewed configuration source to prevent accidental overwrite.

## Preview authorization and isolation

`workers.dev` is public when enabled. `workers_dev:false` alone does not disable Version or Preview URLs; keep `preview_urls:false` and preview build controls explicit. Before any approved remote preview, protect every enabled Preview/Version/Deployment hostname with Cloudflare Access restricted to named reviewers, and verify signed-out denial before sharing. Noindex is not access control. [workers.dev behavior](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Wrangler settings](https://developers.cloudflare.com/workers/wrangler/configuration/), [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

New Worker Previews have separate variables/secrets/bindings and do not inherit production settings, but this does **not** isolate external Firebase. A preview client with production Firebase identifiers can still call production Firebase. `127.0.0.1` emulators on this Mac are unavailable to a remote Worker/browser. A remote preview therefore requires a separately authorized dedicated non-production backend or reviewed no-network mode with a deployable safety boundary; the current synthetic qualification artifact cannot be uploaded. Do not whitelist preview Auth domains or copy production secrets automatically. [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/), [resource isolation](https://developers.cloudflare.com/workers/previews/resources/).

Uploading a version or creating a protected preview is still a cloud mutation and requires explicit approval. Preview permission must state the endpoint, access policy, backend target, whether data mutations are allowed, approved testers/fixtures and cleanup ownership. Legal drafts/publication, policy acceptance and production deletion remain disabled throughout preliminary hosting verification.

## Approved preview smoke checklist

- [ ] Confirm immutable candidate, dependency/adapter versions, manifest/hash and backend/environment proof. Reject synthetic or demo artifacts for a real release.
- [ ] Verify Access denies anonymous visitors on every alternate preview/version hostname; ensure no production domain is attached.
- [ ] Test 390×844 and 1440×900: Home, Explore, Profile, Messaging, Product/Auction, Sell, Updates, Saved, Settings and Auth navigation without redesign.
- [ ] Check static fonts/assets and allowed remote images, responsive layout, keyboard/focus, dynamic metadata, refresh/deep links and genuine 404 behavior.
- [ ] Verify blocked legal paths, alias/query/trailing-path bypasses, and no draft content/cache exposure. Do not treat a preview as final legal publication.
- [ ] Test Auth/reset/Google popup only against the explicitly approved test backend/mailbox; confirm safe redirects and re-consent without production account creation.
- [ ] With authorized dedicated buyer/seller accounts, run one bounded safe message/offer/counter/accept journey and private-data isolation checks. Avoid fake completions/reviews/reputation.
- [ ] Test account-deletion display/config only unless actual deletion of a disposable test account is explicitly approved; resolve obligations first.
- [ ] Confirm no unexpected production calls, console credential output, stale emulator endpoints or private content caching.
- [ ] Remove/cancel test listings and obligations through authoritative flows, then clean disposable accounts according to retention policy. Never clear shared collections or manually bypass lifecycle controls.

### Full requested feature matrix

Every stateful check below needs the separately approved non-production preview backend and disposable account plan. The current offline trial cannot authenticate or fetch Firebase data.

| Screen / action | Required preview check |
| --- | --- |
| Home | Mobile390×844/desktop1440×900, discovery cards, navigation, images and hydration |
| Explore | Search/filter/sort/pagination, empty/error states and safe location display |
| Email/password Auth | Register/login/logout/reset,18+ consent/profile/welcome flow, guarded return intent and recovery |
| Google Auth | Real popup/callback/cancel against approved provider/preview domain; no production account creation |
| Product Detail | Public deep-link/refresh, gallery, seller/reviews/Similar Items, truthful price/delivery and sticky Chat/Offer |
| Auction | Dedicated isolated fixture only; bid increment, highest/outbid/history, ending/ended states and safe chat handoff |
| Sell / Create Listing | Fixed and auction create/edit validation, drafts, minimum photo flow, no accidental duplicate submission |
| Firebase Storage upload | Disposable owner images, JPEG/PNG/WebP limits, preview/download/error/removal, cross-user denial and cleanup |
| Messaging / Offers | Buyer offer → seller counter → buyer acceptance; keyboard/focus, unread/seen and participant privacy |
| Updates | Notification read/read-all, deep links, preference behavior and empty/error states |
| Saved | Save/unsave, collections/searches, Following safe projection and no private-location leak |
| Profile / Settings | Own/public views, naming/preferences, logout/re-auth redirects, all approved screen regressions |
| Privacy / Terms |404/no-store/noindex/no-draft until separate publication; final approved routes only after final legal authorization |
| Help / Contact | Help content/support mailto works; Contact remains404 until separate legal publication approval |
| Account Deletion | External/in-app routing, owner re-auth/errors/availability; destructive test only separately approved disposable account |

## Apex/www domain migration: future owner checklist

Canonical remains **https://takeme.my**. Cloudflare Custom Domains require an active owned zone and create DNS/certificates; they are not inert preparation. Existing CNAME conflicts must be resolved only as part of an approved cutover. [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

1. Capture the current DNS zone, apex/www targets, TTLs, nameservers, DNSSEC/DS state and Netlify domain/certificate/last compatible deployment references. Preserve all MX, SPF, DKIM, DMARC, verification and unrelated records. If Cloudflare is not already authoritative, obtain separate nameserver/DNSSEC migration approval.
2. Validate the approved protected candidate and rollback origin before cutover. Confirm required HTTPS certificates, Firebase Auth authorized production domains and real OAuth callback behavior through separately approved owner checks; changing hosting does not authorize provider edits.
3. Prepare the apex Worker Custom Domain and an exact `www.takeme.my` permanent redirect to the apex, preserving path and query. Prefer 308 when method preservation is required. Cloudflare Redirect Rules default query preservation off, so enable it explicitly. Do not accept an arbitrary redirect destination from request input. [Redirect settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/).
4. Obtain explicit approval for domain attachment/DNS changes and any public publication. Attach only reviewed domains; do not publish `workers.dev` as an alternate live site. Ensure HTTP redirects to HTTPS without loops.
5. Verify apex/www HTTPS, exact redirects with path/query, certificate status, canonical metadata and approved public route statuses. Run the separately authorized minimal production smoke plan using dedicated accounts, not real customer data.
6. Watch Worker failures/latency/cost, Firebase denials/read amplification, Auth/OAuth failures, image errors and backend job/deletion ledgers. A website cutover does not activate or certify backend schedules.
7. Keep Netlify intact throughout the agreed observation period. Retiring its site, domain association, secrets or deployment history requires separate approval.

## Rollback and incident ownership

Name the release/rollback decision owner, DNS operator, Firebase/backend owner and incident contact before cutover. Agree stop conditions: unexpected private-data exposure, wrong backend/config proof, widespread Auth/provider failure, legal guard failure, broken critical marketplace action, severe image/runtime failures or uncontrolled cost. Do not invent numeric thresholds without an operational decision.

Preserve Netlify's last compatible artifact/configuration and ensure its retained origin and certificates still work. A DNS rollback removes/replaces the new Worker Custom Domain route as needed and restores the captured Netlify apex/www targets; propagation and cached DNS may delay recovery. Do not delete the Netlify site or assume certificate validity indefinitely. If Cloudflare became the DNS provider, restoring the website origin does not necessarily require moving nameservers again; use the approved captured record plan.

Cloudflare Worker version rollback is an additional option, distinct from DNS rollback. Verify the selected version's bindings/configuration and compatibility first. Neither rollback reverses Firebase user/data changes or legal/deletion activation. Do not roll back to weaker historical Firebase rules, restore deleted accounts, purge retained marketplace history or redeploy backend services during a web incident without separate incident authority. [Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Approval boundary

This plan authorizes no cloud action. Dependency/patch changes and final local compatibility acceptance need owner review; GitHub connection, any Worker upload/preview/deployment, Cloudflare Images provisioning, Access policy, domain/DNS cutover, Auth provider/domain changes, legal publication, final policy activation and production deletion each require their applicable separate authorization. Stop after local preparation and qualification reporting.
