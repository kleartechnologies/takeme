# V1 production monitoring and incident checklist

Prepared locally on 5 October 2026. No alert, observability setting, App Check policy, Scheduler or production log configuration was changed. Use existing Cloudflare/Firebase/Google Cloud dashboards and native alerting; no new paid monitoring vendor is proposed.

## Ownership and alert delivery before traffic

The owner must assign one named release/on-call owner and a backup, plus an abuse/support and deletion/privacy owner. Support/privacy public contact is support.takeme@gmail.com; that does not prove incident delivery is configured. Record restricted dashboard access, approved operational alert destination, coverage hours, acknowledgement/escalation rules and a test alert delivery before cutover. No individual's responsibility is invented here.

| Signal | Review/alert mechanism | Responsible role | Suggested initial trigger/action, subject to owner approval |
| --- | --- | --- | --- |
| Cloudflare Worker errors/latency | Worker analytics, approved invocation error metadata/metrics | Release/on-call | Any sustained 5xx burst above normal for five minutes; inspect version and stop affected traffic under incident authority |
| Functions errors/latency | Cloud Logging error counts, execution/instance metrics | Backend/on-call | Repeated internal errors on a required callable or trigger, compare reviewed revision/config and retry behavior |
| Scheduler delivery | Scheduler execution status plus target Function error metric | Backend/on-call | Two consecutive failed deliveries for a required job; auction lifecycle gets immediate priority |
| Auth failures | Auth/provider metrics and client error-code aggregates without emails/tokens | Auth/release | Sustained provider/redirect failures or sudden invalid/denied spike; distinguish access/eligibility failures from outages |
| Storage uploads | Storage metrics, safe permit/throttle/error code counts | Backend/on-call | Failure spike or legitimate permits denied; check exact path/type/bytes, expiry, eligible state and deployed rule/client compatibility |
| Firestore cost/read spike | Usage/cost dashboards and budget alerts | Billing/on-call | Daily budget threshold at owner-approved amount; investigate public browsing/poll traffic before raising limits |
| Message cadence | resource-exhausted counts by action, no body/key logging | Abuse/on-call | Sustained throttle spike or approved normal-user complaints; distinguish automation from threshold regression |
| Offers/bids | Safe code counts including stale/min-increment/lock vs internal errors | Marketplace/on-call | Unexpected internal failures/invalid lifecycle after deployment; preserve valid rejection semantics |
| Auction lifecycle | Job failure metric, stale due-state backlog under approved operational access | Marketplace/on-call | Required job stops or endings/winners remain unprocessed; do not manually overwrite bid/deal records |
| Deletion operations | State/lease/failure-code counts, restricted ledger access | Deletion/privacy owner | Failed retry, expired lease or stuck eligible operation; never expose evidence/body or bypass unresolved obligations |
| Reports/abuse | Aggregate report volume/dedupe/throttle metrics | Abuse/support owner | Volume spike and unresolved backlog; preserve legitimate reporting access |
| TTL/expiry | Policy state and deletion count/latency | Backend/privacy owner | Policy inactive, missing expiresAt or unexpected volume; TTL is not recursive cleanup |

These are reviewable starting criteria, not measurements or activated alerts. Set numeric error/cost thresholds from a bounded staging baseline and owner budget rather than load testing production. Run no load test on Blaze. Source maxInstances=20 is a deployment bound, not a per-user quota or complete billing defense.

## Log safety review

Current Functions/application source has no console/logger payload emission. New cadence/message/permit helpers return safe public error copy and bounded retryAfterMs; raw body/idempotency keys are not returned or logged. Receipt hashes are private metadata; API projections omit receipts. Qualified build scripts report configuration names/reasons, never registered SDK values or credentials.

Live production log payloads were not read: the scoped inventory retrieved only project/resource/control-plane metadata. It is therefore not honest to certify historical production logs as free of sensitive content. Before launch, an authorized operator should inspect a small restricted sample in Console, record only counts/safe findings and redact any incident evidence. Do not export historical user log bodies into repository or chat.

Prohibited log fields: passwords, OAuth/access tokens, cookies/JWT/private headers, private message bodies, exact private addresses, deletion evidence bodies, support evidence/media download URLs and full raw request objects. Prefer stable operation/error code, function/version, action class, elapsed time and bounded aggregate counts. IDs only when needed for restricted incident correlation, with documented purpose/access/expiry; never make this an indefinite shadow customer database. Audit data follows the approved 30-day operation rule; other operational/security logs need a documented limited retention policy. Backup restoration must reapply deletion state/cleanup before activation.

## Incident and rollback sequence

1. Identify exact project, Worker revision and affected subsystem; confirm production versus staging before any change.
2. Under incident authority, restrict affected writes/jobs/traffic when necessary; preserve evidence with purpose/expiry and least privilege.
3. Select a compatible web/backend/rules version. Netlify is retained, but web-only rollback cannot restore old direct-upload/message clients against new callable/permit rules. Do not weaken rules as an automatic rollback.
4. Verify required schedules, idempotent retries, notifications and deletion state before reopening traffic. Never restore a deleted account into active service by copying backup data.
5. Record incident, safe cause/action and owner decision; adjust alerts/thresholds only after review.

## App Check: post-launch HIGH hardening

No App Check initialization exists in current Web source; no enforcement is enabled by this sprint. Owner previously reported Storage Configure App Check, but current enforcement for every service is not independently certified.

Future approved rollout: register the exact TAKEME Web app/provider and domains, prefer reviewed reCAPTCHA Enterprise Web integration, assess privacy/CSP and legitimate browser coverage, then deploy tokens without enforcement first. Monitor verified/unverified request metrics for Firestore and Storage; callable Functions verification logs/metrics support a similar observation phase. Include public browsing, image upload, Auth/onboarding, callable SDK calls, server-side metadata fetches and any non-SDK caller before enforcing per service. Worker server-side public callable requests need a supported trust/attestation design before callable enforcement; do not assume browser tokens cover them. Secrets/debug tokens remain private and never enabled on production clients.

Then approve enforcement for Storage, Firestore and applicable callable Functions in measured stages with rollback criteria. App Check complements Auth/rules/eligibility/cadence; it does not replace them. Official sources: [Web setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [service metrics](https://firebase.google.com/docs/app-check/monitor-metrics), [callable metrics](https://firebase.google.com/docs/app-check/monitor-functions-metrics).

## Known bounded risks

Auction/listing detail currently polls every ten seconds and does not pause on document visibility or after ending. No visibility pause is claimed. This is post-launch cost optimization; do not rearchitect the approved UI in this sprint. At 25 history rows, one request can read listing plus 25 bids (about 9,360 base reads/hour/open tab before additional calls). Anonymous aggregation/scraping is not solved by authenticated action cadence; monitor public read costs and scope cache/bot controls separately.

Image checks remain PNG/JPEG/WebP MIME plus positive byte-size up to 8MiB, ownership/eligible listing state and exact short-lived permit matching declared MIME/size. MIME metadata is not byte-content authentication or malware scanning. No complex image processing pipeline is added. New profile images use unique paths and owned old-media cleanup; exact permits cannot authorize cross-user paths or overwrite a completed upload. Permit expiry/bounded state reduces orphan attempts; it is not an approved product-count or lifetime Storage quota. Storage Rules cannot atomically consume a Firestore permit: an owner may delete/recreate the same exact object path during its two-minute permit window. Do not describe permits as an atomic at-most-once upload counter. New orphan paths still require separately cadence-limited permits; mitigating repeated same-path bytes needs a separately scoped upload architecture.

TTL does not delete subcollections; recursive account cleanup is retained. Official [Firestore TTL behavior](https://firebase.google.com/docs/firestore/ttl). Final Malaysian legal/BM/address and retention/seller-disclosure applicability decisions remain with owner/legal review; no code or alert setting claims those decisions resolved.
