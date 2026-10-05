# TAKEME production release and operations runbook

Local preparation only, 5 October 2026. No production deployment, policy bootstrap, deletion activation, TTL change, schedule change, DNS change or website cutover has been executed. Netlify remains the rollback service. See `production-backend-parity.md` for the current read-only inventory and exact proposed resource changes, and `production-operations.md` for incident/monitoring ownership.

## Build qualification and launch approval

The reviewed client identity is the registered TAKEME Web app in `takeme-52b80`, project number `367115645204`, Storage `takeme-52b80.firebasestorage.app`, canonical `https://takeme.my`. Supply the six registered public Firebase Web SDK fields through the approved private environment mechanism; do not track SDK values, credential files or a new dotenv file. Private runtime credentials use managed platform identity or Cloudflare Secrets where actually required. A service-account key is not required by this website.

`npm run release:validate`, `npm run cloudflare:build`, `npm run cloudflare:check` and `npm run release:check` qualify a real **production-build** artifact. They bind actual public client configuration, exact resource identity, generated policy blocks, reviewed implementation and artifact hashes. An honestly unpublished/null policy and deletion execution OFF can pass this implementation/build stage. It is neither launch approval nor authorization to deploy. Demo, staging and synthetic offline artifacts cannot be promoted by supplying a production environment afterward.

`npm run release:launch` is the separate final launch gate. It requires actual central final Terms/Privacy versions, publication approval, independent final-content/BM/address/route readiness decisions and explicit production deletion activation. There is no environment or CLI approval override. Until those decisions exist, the checker must reject launch. Policy acceptance and marketplace mutations also fail closed independently on the server and in generated rules. Production legal routes require approved source readiness and a matching production proof; Help and deletion information remain truthful public information without activating acceptance/deletion.

```sh
# LOCAL qualification only; registered values already supplied privately.
npm ci
npm run release:validate
npm run cloudflare:build
npm run cloudflare:check
npm run release:check
# Must refuse while actual launch approvals/activation remain absent.
npm run release:launch
# No cloud write; must refuse missing actual policy/legal approval.
npm run policy:production:plan
```

Do not use `qualify:offline` output for deployment: that older harness deliberately uses a synthetic policy/proof and disables Firebase initialization. Current qualification uses the real source and real public configuration. If public SDK initialization occurs during local browser inspection, deny external network at the test boundary, rather than altering source/proof or allowing production customer-data requests.

## Required environment inventory

| Input | Reviewed state |
| --- | --- |
| `TAKEME_RELEASE_TARGET`, `TAKEME_FIREBASE_PROJECT_ID` | `production`, exact owner-confirmed project |
| Six `NEXT_PUBLIC_FIREBASE_*` SDK fields | Actual registered Web App values, privately supplied and mutually consistent |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical HTTPS apex |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Explicit `false`; no emulator host/hub variables |
| `TAKEME_STORAGE_BUCKETS` | Exact approved production bucket only |
| `TAKEME_DELETION_ENVIRONMENT` | `production`, structurally qualified |
| `TAKEME_ENABLE_PRODUCTION_DELETION` | Explicit `false` for preparation; `true` only after separate activation approval |
| `PROTECTED_PAYMENTS_ENABLED` | Absent or `false` |

The Functions platform provides trusted project identity, Admin default bucket and managed IAM. Do not forge platform metadata or copy build-only web variables blindly into server runtime. Future production server configuration must match those trusted identities exactly. Region remains `asia-southeast1`, Node 22. Resource validation and central policy approval both gate deletion execution. Invalid/missing configuration denies cleanup.

## Central policy and create-only bootstrap

`functions/src/release-policy.ts` remains the approved bootstrap/rules/frontend/legal source; prepared production serving Functions consume the exact server-owned runtime policy record without rebuilding unrelated handlers at activation; production is currently unpublished, Terms/Privacy null, minimum age 18. Independent legal readiness is `functions/src/legal-publication.ts`. Operator registration is owner-confirmed `KT0622373-U`; no address, final content or BM approval is inferred from it. Legal route/source and rule generation consume this shared configuration.

After explicit owner/legal approval, update actual source, regenerate both marked rule blocks, review generated equality against source and qualify again. `releasePolicies/current` must contain the exact approved release target, project, publication state, Terms/Privacy versions and minimum age. It is server-owned and cannot be forged by acceptance clients.

The private bootstrap defaults to no-cloud plan. Future separately approved execution uses only the explicit reviewed command:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/bootstrap-production-policy.mjs --apply --project takeme-52b80 --owner-approved-create-only
```

It refuses absent approvals, wrong identity/bucket, mismatching rules and arbitrary flags. It creates only a missing record; an exact existing record is an idempotent no-op. Existing revoked/mismatched records are not overwritten. Revisions/revocation require a separately reviewed rollout; mirror-only revocation does not replace Storage rule regeneration because Storage has a two-document cross-service lookup limit.

## Account deletion activation checklist

1. Obtain final legal/retention and explicit execution approval, then qualify the exact project/bucket/region with trusted platform metadata and least-privilege IAM. Confirm the resources used by the app match the cleanup allowlist.
2. Deploy reviewed status/request/retry Functions with execution OFF. Confirm they report unavailable and do not mutate an account; qualify implementation using synthetic demo integration tests, never a production deletion probe.
3. Confirm additive cleanup indexes READY, recursive user/subcollection and Storage-prefix cleanup, Auth deletion, recent-auth requirement, deterministic operations, leases/retries, failure codes and audit minimization.
4. Review live auctions, missing winner-finalization, unfinished deals, disputes/reports, unexpected legacy/financial records. Those unresolved obligations block or defer cleanup; do not erase them by bypassing the guard.
5. Preserve approved retention: shared marketplace history 12 calendar months, closed security/fraud evidence 180 days after closure with purpose/restricted access, operation/lifecycle audit 30 days after completion. The requested legal applicability review remains unresolved; no new retention period is invented.
6. Assign a named deletion incident owner, restricted access, expiry/stuck-operation alerts, recovery procedure and backup restoration rule. Restored data must have deletion state/cleanup reapplied before becoming active.
7. Only after separate approval enable execution, then deploy/enable `processAccountDeletions` maintenance every five minutes. Use an explicitly approved dedicated test-account plan; no deletion is performed by this sprint.

TTL is asynchronous and nonrecursive. It cannot replace deletion cleanup, access controls, obligation checks or audit-purpose rules. See the separate parity document for prepared TTL commands; none were run.

## Coordinated deployment and rollback

The exact gated order and 85-export classification are in production-rollout-compatibility.md; it supersedes the prior blanket Functions selector. First approve/add the missing composite and nine mode-preserving fields; wait READY. Deploy only five inactive setup/upload preparation endpoints. Obtain actual legal/source approval, prepare final-version frontend/rules, then separately bootstrap the trusted policy record and release/qualify compatible acceptance/keyed-message/permit-aware frontend while legacy upload rules remain. Require a reviewed acceptance/refresh transition and bounded legacy message window before guarded serving updates; tighten final rules only after compatible frontend adoption and rollback qualification. Confirm four launch schedules and TTL independently; deletion endpoints OFF and later execution/maintenance activation stay separate. Rebuild/check the final production Worker and run release:launch before cutover approval. Do not promise uninterrupted old-client writes while eligibility or permit enforcement changes.

Keep staging Access isolated. Do not deploy protected-payment stubs, attach the domain or change DNS in preparation. Canonical apex is `https://takeme.my`; future www permanent redirect preserves path/query. GitHub → Cloudflare Workers Builds → Next.js remains the website architecture; Firebase remains Auth/Firestore/Storage/Functions. No `firebase init`, new Firebase Hosting architecture or Netlify removal is required.

Capture current compatible artifacts, ruleset IDs, schedule inventory and routing before approved changes. Old browser clients may depend on direct writes; web rollback alone can be incompatible with new callable-only rules or upload permits. Stop affected writes/traffic under incident authority before selecting a compatible rollback. Do not automatically restore weaker rules, delete Functions/indexes or revive deleted accounts. Netlify rollback must be tested against the same backend contract before cutover. No rollback action is executed here.
