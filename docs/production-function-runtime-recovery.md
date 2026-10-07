# Final V1 Function runtime qualification

The final source-only rollout patched `buildConfig.source` and compared all runtime settings with the older baseline. That preserved older environments rather than qualifying them against the newly deployed guards. Source provenance and configuration preservation passed while the actual final runtime contract was missing. Runtime pins are independent of build-time environment values and frontend release proof.

`scripts/production-function-runtime-manifest.json` defines the reviewed 77-Function production set, resource identities and per-entry dependency classification. `audit-function-runtime-source.mjs` resolves TypeScript export/call dependencies, distinguishing mutation wrappers and policy-aware derived work from read wrappers and unscoped transaction work. Runtime guard source hashes require renewed review when the contract changes.

44 final entry points invoke `runtimePolicyContext` directly or through eligibility/maintenance/derived-discovery guards. They require `TAKEME_RELEASE_TARGET=production` and `TAKEME_FIREBASE_PROJECT_ID=takeme-52b80`. Trusted platform project identity must agree, and `initializeApp()` metadata must identify the exact production project and `takeme-52b80.firebasestorage.app` bucket. Region is pinned through the Function resource path, not an invented environment variable. An explicit `TAKEME_STORAGE_BUCKETS` pin is optional in this guard; if present it must equal the bucket. The optional deletion environment must be production; staging deletion must be absent or false. Emulator configuration is refused.

33 final read/unscoped derived entry points do not invoke this strict context. Missing application pins alone do not require redeploying these entries. Wrong configured identities or unsafe feature activation still fail qualification. The original broad inventory found 72/77 missing pins; five were already configured. Source-dependent classification narrows the actual missing required pins to 39 Functions. Do not redeploy the other 38.

Deletion execution has its own resource and activation contract; it stays OFF. No deletion entry point is in this repair set. Payments are a disabled provider stub; `PROTECTED_PAYMENTS_ENABLED` remains absent/false. Legacy-message support remains selected only by its explicit finite-window variables; this repair does not enable or extend it. Production policy approval/versions come from the strict server-owned `releasePolicies/current` record, never newly added environment variables. Control scripts have a separate stricter operator contract requiring explicit bucket/deletion-OFF/payments-OFF values; that is not a reason to add unnecessary runtime variables to public Functions.

## Required deployment gate

Before **any future final-source deployment**, resolve the source classifications, capture current private configuration/IAM/source rollback evidence and run:

```sh
node scripts/audit-function-runtime-source.mjs
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-production-function-runtime.py --inventory /private/path/functions.json --plan --output /private/path/runtime-plan.json
```

Every final source update must include the reviewed planned runtime map if needed. Preserving the previous environment is insufficient. `plan_environment_patch` retains every unrelated existing value and repairs only required application pins; unsafe optional resource drift stops rather than being silently repaired. A field-masked `serviceConfig.environmentVariables` update avoids replacing source, trigger or resource settings. The full environment map must be carried, never just the two added entries.

Post-deployment, take a **fresh** API readback and run:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-production-function-runtime.py --inventory /private/path/fresh-functions.json
```

This gate refuses missing/incorrect required pins, incomplete/duplicate inventories, non-production resources, emulator settings, deletion/payment activation and unreviewed contract drift. It must pass alongside source provenance, IAM/settings preservation and ACTIVE revision verification. Historical rollback/bridge sources retain their separately reviewed contracts; do not incorrectly impose this final-source contract on them.

## Recovery operation

Keep writes PAUSED and auctions FROZEN. Capture all 77 current revisions, configuration, managed generation-pinned source archives and IAM. Apply only affected configuration patches, at most three concurrently, using the official Cloud Functions v2 API. After each batch verify new ACTIVE revisions, exact planned environments, unchanged source/build/trigger/labels/resource settings/IAM, and unchanged pause/freeze/policy state. Any failed batch settles and restores only that batch's captured environment, verifies equivalence and stops; never reopens writes.

After all 77 fresh runtime readbacks pass, perform maintenance-ON synthetic guard checks and reconfirm rules, schedules, active policy, frontend and monitoring. Only then use the guarded fresh-CAS maintenance procedure for owner-approved controlled reopening. Auction creation remains frozen until all bounded non-auction write smoke passes. Any launch-critical smoke failure pauses writes first, verifies readback and stops. Auction failures also restore the creation freeze. No DNS, frontend, rule, legal-content, payment, deletion or TTL changes form part of this runtime repair.

The Cloud Functions API was observed to rebuild/copy identical reviewed source during an environment-only PATCH. New build IDs and managed object generations are output metadata, not evidence of code drift. The verifier must compare unchanged build input settings and generation-pinned archive **file bytes**, not require equality of historical generated IDs. Require complete reviewed-source proof before accepting this metadata transition; missing proof, changed source, changed IAM or serving settings still stops/rolls back. Regression coverage includes generated-ID changes with matching proof and rejects absent/false source proof.

Untouched resources require exact configuration, source, revision and output metadata equality, with only `eventTrigger.eventFilters` ordering normalized because the API returns that unordered filter set in varying order. A changed filter value, trigger, revision or any other field still refuses qualification. Regression tests distinguish harmless ordering from actual trigger or revision drift.
