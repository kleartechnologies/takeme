# Cloudflare monitoring — unavailable Custom Alerts and approved manual coverage

6 October 2026. Owner-confirmed capability record and local readiness reassessment only. Account **3ade68940865285d676a83971b23b4d4**, empty production Worker **takeme-web**. No code deployment, domain/route, workers.dev/preview change, DNS, traffic, Netlify, policy, maintenance or auction-freeze action is authorized by this record.

## A. Owner-observed Dashboard limitation

The owner attempted the scoped Custom Alert manually in the correct account and Worker context:

| Field | Submitted value |
| --- | --- |
| Dataset | Workers Real-Time Issues |
| Metric | Count rows |
| Worker filter | scriptName = takeme-web |
| Threshold | >= 5 |
| Evaluation window | 5 minutes |
| Execution interval | 1 minute |
| Repeat interval | 1 hour |

The Dashboard rejected creation with:

> unable to parse conditions: Error 17203: SQL API rejected the query as invalid. Input was invalid: requesting user cannot access this query

**CLOUDFLARE CUSTOM ALERT: UNAVAILABLE.** Treat this as an account/permission/capability limitation unless contrary evidence is established. Do not infer that changing the query or widening scope will fix access. Earlier notification API attempts returned 403; the latest documented alert-discovery GET returned 401 / 10000 and stopped. This reassessment makes no API retry or remote change.

No Worker custom alert exists from these attempts, no Cloudflare alert email delivery has been verified, and no broader account/zone/origin alert is substituted. No undocumented API, permission bypass, Queue/consumer/webhook workaround, new monitoring vendor or manufactured outage is approved. Optional provider/Issues/build mechanisms are not claimed as equivalent native email coverage.

## B. Approved V1 monitoring model

The owner explicitly approved this fallback on 6 October 2026:

- **Google/Firebase:** primary **support.takeme@gmail.com** and backup **zweetdata@gmail.com** channels VERIFIED, both actual test-alert receipts VERIFIED, five approved conservative definitions prepared. Definitions and sensitivities are unchanged. Normal policies remain disabled pending separate enablement approval; prepared alerting is not live paging.
- **Cloudflare:** Workers Logs/Observability and query-string redaction enabled; owner-approved manual Worker metrics/log inspection during activation and immediately after deployment. Traces remain OFF.
- **Operations:** named operator watches the exact Worker, escalates to verified contacts, and follows the existing stop/compatible-rollback runbook. Custom Alert capability and delivery become a **post-launch enhancement** if supported permissions/capability later become available.

Unavailable optional Cloudflare Custom Alerts do not block technical monitoring preparation when **all** of these hold: enabled Worker observability/redaction; documented approved operator watch; verified Google/Firebase delivery; verified incident contacts; ready rollback/runbook coverage. Missing/unknown evidence for any condition means NOT READY. This approval does not resolve external legal gates, authorize activation or grant permission to enable the five Google policies.

## C. Manual operator procedure and safe evidence

1. Before the separately approved activation, confirm primary/backup presence, Dashboard access and handoff. Open the correct account's **Workers & Pages → takeme-web** metrics/logs and deployment/version panels. Keep the retained Netlify recovery point and Google/Firebase monitoring panels available. Stop if identity/access/rollback coverage is uncertain.
2. Confirm persisted invocation logs and query redaction remain enabled. The empty target has no runtime health samples; lack of errors before code deployment is not a serving-health measurement.
3. Keep the Worker watch open throughout activation and immediately after deployment. Continuously watch deployment boundaries, record checks at least every five minutes and at each go/no-go, and verify exact version, log/metric ingestion, request/errors/5xx/exceptions and available CPU/wall-time trends.
4. Immediately after the future authorized frontend deployment, independently confirm observability/redaction survived, intended version is active and telemetry is arriving. Absent/delayed data is UNKNOWN. Do not progress or reopen until monitoring and required valid smoke/health evidence are established.
5. Sustained/broad serving failures or failed required valid smoke are CRITICAL: stop progression, notify the primary/backup and use the existing authorized incident/compatible-recovery procedure. Bounded errors/job delay/usage growth need WARNING triage. Lost Dashboard access or operator coverage requires stopping or an acknowledged backup handoff. No automatic control/traffic changes are authorized.
6. Record only safe timestamps, version IDs, aggregate counts/status and operator decisions. Do not export tokens, cookies, query strings, private headers, Firebase credentials or customer content. Continue the watch through the existing post-deployment/reopen monitoring period; no fixed time or silent panel grants an all-clear.

Google/Firebase delivery is already proved by actual email receipt. Cloudflare email testing is **not required by this fallback**, and is not claimed verified. If a supported scoped Custom Alert becomes available after launch, seek the separately approved enhancement, validate its scope and use the documented **⋯ → Test** action plus actual inbox receipt. Never deploy faulty code or generate a Worker outage to test transport. [Documented Dashboard Test controls](https://developers.cloudflare.com/notifications/get-started/).

## D. Future production observability preservation

The [root-only production fragment](v1-production-observability-overlay.json) passed installed Wrangler **4.147.0** parsing with the reviewed production identity/entry/assets/bindings. It enables persisted invocation logs at sampling 1 and query redaction; tracing stays OFF. The last successful target readback at **14:06 MYT**, plus the owner's current confirmation, establish enabled settings. No fresh API readback is claimed in this reassessment.

**Execution prerequisite:** tracked `wrangler.jsonc` still has root `observability.enabled=false`; the source and immutable RC are unchanged. Preserve the validated production-only fragment in the separately qualified future deployment configuration, without changing preview behavior or exposure. Do not deploy the original config and assume Dashboard logging survives. Independently verify settings and ingested telemetry immediately after any separately approved deployment, before proceeding or reopening. This record does not rebuild or requalify a frontend artifact.

## E. Readiness and execution checklist

### Prepared and owner-confirmed

- [x] Correct production account / **takeme-web** context confirmed by owner.
- [x] Scoped Custom Alert unavailable due Error 17203 recorded; no alert or delivery fabricated.
- [x] Worker logging/observability and query-string redaction enabled.
- [x] Manual activation/immediate post-deploy monitoring procedure approved.
- [x] Primary/backup Google channels and actual email deliveries verified.
- [x] Compatible rollback/runbook coverage remains ready under the reviewed technical baseline.

### Reconfirm at future authorized activation and reopen

- [ ] Primary/backup access, presence, handoff and incident responsibilities confirmed.
- [ ] Five exact Google alert definitions enabled only under separate monitoring approval, with unchanged thresholds, destinations and valid metric readback; disabled definitions are not automated paging.
- [ ] Exact deployment/version/configuration preserves logging and redaction.
- [ ] Actual logs/metrics ingested; required smoke and Function/Scheduler/lifecycle/upload health pass.
- [ ] Manual Worker watch active; no critical incident or unknown telemetry.
- [ ] Separate legal, fresh auction counts, drain, parity, rollback and owner GO/reopen gates satisfied.

No application code, custom domain, workers.dev/preview exposure or customer traffic is enabled by completing this local preparation record. No DNS or Netlify changes are made.

## F. Reassessment

**CLOUDFLARE CUSTOM ALERT: UNAVAILABLE. CLOUDFLARE OBSERVABILITY: READY. GOOGLE/FIREBASE MONITORING: READY as preparation. INCIDENT COVERAGE: READY as verified contact coverage. MONITORING READINESS: READY. TECHNICAL ACTIVATION GATES: READY as preparation under the unchanged reviewed technical baseline. EXTERNAL LEGAL GATES: NOT READY. SAFE TO REQUEST OWNER GO: NO.**

The optional Custom Alert restriction no longer blocks this gate. Required future execution checks and existing external legal approval logic are preserved. Activation authorization remains **NOT YET GIVEN**; this record authorizes no serving change.
