# TAKEME V1 controlled activation runbook

6 October 2026. **Preparation only; nothing in this document authorizes execution.** This is the authoritative operational sequence under the owner's new constraints. It supersedes the bounded timing/X/Y requirements in `production-activation-rehearsal.md` and `operational-timing-rehearsal.md`; their measurements, source inventory and compatibility limits remain evidence.

Production identity stays `takeme-52b80`, bucket `takeme-52b80.firebasestorage.app`, region `asia-southeast1`. Do not substitute demo/staging resources. No domain cutover, DNS, Cloudflare production routing, Hostinger, Netlify removal, payments, deletion activation or unrelated schedules/TTL changes are included. The existing serving host must remain available. Approved legal content and publication/date source are unchanged by this preparation.

## Decision and timing model

The runbook does **not** require a guaranteed whole-window deployment time, guaranteed complete rollback time or calculated auction X/Y exclusion horizon. Missing whole-window timing samples alone are no longer blockers. Do not repeat cloud deployment timing cycles to fill those gaps.

Use **60–90 minutes internally** for planning the protected-write pause. This is neither a maximum nor public copy. Previous measured serial component subtotals are best **21m05s**, median **22m13s**, conservative **57m57s**; measured transport-recovery component reserve **31m49s**. They exclude several real execution/verification/recovery activities and must not be summed into an SLA. Component overruns require state inspection, not blind retries or deadline-driven reopening. Keep writes paused for as long as safe verification/recovery takes.

Public copy must describe temporary unavailability and explicit manual retry without a promised completion time. Browsing remains available where safe. Retain user context; do not replay deferred marketplace actions.

## Zero-auction strategy and local admission control

**NO-GO if any active production auction exists.** Published scheduled auctions are also a no-go: the unchanged lifecycle job can start them during an open-ended pause. There is no bounded horizon that makes an upcoming start safe. Wait for existing obligations to finish naturally; never automatically cancel, reschedule, extend clocks or change winner/final-bid records.

Require aggregate counts of published (`status == active`) auctions with `auctionStatus == active` **and** `scheduled` both zero, immediately before activation after verified creation freeze and admission drain. The query conservatively counts all matching records, without filtering on a potentially malformed listing type. Drafts and ended history are not removed. Unknown counts, stale evidence, unhealthy lifecycle or inconsistent state are no-go.

Prepared server-only record:

```json
{"releaseTarget":"production","projectId":"takeme-52b80","auctionCreationPaused":true}
```

Fixed path: `releaseControls/auctionCreation`. Exact three fields only. Absence preserves legacy normal behavior but is **never evidence of a freeze**. Malformed/wrong-project records, untrusted runtime or failed reads deny admission. No public control read/write permission, timer, automatic repair or expiry exists.

Coverage prepared locally:

- Current `createAuctionListing` and `publishAuctionListing`: uncached preflight and same-transaction recheck. Publishing an existing draft is admission and is frozen too.
- Matching captured historical handlers: scoped admission guard and transaction/standalone-write recheck, preserving their original payload/auth contracts. Non-auction callables retain their maintenance behavior.
- Historical and final Firestore candidates: additional guard on the existing admin listing create/update/delete clause, denying auction creation/conversion/publication while preserving non-admission historical updates, fixed listings, cleanup and reads. Normal clients still cannot use this admin path.
- Existing auction views, historical records and unscoped derived/lifecycle jobs retain their existing behavior. No lifecycle scheduler is paused by this control.

Privileged Admin SDK/import/operator writes bypass client rules. Operators must prohibit all alternative auction admission during the window and verify no unguarded service/import/revision is serving. A fixed control readback alone does not prove coverage. Do not use admin edits to manufacture a zero count or alter customer obligations.

### Before the activation sequence

Under separate execution approval, install matching historical callable/direct-rule admission and maintenance bridges **OFF**, preserve live environment/IAM/traffic, and verify unchanged normal contracts before using the freeze. Use the six exact pinned source groups/35 protected target inventory in the earlier rehearsal, never a broad Functions deployment. Choose the separately classified `getProtectedWriteStatus` endpoint once. Capture newly prepared source/rule hashes including admission guards. Refresh live metadata/source parity before execution; do not assume old readbacks still match.

Verify both auction admission callables and the admin rule path enforce the freeze; retire unguarded revisions and confirm no pending old admission. The prior 60s historical callable plus 270s transaction reserve is useful, but elapsed time does not prove quiescence. Establish a fresh, unchanged freeze token around aggregate checks. The 900-second global drain later does not excuse an unguarded auction before maintenance.

### Future operator tool — NOT RUN AGAINST PRODUCTION

`scripts/control-production-auctions.mjs` is prepared, not executed remotely. `--plan` never loads SDK/ADC. `--apply` writes only the fixed control using exact state/update-time CAS and independent readback; it does not alter listings, policy, clocks or global maintenance. `--check` uses only two count aggregates plus fixed control readbacks. It returns no listing/user/bid documents or identifiers and never authorizes activation by itself.

The future shell must satisfy the existing production resource safeguards: exact project/bucket, deletion explicitly OFF, protected payments OFF, no emulator flags, consistent Admin/managed project identity. Use existing approved operator credentials without displaying them. Plan is not permission to apply. Examples are templates, **not current instructions to execute**:

```sh
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/control-production-auctions.mjs --plan --action freeze --expected-state absent --project takeme-52b80
# Separately approved freeze: --apply, same reviewed state/token, plus --owner-approved-auction-freeze
# Fresh aggregates after freeze: --check --expected-update-time <exact-freeze-token> --project takeme-52b80
# Separately approved restore: --apply --action restore --expected-state on --expected-update-time <exact-freeze-token> --project takeme-52b80 --owner-approved-auction-restore
```

Existing controls require the exact observed update-time token. Unknown outcomes stop for inspection; never force, delete, merge or repair. Restore requires genuinely final approved legal/policy source, explicit global maintenance OFF and exact final runtime policy in the same transaction, plus source rule validation. No arbitrary source approval override is accepted. It cannot reopen the current draft preparation state. Operator sign-off and positive verification remain independent prerequisites.

[Firestore Request semantics](https://firebase.google.com/docs/reference/rules/rules.firestore.Request) define create/update/delete methods used by the narrow rule overlay.

## Final pre-activation gates

Record affirmative evidence and owner go/no-go for **all** of the following before step 7. Any missing/unknown item is no-go:

1. Final legal counsel approval and owner publication approval, including unresolved address/disclosure/retention/provider/liability/indemnity items.
2. Explicit actual production launch date; shared effective/last-updated dates validated, not invented.
3. Terms 1.0, Privacy EN 1.0, Privacy BM 1.0 and Prohibited Items 1.0 finalized and mutually linked.
4. Reviewed source checkpoint and production artifacts built/scanned; no demo/staging/client-config leakage.
5. Legal-only artifact for the **existing serving host** qualified and captured independently of a Cloudflare website/domain migration.
6. Compatible frontend/backend/rule rollback artifacts captured with hashes, resource identity, environment/IAM/traffic preservation and recovery dependencies. After new schema/evidence adoption, raw historical source is not automatically compatible.
7. Nonpersonal monitoring baseline, approved alert/watch coverage, operator access and named incident/rollback owner plus the required backup ready; no invented percentage thresholds. Use the [monitoring readiness record](v1-monitoring-readiness-gate.md): both support.takeme@gmail.com and zweetdata@gmail.com delivery paths verified, exact Worker Custom Alert unavailability (Dashboard Error 17203) recorded, owner-approved manual Cloudflare activation/immediate post-deploy watch ready, production deployment observability/query redaction preserved, and both contacts available. Optional unavailable Custom Alerts/test delivery do not block technical preparation when enabled observability, documented operator watch, verified Google delivery/contacts and ready rollback/runbook coverage are all present. If any of those conditions is missing/unknown, monitoring is not ready. The five Google sensitivities are approved; normal policy enablement remains a separate owner-authorized monitoring action, not implied pre-launch authority. Disabled alert candidates or API acceptance alone are not proof of active paging coverage. External legal and owner GO gates remain unchanged.
8. Matching historical maintenance/admission bridges ready and normal OFF behavior verified; all serving protected aliases/direct writes covered.
9. Historical Storage create/update freeze ready; reads and owner cleanup preserved; final permit-aware restore captured.
10. Creation/publishing frozen and independently enforced; privileged alternative admission prohibited; unguarded requests/revisions drained.
11. Fresh zero active **and published scheduled** counts, stable freeze token, healthy lifecycle evidence.
12. No existing production incident or unknown mutation/resource state.
13. Exact final policy/bootstrap/preparation endpoint/rule/frontend/serving inventory and messaging/upload transition settings reviewed.
14. Owner present for the start, every go/no-go and reopen; separately approved bounded synthetic verification identities/data.

Current source still has `publicationApproved=false`, effectiveDate/lastUpdated null. This task does not change those gates, write `releasePolicies/current`, or certify live production counts/coverage. Final legal approval alone does not bypass the other gates or authorize activation.

## Final operator sequence — 36 steps, NOT EXECUTED

### PRECHECK

1. **Production health:** verify exact resources, serving revisions, existing-host public browse/images/auth/legal routing, lifecycle health, incident and monitoring baseline using nonpersonal metadata/status. Stop on inconsistency.
2. **Initial zero-auction check:** use separately authorized aggregate evidence only. Any active or published scheduled auction: no-go; wait naturally. This initial check alone is not final proof because creation is still available.
3. **Prevent new auctions:** after OFF-installed guard coverage, freeze the fixed control with CAS/readback, deny both create/publish and alternate admin admission, retire/drain old admissions. Recheck fresh zero active/scheduled counts with unchanged freeze token **before maintenance begins**. No customer record edits.
4. **Rollback baseline:** capture/hash compatible guarded source, rules, frontend/legal-only artifact, runtime settings/IAM/traffic, policy/control state/tokens and irreversible-effect handling. Do not treat insecure old Storage or keyless write contracts as safe final reopen.
5. **Final artifacts:** validate resource/source provenance, full serving inventory, production build/forbidden-string scans, rules generation, transition settings and rollback compatibility.
6. **Legal/date go-no-go:** all final gates above affirmative, legal-only delivery approved; repeat the stable-freeze/zero active-and-scheduled aggregate check immediately before step 7. Owner authorizes the controlled window. If not, stop before maintenance; auction freeze restoration is a separate reviewed recovery decision, not an automatic action.

### PAUSE

7. **Enable protected-write maintenance:** guarded `releaseControls/current` CAS/readback. Missing control is normal compatibility, never proof of pause. Verify every serving bridge recognizes ON; re-enable/reconcile on unknown state.
8. **Public browsing:** browse/listing/seller/history/image/legal/help/auth reads remain available and safe.
9. **Protected denials:** current/legacy Sell, Chat, Offer, Bid, Save, Follow, profile/settings writes and relevant admin direct paths refuse without side effects. Current acceptance/profile-setup/welcome exceptions remain intentional; login/refresh is never consent.
10. **No new permits:** reject guarded upload-permit issuance; account for any racing previously admitted issuance and record the last completed permit time.
11. **Historical Storage freeze:** install only reviewed applicable create/update freeze, verify both new and overwrite admissions denied. Retain read and owner cleanup permissions. Record last effective enforcement/propagation evidence; OFF global control must not unfreeze historical uploads.
12. **Wait 900 seconds:** start from the **last verified effective pause** after all callable/direct enforcement, stopped permits and historical freeze are established. The lower bound is the maximum of pause +900s, last old admission +330s, last completed permit +120s, and rule bridge propagation reserve +600s. A later admission or later verification moves the checkpoint. 120s alone is forbidden.
13. **Quiescence/settlement:** confirm retired old revisions, in-flight runtime completion, no pending upload admission/transfer and actual enforcement/listener state where measurable. Use safe transfer/status evidence, never enumerate customer content. Recheck stable freeze/zero active-and-scheduled aggregates before step 14. Unknown settlement blocks transition indefinitely even after 900s. `assessV1ActivationDrain` validates clocks and affirmative evidence, never grants activation.

### ACTIVATE — KEEP GLOBAL MAINTENANCE ON AND AUCTION FREEZE ON

14. **Approved legal routes:** publish only source-qualified final legal routes on the existing serving host using the separately approved legal-only artifact. Verify EN/BM Privacy, Terms, prohibited linkage, dates, metadata and reachability; no full website/domain cutover is implied. Preserve evidence of any exposure even if later rolled back.
15. **Preparation + policy bootstrap:** verify/install the five compatible preparation endpoints (`getAccountSetupStatus`, `acceptWebPolicies`, `completeFirstTimeProfile`, `finishAccountWelcome`, `requestUploadPermits`) under ON using their exact inventory. Permit issuance stays blocked. Create-only `releasePolicies/current` after legal reachability/preparation readiness; exact schema/source/version/project/readback/idempotency. On missing/conflicting/unknown mirror, stop; never auto-repair/re-enable/delete it.
16. **Compatible frontend:** deploy approved production artifact to the existing host; verify source stamp/resource identity, legal/auth/public reads, retained intents, normal default `/explore` and maintenance notice/manual retry. No queued action executes. Immediately verify host/Worker observability as applicable: exact version, observability still active after deploy, invocation logs/request/error/latency metrics arriving after their ingestion delay, no 5xx/exception spike, required Function health and six Scheduler states. Absent telemetry is UNKNOWN, not a health pass; stop before reopening if coverage is missing.
17. **Coordinated serving Functions:** exact reviewed 34 callable +six event inventory/dependencies, correct package/config/IAM/region/traffic. Preserve all required other read/lifecycle/resolution exports. Validate bounded messaging idempotency transition and upload-permit phase; do not infer serving parity from names. Stop on any partial/unknown state.
18. **Final Firestore rules:** generate from genuinely approved policy source, confirm mirror/serving parity first. Preserve acceptance-history/current-eligibility and maintenance/admission guards, existing indexes/TTL compatibility and public reads. Verify fresh enforcement/propagation. Review-only headers/closed production templates are not deployable final artifacts.
19. **Final Storage rules:** exact bucket, qualified permit-aware rules after Firestore dependencies; ON blocks new issuance, auction freeze remains ON. Enforce owner/type/size/no-overwrite/lease checks; verify reads, old lease expiry/transfer settlement. Never fall back to permitless uploads to reopen.

### VERIFY — PROTECTED MARKETPLACE TESTS HERE ARE NEGATIVE

20. **Public browse:** Home/Explore, dynamic fixed/auction detail, seller, history, images and legal/help routes; no staging text/config, broken hydration or read permissions.
21. **Signup/onboarding:** separately approved synthetic account only; explicit Terms, Privacy and 18+ required, profile setup/welcome/default Explore, explicit return intent preserved without execution.
22. **Reacceptance:** old version/18+ absent/revoked/pending account cannot gain protected eligibility; browsing remains available; no login/refresh consent.
23. **Immutable evidence:** fresh exact versioned acceptance history plus bounded current projection; protected initial/current/old-client bypass attempts fail. Do not mutate/delete acceptance evidence to fake rollback.
24. **Sell:** remains unavailable while ON; no listing mutation. Positive behavior already qualified locally; defer production positive write to step 34.
25. **Chat:** refuses mutation, reads/history available, no message or notification side effect.
26. **Offer:** refuses new/respond mutations covered by maintenance; preserve existing approved resolution semantics and no auto-execution.
27. **Bid:** denied by maintenance; zero unfinished auctions is still required. Do not create a production auction solely to test this while creation is frozen. Positive bid behavior uses existing emulator evidence until separately approved post-restore synthetic smoke.
28. **Save:** mutation denied; existing Saved reads and truthful final-bid wording remain.
29. **Follow:** mutation denied; safe seller projection/history remains.
30. **Upload:** no new permits, direct/expired/unowned/overwrite admissions denied, existing images render; unsettled transfer means stop.
31. **Listing creation:** fixed and auction creation/publishing remain blocked under ON; no draft/publish/event/rate-control side effect. Auction admission freeze is independently enforced.
32. **Isolation/parity:** deployed source/artifact/rule/bootstrap/control parity; production project/bucket/Functions only, no demo/staging endpoints. Final public/auth/negative/projection/history checks pass, zero active/scheduled state and stable freeze reverified, monitoring clear. Owner signs off verified coherent state, not a timer.

### REOPEN

33. **Global maintenance OFF:** only with all paused verification passed, coherent compatible recovery captured, final source/runtime/rules parity and explicit owner reopen approval. Before changing the control, confirm every item in the [pre-reopen monitoring checklist](v1-monitoring-readiness-gate.md#stop--reopen-rules): primary support.takeme@gmail.com and backup zweetdata@gmail.com available with access/handoff; both Google/Firebase delivery paths verified; approved manual `takeme-web` metrics/log watch active with logging/query redaction preserved (Custom Alerts unavailable due Error 17203); no CRITICAL alert/incident; required Functions, six schedulers and auction lifecycle healthy; separately verified valid Storage/upload path healthy; and Worker 5xx/exception monitoring available with ingested telemetry. Disabled policies or empty panels cannot certify health; lost operator access/unknown telemetry stops progression. Use exact fresh CAS/token/readback. Auction admission and secure permit rules remain in place. No partial reopen of inconsistent components.
34. **Protected smoke:** separately approved small synthetic fixed-listing, Chat/message, Offer, Save, Follow, owner upload and lifecycle/permission tests; no customer content, load testing or automatic action replay. Keep auction creation frozen until these production checks pass. Bid is still a negative/no-live-target check here; its positive result cannot be claimed remotely yet.
35. **Restore auction creation:** after verified production state and owner sign-off, guarded restore of fixed auction control. Readback/independent callable/rule checks. If separately approved, tiny synthetic auction create/publish/bid smoke completes auction positive verification; no clock manipulation. Any failure: re-establish global ON and creation freeze using fresh CAS, verify both, enter abort. Restoration is not automatic after elapsed time.
36. **Monitor:** public availability, protected errors/denials, uploads/permits, acceptance evidence, source parity, scheduler/lifecycle and cost; owner-approved baseline/alerts. Keep the approved manual Cloudflare watch active throughout activation and immediately after deployment, independently confirming preserved observability and actual ingestion at the frontend deployment boundary. Review the compact [activation monitoring dashboard](v1-monitoring-readiness-gate.md#compact-activation-dashboard) every five minutes and at each go/no-go. Broad valid-user failures or sustained serving/lifecycle failures are CRITICAL; bounded errors, job delay and unexplained usage increases need WARNING triage. Expected maintenance denials are not unknown errors. Preserve rollback and Netlify; no domain/hosting removal is authorized here.

## Abort / compatible recovery

**DEFAULT: KEEP WRITES PAUSED.** If reopening has occurred, re-establish ON and auction freeze immediately with exact inspected CAS state; confirm all enforcement. Unknown outcome means inspect/readback, not blind repeat. Public browsing may continue only where safe. Stop new rollout work and assign the incident owner. There is no fixed reopen deadline, even beyond 90 minutes.

| Failure point | Safe response | Conditions before any reopen |
| --- | --- | --- |
| Guard installation/OFF precheck | Stop; reconcile matching source/environment/IAM/rules and old admissions. Do not claim incomplete bridges provide ON coverage. | Full reviewed coverage and zero-auction gate; no automatic auction restore. |
| ON/drain/quiescence | Keep ON/creation freeze/Storage freeze; unknown admission or transfer must settle/be diagnosed. | Complete evidence; elapsed time alone cannot reopen. |
| Legal exposure/bootstrap | Keep ON. Preserve exposure/acceptance evidence; inspect exact mirror without repair/deletion. Restore compatible legal artifact where approved. | Coherent approved legal/source/runtime policy; no return to unapproved consent state. |
| Frontend/Functions partial adoption | Keep ON. Reconcile every target and traffic/config. Restore only compatible guarded/schema-aware source and frontend. | Full code/rule/policy/evidence parity, not raw historical code with newly adopted schema. |
| Firestore/Storage | Keep ON and secure upload freeze; restore compatible rules, preserve reads/cleanup; verify propagation and settlement. | No unsafe admin OR escape, permitless fallback or unverifiable permissions. |
| Post-reopen smoke/monitoring | Re-establish ON and auction freeze, preserve committed synthetic effects/evidence, diagnose/restore coherently. | Owner reapproval plus the same complete verification. |

Reopen only after **successful activation +verification**, or **successful compatible rollback +verification**. Component restore tests and planning reserves are evidence, not complete rollback duration promises. A pre-policy legacy reopen is not supported by the current final-policy operator; keep paused until a coherent qualified state or obtain a separately reviewed safe recovery procedure. Do not invent a policy/source bypass to close a maintenance window. Legal exposure and immutable acceptance history cannot be made never to have happened.

Immediate stop conditions: wrong project/bucket/source, unexpected protected admission, missing guard, unknown mutation, public read outage, auth/acceptance regression, immutable history corruption, unsettled upload, unhealthy lifecycle, nonzero/stale auction counts, incompatible rollback, or existing production incident. Notify the owner through the agreed operational channel; this document sends no external messages. Do not log credentials/tokens/headers, request payloads, private content or customer identities.

## Preparation qualification and remaining inputs

Locally qualified: exact auction control schema/fail-closed runtime, current and historical callable admission, transaction race refusal, admin rule overlay, count-only zero gate, 900-second boundary/evidence validation, CAS/idempotent/readback refusal and closed-source restore refusal. **402 app tests and 165 Functions tests pass; app/Functions TypeScript, ESLint and diff checks pass. Ten isolated demo integration groups pass and all six pinned historical packages compile.** Targeted follow-up tests pass after test-typing corrections. Existing component timing/rollback/upload/lifecycle evidence is reused, not repeated remotely. New emulator tests are isolated `demo-takeme` only; no production counts or customer data were read.

Remaining execution inputs: final counsel/owner legal/date/publication approvals; genuinely final source/artifact and existing-host legal delivery/compatible rollback; refreshed serving/source/rules metadata and transition settings; live guard installation/enforcement/propagation/admission drain; monitoring/incident/owner readiness; fresh zero active/scheduled counts. These are explicit execution gates, not a demand for more whole-window timing rehearsals.

The runbook is ready for owner review as a **local preparation**. Auction risk is controlled by the prepared/tested zero-plus-freeze strategy; production control is **not installed or enabled**. It is safe to stop timing rehearsals under the new model. Proceed only after final legal approval **and every other pre-activation gate and separate execution approval**. No commit, push, deploy, policy/bootstrap, production maintenance/freeze, legal publication, deletion activation or provider/routing change was performed.
