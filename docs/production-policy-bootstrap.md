# Production policy and build qualification

This prepares local code only. Owner-approved V1 identifiers and product decisions are documented in [owner-v1-policy-model.md](owner-v1-policy-model.md); those decisions do not approve legal content/publication, launch production, enable deletion, change DNS or authorize a cloud write.

## Central source and present state

- `functions/src/release-policy.ts` is the approved source for bootstrap, generated rules, frontend proof/versions and legal pages. Prepared production serving Functions separately resolve runtime versions from the trusted server-owned policy record; activation need not rebuild unrelated handlers. Production remains `publicationApproved: false`, with owner-approved intended `termsVersion: "1.0"`, `privacyVersion: "1.0"`, `minimumAge: 18`.
- `functions/src/legal-publication.ts` supplies the shared legal route/bootstrap/launch decisions. Registration alone is approved from the owner-confirmed SSM KT0622373-U. Final content, BM notice, publication and production route review remain false; address applicability remains pending. `legalLaunchDatePolicy` records the owner decision: effective date is the actual public launch date; V1 last-updated date is the same unless separately changed. The actual `effectiveDate` and `lastUpdated` remain explicit null inputs, require approved valid calendar dates, and are not inferred from historical draft dates. Authorised legal previews show intended V1 1.0 and pending launch dates, separately from actual demo/staging acceptance versions.
- `functions/src/production-environment.ts` binds takeme-52b80, takeme-52b80.firebasestorage.app, https://takeme.my and asia-southeast1.
- The frontend public SDK proof is a resource/purpose consistency guard, not permission to perform a marketplace action. Source policy, mirror, acceptance timestamps/versions, account lifecycle and authoritative backend/rules still guard writes. Runtime deletion qualification is unchanged and refuses execution while its activation flag is false or production policies are unapproved.

## Build versus launch

With exact confirmed production SDK inputs and `TAKEME_ENABLE_PRODUCTION_DELETION=false`, run the ordinary build commands under Node22.23.2:

```sh
npm ci
npm run cloudflare:build
npm run cloudflare:check
npm run release:check
```

They produce/verify purpose `production-build` with real source policies, allow configured public reads, validate source deletion exports/resources and print **launch NOT approved**. This is neither synthetic nor offline qualification. Full unit/integration/rules tests remain necessary; the source-presence check alone does not prove runtime deletion behavior. Build/artifact validation does not verify the live deployment or policy mirror. Staging retains its independent `staging-preview` purpose and protected Access wrapper. Offline-purpose artifacts remain refused by these ordinary checks.

`npm run release:launch` is a separate source/configuration checker. It requires final published central versions, all legal readiness decisions, the production resource identity and explicitly activated deletion execution. It accepts no CLI approval overrides. Passing it does not independently verify live backend parity, DNS/TLS, the mirror, final artifact, runtime activation or operational ownership; the reviewed deployment runbook supplies those additional checks. Any source-policy or build configuration change requires rebuilding/requalifying the artifact.

## Required policy mirror

The controlled bootstrap prepares exactly `releasePolicies/current`. Its six fields must match the approved central source:

| Field | Requirement |
| --- | --- |
| releaseTarget | production |
| projectId | takeme-52b80 |
| publicationApproved | true, only after actual approval |
| termsVersion | Owner-approved V1 identifier `1.0`, only after independent content/publication approval |
| privacyVersion | Owner-approved V1 identifier `1.0`, only after independent content/publication approval |
| minimumAge | 18 |

Terms and Privacy identifiers can differ in a future reviewed release; each must match its respective central version. V1 uses the owner-approved `1.0` for both, with no activation here. Missing, inactive, null, malformed, extra-field, draft or wrong-resource records cannot grant acceptance or marketplace eligibility. Production runtime requires exact managed/Admin project and bucket, six server-owned fields and final version identifiers. Demo/staging remain pinned to `1.0-draft` / `1.0-staging`. Clients/environment flags cannot grant approval. Generated Firestore/Storage policy regions and frontend approved source must still align with the record. Serving policy revocation is checked on each guarded transaction; existing short Storage permits have the documented two-lookup/lease limitation. Source-compiled deletion qualification is unchanged and may need its related rebuild after separate activation approval. See production-rollout-compatibility.md for the legal-before-guarded-writes order.

## Default planning and separately approved future apply

`npm run policy:production:plan` defaults to a no-cloud dry run. It returns a refusal while real policy/legal/resource gates are closed; it never initializes an Admin SDK or reads credentials/cloud data. Required trusted resource selectors include the explicit production target/project, exact Storage bucket, matching runtime GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT/GCP_PROJECT identity, no emulator configuration and deletion execution explicitly false. The plan describes proposed Admin app identity; it is not a live identity verification.

After owner/legal approval, reviewed central source updates, matching generated rules and a separate explicit approval for this cloud operation, the prepared command is:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/bootstrap-production-policy.mjs --apply --project takeme-52b80 --owner-approved-create-only
```

It must not be executed in this sprint. The script takes no policy/version/legal approval overrides. It checks actual source decisions, trusted resources and generated rule source before loading Admin/ADC. It only creates the fixed record and requires an exact read-back before reporting creation success. On an existing record it reads and confirms an exact match; mismatched/revoked/additional fields cause refusal. A post-create read-back failure is an unknown/possibly-created outcome requiring review, never an automatic repair. It never updates, merges, deletes, repairs or re-enables an existing record. No bootstrap is exposed through onboarding, a public callable or Functions index. Independent read-only live verification is required after a future approved apply.

## Owner/legal actions still required

Final English Privacy and Terms approval; approved BM Privacy notice; publishable address applicability/disclosure decision; retention and supplier-disclosure review; actual launch/date approval; final route review and publication approval. EN/BM route wiring is prepared at `/privacy` and `/privacy/bm`; actual BM text remains **OWNER/LEGAL APPROVAL REQUIRED**, and its missing-content placeholder is denied in production. Prohibited-items content follows Terms version `1.0`, with actual wording/publication still unapproved. None of these approvals can be inferred from a successful build. Bootstrap and deletion activation are separate owner-approved operations, in the order of the production deployment runbook.

See [production-legal-policy-preparation.md](production-legal-policy-preparation.md) for the historical preparation checklist, exact future environment/command, and phase-aware rollback procedure, and [owner-v1-policy-model.md](owner-v1-policy-model.md) for the superseding browsing/migration/history decisions. The six-field runtime mirror does not contain legal dates/operator metadata; adding those fields without a reviewed schema migration would fail closed. Its current activation has no future-date scheduling mechanism: the owner must approve the actual activation time relative to the actual public launch date and notice plan.
