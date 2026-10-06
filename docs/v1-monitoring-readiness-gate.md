# TAKEME V1 monitoring and incident readiness

6 October 2026. Monitoring preparation only. Production project `takeme-52b80`, bucket `takeme-52b80.firebasestorage.app`, Functions/Scheduler region `asia-southeast1`; Cloudflare account `3ade68940865285d676a83971b23b4d4`, future production Worker `takeme-web`. This record grants no application deployment, traffic cutover, policy/legal publication, maintenance, auction freeze, deletion, payment, schedule or DNS authority.

## Real configuration and review status

Created and independently read back one enabled Google email channel, `projects/takeme-52b80/notificationChannels/17384389673105497221`, for **support.takeme@gmail.com**. The owner confirmed receipt and supplied the verification-email screenshot. The delivered code was used only in memory for the channel verification API; independent readback now reports **VERIFIED**. No code was displayed or retained. The owner also supplied screenshots of the matching test alert at the exact approved address; **end-to-end test-alert email delivery is verified**. Do not retrieve a code through another API and claim it proves delivery.

The owner subsequently approved **zweetdata@gmail.com** as the backup contact. Created and independently verified `projects/takeme-52b80/notificationChannels/14950290015287672268`; Google now reports **VERIFIED**. The owner confirmed receipt of its separate safe test-alert email. Both delivery paths are configured and end-to-end verified.

Five Google alert policies remain **disabled**. Patched **only notificationChannels** to include these exact primary and backup channels. Independent before/after readback confirms all five filters, conditions, evaluation windows, severities and disabled states are unchanged. No new normal alert was created or enabled. A prospective log-based counter, `takeme_v1_scheduler_failed_attempts`, is enabled to count ERROR-level Scheduler AttemptFinished events for the six reviewed jobs only. It extracts no customer payload/identity labels and neither changes jobs nor calls Functions. Six job identities bound its scope; monitor normal Google logging/monitoring costs. No new paid vendor, log export, uptime probe or application error emission was installed.

Reviewable API definitions: [disabled policies](monitoring/v1-disabled-alert-policies.json), [Scheduler counter](monitoring/v1-scheduler-failure-counter.json), [operator signals](monitoring/v1-operator-signals.json). The owner approved the **existing conservative sensitivities** on 6 October 2026. They are **not a measured SLA, percentage baseline or automatic recovery trigger**, and have not been made more aggressive. That approval does not authorize normal alert enablement. The current runbook has no explicit pre-launch alert activation authority, so all five stay OFF. Disabled alerts do not provide paging coverage.

| Candidate / API ID | Signal and severity | Owner-approved condition / evaluation window | False-positive or coverage risk | Operator action |
| --- | --- | --- | --- | --- |
| Functions / `15027654673359129451` | Regional production Cloud Run request count, 5xx; **WARNING** | At least five failures per service over five minutes, hold 60 seconds | Transient upstream errors; excludes routine auth/input 4xx. Callable HTTP 200 semantic failures are not covered. | Compare required Function ACTIVE state, revision/config and valid smoke. Broad required-function failure is CRITICAL; stop progression. |
| Scheduler / `15027654673359127506` | Six-job failed-delivery counter; **WARNING** | At least two failed attempts per job over ten minutes, hold 60 seconds | Retries from one run can count twice. Prospective metric can be delayed/gapped; not proof of consecutive failed runs. | Compare cron/timezone, latest attempt/status and target health. Confirm repeated-run failure; prioritize lifecycle. Do not change schedules. |
| Auction lifecycle / `3579446839465820309` | `advanceauctionlifecycle` 5xx OR its exact Scheduler job's failed attempts; **CRITICAL** | Two lifecycle server failures over five minutes OR two delivery failures over ten minutes, hold 60 seconds | Retries/transient failures; successful delivery does not establish correct ending/winner effects | Stop progression. Compare lifecycle Function and Scheduler metadata; no bid payload inspection, clock edits or manufactured production auction. |
| Storage / `3579446839465820233` | Exact production bucket API request count, 5xx; **WARNING** | Five failures over five minutes, hold 60 seconds | Excludes expected MIME/size/ownership 4xx. Permit/client failures need valid-user smoke review. | Check aggregate codes and exact rules/permit/client parity. Broad valid upload failures are CRITICAL; never weaken guards. |
| Firestore / `3354499505275467394` | `(default)` production rules evaluation `ERROR`; **WARNING** | Five errors over five minutes, hold 60 seconds | Malformed requests/rule paths; `DENY` intentionally excluded to avoid maintenance/eligibility noise | Compare rules release and aggregate API/result trends. Broad valid-user denials are CRITICAL even without engine ERROR. |

All five notification destinations are exactly **support.takeme@gmail.com** and **zweetdata@gmail.com**. The API documentation still records the original pre-approval candidate wording; the owner decision and unchanged sensitivities are captured here and in the local definitions. Missing metric data is inactive, not a fabricated healthy sample. When enabled later, inspect alert validity and live metric presence; absent telemetry is a coverage gap. Capture a baseline before adjusting sensitivity. Use incident acknowledgement and the existing recovery runbook; no alert writes release controls or rolls back automatically.

## Delivery tests and evidence

Google's general email channel has no built-in test-notification button. Its documented alternative is a temporary policy whose condition is satisfied by healthy telemetry. The safe test observes only existing regional Cloud Run **2xx** counts over one hour, greater than zero, with no hold. It creates no request, error, outage or application write. Display/subject explicitly say **TAKEME TEST ONLY — Email delivery check — NO OUTAGE**; internal priority is INFO. Google's API rejects `INFO`, so this test uses `SEVERITY_UNSPECIFIED`, never WARNING/CRITICAL. Only opening notifications are requested, without repeat notifications.

The temporary test policy was disabled, independently read back as OFF, deleted, and its absence verified. The five normal candidates remain disabled; only INFO-labelled test incident history may remain until Google closes it. Its INFO-labelled incident opened at **05:50:09 UTC / 13:50:09 MYT** on existing successful telemetry. The owner supplied screenshots of the matching 13:50 MYT test alert at support.takeme@gmail.com, including project, region and healthy 2xx condition. **DELIVERY VERIFIED: YES.** The screenshots and API receipts remain outside Git; no screenshot is copied into this preparation work. No OAuth tokens, passwords, cookies, private headers, verification codes or customer log bodies belong in evidence or Git. Private API receipts remain outside the repository.

Primary completed: verification message received, channel readback VERIFIED, and the actual test-alert email received.

Backup completed independently: the owner supplied the verification-email screenshot; its code was used only in memory and not displayed/retained. The safe backup test incident opened at **06:04:34 UTC / 14:04:34 MYT** on existing healthy 2xx telemetry. The owner explicitly confirmed the separate backup test-alert email arrived. The backup test was disabled, independently read back OFF, deleted and confirmed absent. All five normal policies still read OFF. **PRIMARY DELIVERY: VERIFIED. BACKUP DELIVERY: VERIFIED.** INFO-labelled test incident history may remain until Google closes it; it is not an operational outage. Channel location: [Google Cloud Monitoring channels](https://console.cloud.google.com/monitoring/alerting/notifications?project=takeme-52b80). For future re-tests, use existing healthy telemetry and confirm receipt, then remove only the task-owned temporary policy; never manufacture an outage or customer write.

## Incident coverage record

| Role / decision | Approved state |
| --- | --- |
| Primary release/incident operator | TAKEME owner |
| Primary operational email | support.takeme@gmail.com |
| Backup incident contact | **zweetdata@gmail.com — owner-approved, Google channel VERIFIED, actual test-alert receipt confirmed** |
| Coverage | Owner must be present throughout activation, every go/no-go and reopen. Exact coverage/handoff hours and backup availability must be confirmed. |
| Acknowledgement | CRITICAL: acknowledge immediately while monitoring the controlled window and stop progression. WARNING: triage at the next five-minute review; escalate on persistence or valid-user degradation. These are proposed operating rules, not guaranteed response times. |
| Escalation | Contact zweetdata@gmail.com if the primary cannot respond. Only these two approved incident destinations are configured; no additional identity/role is invented. |

`production-operations.md` requires a release/on-call owner **and a backup** before traffic. Both approved contact/delivery paths now exist and are verified: **INCIDENT COVERAGE READY as prepared contact coverage**. Actual primary/backup availability, dashboard access, handoff and incident/rollback responsibility must still be affirmed at the activation/reopen checkpoints; email receipt alone does not certify those future operational facts. Deletion remains OFF; assigning privacy/support ownership does not authorize execution.

## Cloudflare observability and notification setup

The last successful readback and the owner's current confirmation of the empty `takeme-web` target establish observability and persisted invocation logs enabled, sampling 1, query-string redaction enabled. Tracing is OFF; it is not required for this minimal gate. Request volume, Worker errors and CPU/wall-time panels are the planned source for volume/latency awareness; HTTP status and exceptions require invocation/Issues evidence after deployment. No code is deployed and workers.dev/preview routing is disabled, so runtime availability cannot be measured yet. This local reassessment makes no new remote API request.

The root-only [production observability overlay](monitoring/v1-production-observability-overlay.json) is prepared and accepted by installed **Wrangler 4.147.0** in a production-only materialized configuration. It preserves production entry/assets/bindings and disabled URL exposure, enables persisted invocation logs with sampling 1 and query redaction, and leaves tracing OFF. The materialization contains no preview wrapper, tester allowlist or Firebase SDK values. The active source `wrangler.jsonc` and immutable RC were not changed: root observability remains OFF in that reviewed source. Adopt and qualify the fragment with the future separately approved publication/build configuration, without changing the preview. It is not safe to deploy the original config unchanged and assume Dashboard observability survives. Immediate post-deploy readback/metric ingestion is required; this local parser check is not a new artifact/deployment qualification.

Earlier notification API attempts returned **403**; the latest documented alert-discovery attempt returned **401 / 10000** and stopped immediately. The owner then attempted the exact scoped Custom Alert in the correct account and Worker context. The Dashboard rejected it with **Error 17203: SQL API rejected the query as invalid. Input was invalid: requesting user cannot access this query**. The submitted fields were dataset **Workers Real-Time Issues**, metric **Count rows**, filter **scriptName = takeme-web**, threshold **>= 5**, evaluation window **5 minutes**, execution interval **1 minute**, repeat interval **1 hour**. Record this as an account/permission/capability limitation unless contrary evidence arrives. The alert was not created; no Cloudflare delivery is claimed.

On 6 October 2026, the owner explicitly approved **manual Cloudflare monitoring during activation and immediately after deployment**, with Google/Firebase as the prepared automated alerting layer. **CLOUDFLARE CUSTOM ALERT: UNAVAILABLE.** Custom Alert creation and Cloudflare test-email delivery are optional post-launch enhancements, not technical readiness blockers under this approved model. Do not retry restricted or undocumented APIs, broaden scope/permissions, install a forwarding/consumer service or deploy faulty code to fabricate coverage. The [capability record and operator procedure](monitoring/cloudflare-owner-actions.md) capture this decision. Google alert definitions, sensitivities and enablement authority remain unchanged.

The monitoring preparation gate is READY only while **all five** conditions hold: Worker observability/logging and query redaction enabled; an approved manual operator watch procedure exists; actual Google/Firebase delivery is verified; primary/backup incident contacts are verified; compatible rollback/runbook coverage remains ready. Missing or unknown evidence for any condition makes this gate NOT READY. This exception applies only to unavailable Cloudflare Custom Alerts; it does not relax legal, auction, drain, parity, rollback or owner-execution gates.

No frontend code is deployed, so ingestion/runtime health remains a mandatory future post-deploy check. Preserve the validated observability fragment in the separately qualified production deployment configuration and independently confirm it survives deployment before proceeding or reopening. No domain/route/traffic was enabled. READY describes monitoring preparation, not an active Worker alert or permission to deploy.

## Auth, policy, upload and usage gaps

Auth/policy: review Auth provider/config/usage aggregates and required preparation/acceptance Function health after deployment; test explicit acceptance and reacceptance with separately approved synthetic users. Wrong password, no consent, under-18, deletion_pending and maintenance denials are expected. Repeated known-valid failures across independent checks/providers are WARNING; universal valid acceptance/login failure is CRITICAL. Callable HTTP 200 can contain semantic failure, so HTTP status alone cannot detect these. No new customer-identifying client telemetry is installed. Review every relevant checkpoint and five-minute aggregates; do not invent a fleet-wide failure rate without a baseline.

Storage: monitor exact bucket server errors plus valid permit/upload/readback/render smoke under the runbook's authority. No upload is run in this monitoring task. A valid-user failure across repeated checks is CRITICAL even if the server returns 4xx. Ownership/type/size/expiry/overwrite enforcement must remain intact.

Firestore: Firebase Usage and Google metrics provide read/write/delete, rule result/API error and trend awareness. Expected paused-write denials are not incidents; broad unexpected valid-user denial after reopen is CRITICAL. Compare five-minute activation trends to the captured baseline and billing daily after launch. Cost/read growth without degradation is WARNING if persistent/unexplained. **Budget amount is OWNER INPUT REQUIRED**; no invented amount or automatic service cutoff. Budget installation is not claimed.

Auction: six-job metadata and lifecycle alert cover execution/delivery failures, not due-state correctness. Check latest attempts against each job's cron/timezone, including `advanceAuctionLifecycle` and `queueEndingAuctionAlerts`. Ending/closing transition errors or a required job ceasing are CRITICAL. No private bids or customer auction records are inspected; separately authorized count-only due-state/backlog evidence may be added later. Zero active/scheduled remains a separate, fresh activation gate, never inferred from HTTP success.

## Compact activation dashboard

Keep these native panels/checks open, capture safe timestamps/counts/status/version only, and review every five minutes during the controlled window and at each deployment/reopen boundary. Observation delay or absent data is explicitly UNKNOWN; no red-to-green assumption from a silent panel.

**Approved Cloudflare manual watch:** the named primary operator keeps the exact `takeme-web` metrics/logs and deployment/version panels open throughout activation and immediately after deployment. Verify account/Worker identity, logging/query redaction and the intended version at each boundary; inspect request/error/5xx/exception counts and CPU/wall-time trends, using only safe aggregate/status evidence. Watch continuously during the deployment boundary, record reviews at least every five minutes and confirm ingestion rather than treating an empty panel as healthy. Escalate sustained/broad failures or failed valid smoke immediately to the verified contacts; use the existing stop/rollback procedure only under incident authority. If the operator loses access or monitoring coverage, stop progression until coverage or an acknowledged backup handoff is restored. Do not proceed or reopen with unknown telemetry. Keep the watch through the runbook's post-deployment/reopen monitoring period; no automatic alert or fixed time-based all-clear is inferred.

| Panel/check | What the operator records |
| --- | --- |
| Netlify `mytakeme` / current public host | HTTP health, exact retained published deploy and rollback reachability; do not republish/change it |
| Future `takeme-web` | Exact version/observability, requests, invocation 5xx/outcomes/exceptions, CPU/wall latency, required public-page smoke |
| Google Functions / Cloud Run | 91 baseline Function states/revisions; aggregate 5xx/error count and latency; required target parity after approved deploy |
| Scheduler | Six exact jobs' ENABLED/attempt/status/cron; no forced execution or schedule edits |
| Auction lifecycle | Lifecycle delivery/runtime health and safe authorized aggregate operational gates; unknown transition status is not PASS |
| Firestore Rules / Usage | Exact release, ERROR/DENY/API code trend, document read/write/delete trend and ingestion lag |
| Storage/upload | Exact bucket/rules, server failures, separately authorized valid permit/upload/render checks |
| Auth/policy | Provider/config parity, valid synthetic login/acceptance/reacceptance results; expected refusals separated |
| Maintenance | Fixed `releaseControls/current` schema/token/readback and real enforcement; absent is normal OFF compatibility, never proof of ON |
| Auction admission | Fixed `releaseControls/auctionCreation` token/readback, independent freeze coverage and fresh zero counts |
| Delivery/incident coverage | Owner test-email receipt, operator/backup access and presence, acknowledgement, no active CRITICAL alert |
| Rollback | Retained Netlify deploy, compatible Functions/rules/frontend packages, hashes and recovery dependencies |

## Stop / reopen rules

**CRITICAL:** sustained/broad Worker 5xx/exception outage; required Functions unhealthy/partial rollout; valid auth/acceptance fails broadly; auction lifecycle/ending failure; final rules broadly deny eligible writes; valid uploads broadly fail; unknown control/parity/rollback state. Stop progression, notify the named owner through the verified channel, preserve the currently safe state and use only authorized incident/recovery steps. Do not automatically modify controls, traffic, schedules, records or protections.

**WARNING:** elevated but bounded errors, delayed/retrying job, unusual reads/cost without degradation. Investigate within the monitoring window; persistence, failed known-valid smoke or broad impact escalates. **INFO:** routine usage/latency review and explicitly marked safe test; no outage inference. Single normal-user/input/eligibility failures do not page. Without a baseline, valid smoke plus operator judgement remains required.

Immediately after future frontend deployment: verify exact Worker version/resource identity where applicable, observability still ON, invocation logs/metrics arriving, no 5xx/exception spike, Function health and six Scheduler states. Absent or delayed telemetry remains UNKNOWN.

Before reopening, record affirmative evidence for **all** of these requirements:

- Primary operator available: TAKEME owner / support.takeme@gmail.com.
- Backup incident contact available: zweetdata@gmail.com; access/handoff confirmed.
- Both Google/Firebase channels VERIFIED and both actual test-alert receipts confirmed.
- Owner-approved manual Cloudflare watch active, exact Worker logging/query redaction preserved and post-deploy telemetry available; Custom Alerts are unavailable due Error 17203 and are not required. Do not infer Cloudflare notification delivery from Google tests.
- No CRITICAL alert or operational incident active. Disabled alerts and absence of data alone are not health evidence.
- Required Functions healthy and exact source/runtime/config parity verified.
- Six required schedulers healthy with current attempt/status/cron evidence.
- Auction lifecycle healthy; delivery success alone does not prove due-state correctness.
- Storage/upload path healthy through separately approved valid smoke; owner/type/size/permit guards intact.
- Worker 5xx/exception monitoring available with actual post-deploy telemetry.

Coherent parity and every existing legal/auction/drain gate remain mandatory. An observability setting or this checklist alone cannot authorize reopen.

## Gate decision and remaining actions

The previously verified technical baseline remains **91/91 Functions ACTIVE**, no source/revision/runtime/environment drift or state warnings, and six unchanged ENABLED schedules with successful latest attempts. The reviewed Function source hashes and immutable RC bundle were verified separately without rebuilding. The empty Cloudflare target has no serving deployment, domains/routes or traffic references; workers.dev and preview URL exposure remain OFF. Logging, persistence and query redaction were read ON and are owner-confirmed. All five Google policies have both exact channels and remain disabled. No application request, customer payload inspection or serving change was used for delivery testing. This task updates local readiness records from owner evidence; it does not claim a new production inventory or runtime health check.

**MONITORING READY as preparation under the owner-approved fallback model.** Cloudflare Custom Alerts are unavailable due the Dashboard query access restriction; that optional capability no longer blocks technical readiness. Worker observability/redaction are enabled, the manual activation/immediate post-deploy watch is documented and owner-approved, Google/Firebase channel delivery and incident contacts are verified, and the reviewed rollback/runbook coverage remains ready. Future deployment must preserve observability and pass the existing ingestion, health and pre-reopen checks. This does not claim automated Cloudflare delivery or that disabled Google policies are currently paging.

Enabling the five Google alerts **before a later launch** would be operationally preferable, after explicit monitoring-only enablement approval: it establishes a normal baseline and can catch pre-existing failures without changing customer traffic or application behavior. It is not done here because the current runbook does not explicitly permit pre-launch activation. Future operator action is limited to the five exact policy IDs/approved definitions: verify both destinations and unchanged sensitivity/validity, enable only under separate authority, independently read back ON and attach evidence to the pre-activation checklist. Any drift/invalid metric stops that action; do not change thresholds automatically. The prospective Scheduler counter already observes the six jobs and is not a schedule change.

Function manifest alignment PASS, production target READY as non-serving metadata, and RC/Netlify rollback/maintenance/control/freeze remain the reviewed technical baseline. External counsel/address/seller disclosure/retention/provider/rights/liability/regulated-goods gates remain **NOT READY** under existing launch logic; this task makes no legal decision. No owner GO or activation authorization is inferred.

Sources: [Google email test procedure](https://docs.cloud.google.com/monitoring/support/notification-options#test-notification), [channel verification API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels/sendVerificationCode), [alert policy API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies), [Scheduler troubleshooting](https://docs.cloud.google.com/scheduler/docs/troubleshooting), [Cloudflare Custom Alerts](https://developers.cloudflare.com/notifications/notification-available/#custom-alerts-beta), [Workers Issues](https://developers.cloudflare.com/workers/observability/issues/), [Issues automations](https://developers.cloudflare.com/workers/observability/issues/automations/), [Worker metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/), [Wrangler source of truth](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth), [build event subscriptions](https://developers.cloudflare.com/workers/ci-cd/builds/event-subscriptions/).

## Technical summary after this task

- Function manifest alignment: **PASS**.
- Cloudflare production target: **READY as a non-serving target**; approved manual watch replaces unavailable Custom Alerts, with observability preservation/ingestion checks retained for future execution.
- Cloudflare Custom Alert: **UNAVAILABLE**, owner-observed Dashboard Error 17203 / query access restriction; optional post-launch enhancement.
- Cloudflare observability: **READY** as enabled settings and a validated future production fragment; no runtime health measured before code deployment.
- Google/Firebase delivery verified: **YES**, both channels VERIFIED and actual separate test-alert receipts confirmed.
- Incident coverage: **READY** for approved, verified primary/backup contacts; confirm actual availability/access before activation/reopen.
- Five Google alert sensitivities: **OWNER APPROVED, UNCHANGED**. Policies remain **DISABLED**, prepared for separately authorized launch enablement.
- Google/Firebase monitoring: **READY as preparation**; delivery verified, five approved definitions prepared, normal policies still disabled pending separate enablement approval.
- Monitoring readiness: **READY** under the five-condition owner-approved fallback; required execution readbacks and operator presence remain mandatory.
- Technical activation gates: **READY as preparation**, using the unchanged reviewed technical baseline; no production activation is authorized.
- External legal gates: **NOT READY**; no legal approval logic relaxed.
- Safe to request owner GO: **NO**. Activation authorization: **NOT YET GIVEN**.

Earlier remote changes in the monitoring owner-input task were **monitoring only**: backup channel creation/verification, notification-channel-only patches on the five disabled policies, and a safe temporary test removed after confirmed receipt. This fallback reassessment makes **no remote changes**. Existing primary channel and bounded Scheduler counter remain. Serving code/config, rules, schedules, policies/controls, auctions, Netlify, Cloudflare configuration/routing, DNS, deletion and payments were not changed. Local preparation documents/definitions and the non-active configuration fragment remain uncommitted; credentials, screenshots, API receipts and private qualification artifacts stay outside Git.
