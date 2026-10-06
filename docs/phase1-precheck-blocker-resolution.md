# Phase 1 precheck blocker resolution — owner review

This local checkpoint resolves only the address-disposition gate and Cloudflare
credential/target preflight. It does not resume Phase 1, publish a legal route,
bootstrap a policy, install a bridge, pause writes, freeze auctions or deploy code.

## Owner address decision

Owner instruction: **RESOLVE TAKEME PHASE 1 PRECHECK BLOCKERS ONLY**, 6 October 2026.

```json
{
  "addressPublicationDecision": "NOT_PUBLISHED_FOR_V1",
  "ownerApproved": true,
  "legalCounselStatus": "OUTSTANDING"
}
```

The central record is in `functions/src/legal-publication.ts`; the publication
and create-only bootstrap guard validates its exact fields and values. An
unresolved, unapproved, invented or malformed omission does not pass. The existing
approved-address/reviewed-alternative path remains supported. A bare
`not-required` address flag no longer substitutes for either explicit path:
the actual source address status remains `pending`, with the separate owner
disposition supplying the narrowly scoped approval.

`src/content/operator-disclosure.ts` shares this record, stores no EN/BM address,
and keeps `counselApproved=false`. This is an owner launch decision, **not a legal
conclusion that Malaysian law never requires an address**. Counsel review and
other unresolved legal topics remain outstanding; no unrelated gate is relaxed.

The four legal section models identify their address-only paragraphs separately.
The shared renderer omits those paragraphs for V1 omission or an unresolved
disclosure. It never renders the address placeholder, an omission status code or
`null` as an address. Operator, SSM, support/contact links and all other approved
legal prose remain unchanged. SHA-256 tests compare the non-address section
models against approved checkpoint `67e8971532e34fbd76b2e9a5e87cf5aa37ed5ef7`.
Actual Terms/Privacy/Prohibited Items versions remain 1.0, all eight prepared dates
remain 2026-10-12 and publication remains false.

## Cloudflare capability classification

The previously denied read was `GET /accounts/3ade68940865285d676a83971b23b4d4`.
After Wrangler's normal authenticated identity check, that same documented
request returned **200**, so the earlier 403 is not reproducible with the current
credentials. No additional login, permission expansion, token creation or
undocumented workaround was performed. Authentication freshness is a plausible
explanation; the earlier response alone does not establish its exact cause.

Wrangler 4.147.0 identifies the existing OAuth session as
`kleartechnologies@gmail.com`, in the pinned account, with current `workers:write`
and `workers_scripts:write` grants. The accepted account membership reads
**Super Administrator — All Privileges**. The exact existing production Worker
is independently read back as:

- Account: `3ade68940865285d676a83971b23b4d4`
- Name: `takeme-web`
- Worker ID: `43cec9ee2db5482d90db68b8d11c191d`

| Capability | Non-mutating evidence |
| --- | --- |
| Generic account metadata | 200; prior 403 not reproduced |
| Worker deployment entitlement | Authenticated membership, Worker/script-write grants and exact target readback |
| Worker versions | Read 200, zero versions; upload entitlement established, no write attempted |
| Worker deployments | Read 200, zero deployments; no deployment attempted |
| Legacy script settings / secret metadata | 404 on the still-empty metadata-only Worker, not 403; values neither read nor written |
| Domains / routing | Reads allowed; no target domain and zero target customer routes |
| workers.dev / preview URLs | Both disabled |

Cloudflare documents **Workers Scripts Write** for version upload, and Editor
access to an existing Worker for deployment. These entitlement checks establish
authorization; they do not claim a future upload succeeded. A local Wrangler
dry-run does not prove server-side write permission, so no Worker version was
created as a test.

Sources:
- [Version upload permission](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/)
- [Workers authorization](https://developers.cloudflare.com/workers/authorization/)
- [Wrangler identity commands](https://developers.cloudflare.com/workers/wrangler/commands/general/)

## Future production config and stop boundary

The checked default `wrangler.jsonc` pins the exact account/name, production
`.open-next/worker.js` entry and `takeme-web` self-reference. It disables
workers.dev/preview URLs and has no production route. Its separate `env.preview`
configuration must never be selected for production. No staging wrapper or
tester allowlist is used by the production entry.

The root observability default is false. A later production deployment **must
merge the already-reviewed** `docs/monitoring/v1-production-observability-overlay.json`
and use a production-only config projection without `env.preview`; do not deploy
the raw root config and silently disable observability. A private pure projection
was checked outside Git, with no credentials or SDK values. Live Worker metadata
still reports logging/observability and query-string redaction enabled, traces
disabled. No application code, version, binding, domain or route was changed.

Both failed prechecks can now pass. These source changes are deliberately local
and uncommitted. Owner review/checkpoint approval and updated source/artifact
qualification remain necessary before the Phase 1 clean-checkpoint/hash gates
can pass. The immutable reviewed RC/rollback bundles were not changed. No
automatic Phase 1 resumption is authorized by this report.

## Verification

- App tests: 440 total, 438 passed, two existing skips, zero failures.
- New address suite: approved address, explicit omission, malformed/unresolved
  states, truthful counsel status, non-address wording checksums and real legal
  TSX route rendering with synthetic publication hooks.
- App and Functions TypeScript (`--noEmit`): passed.
- ESLint on every changed TypeScript/TSX/test file: passed.
- Diff review/whitespace check: passed. No versions, dates, real publication
  flags, production resources, credentials or immutable release bundles changed.
