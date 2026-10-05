# Operational timing and rollback rehearsal

Owner review preparation from qualification checkpoint `9241867bcf430fc3a5c023d0e8a30892fdd64c19`, 5 October 2026. This follow-up supersedes the **unmeasured timing rows** in `production-activation-rehearsal.md`, but does not change its legal, compatibility, consent, secure rollback or owner-approval gates.

No serving production Function, rule, Worker, domain, maintenance control or policy was changed. No customer documents, bids, messages, Storage objects or customer logs were read. Approved legal content, main, publication/date flags, deletion and payments remain unchanged. Existing staging Functions/default rules and `takeme-web-preview` were preserved. Tests used bounded synthetic accounts/data and temporary, private, separately named resources in `takeme-staging-822a5`. Generated source packages, SDK inputs, tokens, receipts and logs are outside Git.

> **6 October 2026 supersession:** [V1 production activation runbook](v1-production-activation-runbook.md) is now authoritative. Whole-window activation/rollback bounds and X/Y horizons are no longer required. These are historical measurements and limitations, not the current operator sequence. The approved strategy uses zero active AND published scheduled auctions, verified admission freeze, a 900-second effective-pause checkpoint, settlement and open-ended compatible recovery. No timing cycle was repeated.

## Measurement method and limits

The matching deployment/restore batches use Node22, asia-southeast1, 256Mi RAM, one CPU, concurrency 80 and zero minimum instances, matching the production metadata read-only. Maximum instances is intentionally **one**, versus production's 20, to limit rehearsal cost; no load/traffic equivalence is claimed. Four deployments run concurrently. The 35 protected bridge targets retain six captured source groups. The coordinated batch includes all 34 callable targets and six real Firestore event triggers; event filters and Admin SDK clients point to the isolated named database. Five preparation targets are measured separately. Function restore samples redeploy the captured guarded historical sources (including six historical event handlers) into the isolated **paused** environment. They measure rebuild/rollout transport recovery; they do not establish schema-aware, post-acceptance compatibility or authorize legacy reopening. The four other preparation endpoints remain current; a complete preparation/history-aware recovery remains unqualified. Every alias is IAM-private. ACTIVE state, Cloud Run readiness, private IAM and harmless transport responses are verified; callable empty unauthenticated requests return 400, event empty envelopes return 200. These probes establish transport health, not a replacement for the earlier business/authorization/emulator tests.

The status/lifecycle canaries also retain the initial `256M` profile; recognition/cadence observations are equivalent control-path samples, not matching-profile production latency qualification. The initial deployment repetitions used `256M`; they remain as supplementary observations and **are not silently treated as the matching `256Mi` profile**. Incomplete batches and transport/verification failures are retained but excluded from complete timing samples. Unknown mutation outcomes stop and require reconciliation; only read-only verification is retried automatically. Provider read verification timeouts/unreadable JSON, repeated health transport errors, and an unreadable mutation response were encountered, stopped, reconciled and retained. The mutation outcome was treated as unknown until ACTIVE/source/operation reconciliation established a known state; a new bounded batch was then started, without blind write retry. Build, upload, rollout/ACTIVE and verification timings are recorded separately. Polling adds up to one five-second poll interval to observations.

Frontend samples use the actual Next 16.3.8 / OpenNext Cloudflare 1.20.8 / Wrangler 4.147.0 artifact from clean, reviewed staging commit `de22d45d46ee83dff27a1c4b91e074fd47ffc9c1`. The temporary Worker serves that real app only behind its separate random secret gateway, including assets. Anonymous requests are denied. This is **not** the current final legal/maintenance frontend, a Netlify legal-only publication or a production domain migration. No release/source guard was bypassed.

Rules use the isolated named Firestore database and an owned isolated Firebase Storage bucket. Control-plane release/readback, fresh authenticated synthetic admission/denial and public synthetic reads are separate observations. Subsecond fresh-request denial does not prove propagation to every active listener. Firebase documents up to ten minutes for active Firestore listeners; that reserve remains required ([rule deployment](https://firebase.google.com/docs/firestore/security/get-started)). Storage has no assumed universal propagation or cancellation bound.

“Best” is the minimum complete observation; “expected” is the median, not a probability forecast. The conservative Function reserve is **2 × the longest complete matching-profile batch + 120 seconds**, rounded up to a whole minute. Worker reserve is 2 × the longest observation + 60 seconds, rounded up to 30 seconds. Small control operations use 2 × the longest + 5 seconds, rounded up to a second; rules use 2 × the longest + 30 seconds, rounded up to a second, **plus applicable propagation/settlement gates**. These are explicit operator planning reserves, not provider guarantees, statistical bounds or public SLAs. An overrun stops new phases and triggers reconciliation; it never automatically reopens writes.

## Measured components

| Component | Complete samples | Best | Expected (median) | Conservative planning checkpoint | Scope / additional gates |
| --- | ---: | ---: | ---: | ---: | --- |
| 35-Function maintenance bridge | 2 | 511.182s | 566.013s | 23m00s | Matching 256Mi profile; max one instance; private IAM |
| Five preparation Functions | 2 | 98.708s | 101.230s | 6m00s | Matching 256Mi profile; max one instance; private IAM |
| 40 coordinated Functions (34 callable + six event) | 2 | 618.275s | 625.756s | 24m00s | Matching 256Mi profile; max one instance; private IAM |
| 40 guarded historical Function restores | 2 | 580.604s | 682.638s | 29m00s | Paused transport recovery; post-adoption compatibility unqualified |
| Historical Firestore overlay | 2 | 3.991s | 4.530s | 0m41s | Fresh denial + readback; active-listener reserve still required |
| Final Firestore candidate | 2 | 4.075s | 4.636s | 0m41s | Fresh denial + readback; active-listener reserve still required |
| Compatible Firestore restore | 2 | 2.975s | 2.989s | 0m37s | Fresh denial/public read; active-listener reserve still required |
| Secure Storage freeze / restore | 2 | 2.756s | 2.756s | 0m36s | Fresh admission denied; transfer settlement still required |
| Permit Storage candidate / restore | 2 | 3.225s | 3.603s | 0m38s | Fresh valid lease admission; stopped issuance/expiry/settlement still required |
| Isolated Worker deploy + health | 3 | 22.159s | 24.043s | 2m00s | Older approved staging artifact; final/current hosting path unqualified |
| Isolated Worker version restore + health | 2 | 7.866s | 8.393s | 1m30s | Anonymous denied; final/current hosting path unqualified |
| Create-only staging policy bootstrap | 3 | 0.203s | 0.258s | 0m07s | Equivalent helper; actual production apply intentionally blocked |
| Maintenance ON + status/guard recognition | 3 | 0.245s | 0.247s | 0m06s | Isolated equivalent; complete direct/browser recognition unqualified |
| Maintenance OFF + status/guard recognition | 3 | 0.262s | 0.289s | 0m08s | Fresh callback; final production reopen intentionally blocked |

The two actual OpenNext build/provenance checks took **16.285s and 15.334s** (best 15.334s; median 15.810s). A separate 120s build checkpoint is an explicit planning reserve, not part of the deployment samples.

| Function batch | Generate-upload-URL + archive upload per source group | Provider build range per target | Deployment operation range per target | Time to ACTIVE range per target | Health/readback after ACTIVE range |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bridge | 0.242s–0.502s | 22.065s–37.947s | 40.610s–305.635s | 42.321s–307.569s | 0.595s–1.566s |
| Preparation | 0.368s–0.505s | 29.924s–35.616s | 45.893s–58.751s | 47.897s–61.095s | 0.628s–0.978s |
| Coordinated | 0.407s–0.489s | 21.658s–37.511s | 35.769s–306.182s | 37.891s–308.153s | 0.600s–1.382s |
| Restore | 0.280s–0.498s | 21.584s–44.409s | 36.899s–290.681s | 39.048s–292.508s | 0.663s–1.069s |

Archive packaging/prebuild occurred before deployment; the upload timer includes signed-URL generation and archive transfer. The provider BUILD interval is measured from its own timestamps. A separate SERVICE-only interval is not exposed in the captured operation stages, so operation-to-ACTIVE observations include queue/build/rollout rather than inventing a precise service-only duration. These per-target portions overlap within a four-wide batch and must not be summed to create a second batch total. The slowest bridge ACTIVE observation is retained rather than averaged away.


All four required Function batch types have two complete matching-profile repetitions; all aliases passed ACTIVE, readiness, private IAM and transport readback. Partial/failed repetitions are excluded, not erased.

Three create-only policy-mirror repetitions used the real staging initialization helper on the isolated database: validation 0.09–0.29ms, guarded write 43–74ms, independent readback 38–61ms, idempotent confirmation 62–103ms. They qualify the equivalent staging write/readback path. Actual production apply remains refused by false/null legal source; no production policy was created.

Three ON and three OFF transactions were read back and recognized by the live isolated current status endpoint. Each frontend guard attempt fetched fresh status; no cached OFF decision was reused. ON total 245–267ms; OFF total 262–1,195ms including a cold backend recognition of 935ms. This measures the actual frontend guard with a real remote status callback, **not browser banner render latency or legal-qualified production reopen**. The production CAS operator still requires its exact update-time token and final source/runtime policy before disable. ON write/readback took 86–89ms / 42–43ms, backend recognition 50–77ms and the fresh frontend callback 59–67ms. OFF write/readback took 72–92ms / 35–44ms, backend recognition 72–935ms and the frontend callback 74–135ms. These portions are retained separately; cold recognition is not discarded.

Two remote authenticated negative-callable sweeps verified all 35 protected aliases return `FAILED_PRECONDITION` / `protected-writes-paused`, before payload validation, using one disposable synthetic staging account. The cold sweep took 9.458s; the warm sweep 0.701s. The account was deleted. A 49s planning checkpoint (2 × longest + 30s, rounded up to a second) covers this **callable refusal subset only**; it does not substitute for complete legal/current-frontend/direct-write/image/acceptance/auction/end-to-end smoke.

## Request drain and uploads

| Reserve | Requirement | Admission origin / evidence |
| --- | --- | --- |
| Minimum request planning reserve | 330 seconds | Last confirmed unguarded admission: 60s historical callable timeout + 270s transaction lifetime. Retired revisions and actual runtime quiescence must be verified. |
| Permit lease reserve | At least 120 seconds | Last **completed** permit issuance, including any request racing ON. New guarded issuance must be denied. |
| Recommended effective-pause reserve | At least 600 seconds | Allow both request/lease reserves and the documented active-listener rule propagation reserve to expire. The independent clocks overlap; do not restart a satisfied clock without new admission/evidence. |
| Conservative operator reserve | 900 seconds, then stop/reconcile if not settled | Explicit 300s additional planning margin over 600s. This is a checkpoint, **not a universal upload completion or runtime bound**. Unknown quiescence/settlement blocks continuation at any elapsed time. |

The 24-hour keyed-message receipt retention is deduplication evidence, not a request runtime. Existing message identity still detects retries after receipt expiry when the message exists. Historical keyless HTTP retries can remain distinct sends; the optional bounded seven-day transition is a separately approved compatibility setting, not a drain extension or automatic retry permission. After pause/reopen a user explicitly retries; no queued marketplace action is replayed.

The installed Storage SDK uses `uploadBytes`; its default upload retry allowance is ten minutes and general operation allowance two minutes. A retry sent after authoritative freeze should be refused, but those settings are not completion guarantees. HTTP callable timeout also does not prove all background writes have stopped ([Functions guidance](https://docs.cloud.google.com/run/docs/tips/functions-best-practices), [transaction limits](https://firebase.google.com/docs/firestore/manage-data/transactions)).

Provider upload trials used 1MiB synthetic images and the actual 120s lease model: an admitted valid upload completed in 1.021s; a new admission after freeze returned 403; an earlier admitted session finalized after expiry/freeze returned 403 at 125.440s. An already-streaming upload returned 403 at 126.770s; that first trial had an overlapping control toggle and is supplementary only. The repeat with continuously ON control and a live new-permit refusal returned 403 at **126.638s**. Longest observed settlement was **126.770s**; strongest continuously ON proof is 126.638s. Neither 120s alone nor these few 1MiB trials establishes a universal bound for all sizes, old clients, session modes or networks ([resumable session behavior](https://docs.cloud.google.com/storage/docs/resumable-uploads)). Keep freeze, and require nonpersonal transfer completion/denial evidence. Never infer settlement by enumerating customer objects.

## Scheduler and auction gate

The temporary lifecycle canary ran the actual captured historical scheduler on the isolated synthetic dataset under ON. It ended the synthetic auction with the same end time, highest bidder and final bid. A second fresh synthetic auction recorded its exact start/end fields before invocation, then verified exact start/end equality, unchanged winner and final bid after the real historical lifecycle handler ran under ON. Its temporary one-minute Scheduler job completed two scheduled ticks and was removed. Completion observations were 13:08:00.336Z and 13:09:04.883Z on 5 October 2026: 64.547s apart, finishing 0.336s and 4.883s after minute boundaries. These include handler work and are **not** maximum provider delivery delays. The 120s handler timeout and 180s attempt deadline mean a one-minute job can overlap another attempt or a rollout; preserve lifecycle behavior and monitor delivery/duplicate safety rather than pausing schedules or extending auction clocks.

A read-only production Scheduler metadata check found the lifecycle job enabled, with its expected one-minute UTC schedule, 180s deadline and a recent attempt. Its empty status protobuf represents the default OK code but does **not** establish application lifecycle success or zero incidents. A bounded rehearsal-log metadata read hit a provider quota limit; no alternate credentials, quota project or permission bypass was attempted. Production customer logs were not read.

Before a real V1 window, obtain fresh **nonpersonal aggregates only** after verified admission freeze/drain: zero published active and scheduled auction counts, stable freeze token, resolved lifecycle incidents and recent healthy application evidence. No customer documents/IDs/bids/accounts may be returned. The new fixed-control/count-only preparation implements this shape; no production aggregate was executed. `assessAuctionOperationalPrecheck` remains historical horizon analysis; the current zero-plus-freeze gate is `assessZeroAuctionActivation`. Counts alone do not prove guard coverage or old-request quiescence.

The earlier X/Y exclusion-horizon proposal is superseded. V1 uses the zero-active/published-scheduled plus verified creation-freeze gate in the new runbook. Complete activation, recovery and verification totals remain unknown; under the owner-approved open-ended strategy, this timing uncertainty alone is not a blocker. The historical timing helpers remain analysis tools, not activation guards.

## Historical component planning table — superseded sequence

The measured reserves below are per-component checkpoints. A compatible restore must retain maintenance, secure upload restrictions, keyed/permit/schema compatibility and consent evidence. “Restore” never means permitting an insecure historical write path.

| Step | Expected observation / checkpoint | Conservative timeout / reserve | Success signal | Failure / abort point | Compatible rollback action |
| --- | --- | --- | --- | --- | --- |
| Identity, source and baseline capture | Measured read-only inventories; complete final refresh not timed | Unknown for complete production precheck; must be qualified | Exact project/bucket/region/source/rules/IAM pins; no unresolved outcome | Missing/mismatched pin or unqualified recovery | Stop without arming; capture state |
| Install 35 historical bridges OFF | Matching median 9m26s | 23m planning checkpoint, not a provider timeout | All exact targets ACTIVE and business OFF/ON contracts verified; config/IAM/traffic preserved | Partial/unhealthy/unknown deployment | Compatible guarded historical packages; 29m00s full transport restore checkpoint; schema recovery unqualified |
| Install historical Firestore overlay OFF | 4.5s fresh-request verification equivalent | 41s release/enforcement checkpoint + 600s active-listener propagation reserve | Exact source/pointer, direct write coverage and public reads | Unprotected clause, denied read or unknown propagation | Restore compatible guarded overlay; keep full propagation gates |
| Enable maintenance CAS and verify | ON 0.25–0.27s in isolated equivalent | 6s checkpoint plus complete guard verification not timed | Strict CAS/readback, status and refusal across all protected paths | Unknown write/readback or any unexpected admission | Inspect fixed control; preserve/reestablish ON; never delete it |
| Static historical Storage freeze | 2.8s fresh admission verification equivalent | 36s checkpoint + settlement gate | Fresh create/update denied; existing reads and owner cleanup work | Any accepted new upload or image-read regression | Restore reviewed secure freeze; no permitless rollback |
| Drain | Minimum 330s request / 120s lease clocks; 600s recommended effective-pause reserve | 900s operator checkpoint, then stop if any required evidence is unknown | Retired revisions, runtime quiescence, stopped permits, listener enforcement and settled transfers | Timer expired without complete evidence | Keep ON/freeze; no automatic reopening |
| Legal-only publication on existing host | **Unmeasured; current source is draft/false/null** | **Unknown; execution blocked** | Separately approved final legal artifact on actual serving host, accurate content/date/language/metadata | Draft exposure, placeholder, serving or read error | Qualified legal-host restore required; preserve fact of exposure |
| Five preparation endpoints | Median 1m41s | 6m00s checkpoint | Actual current source/contract and eligibility/history paths verified | Source mismatch/failed acceptance/unknown rollout | Keep ON; compatible preparation restore must preserve immutable history |
| Create-only policy bootstrap + readback | Equivalent helper 0.20–0.50s total | 7s checkpoint; production source gates remain mandatory | Exact six-field trusted record, source parity, independent readback | Existing different/revoked/malformed record or unknown outcome | Reconcile fixed record; no repair/delete/blind retry; revocation recovery not qualified |
| Compatible frontend | Older reviewed staging Worker deploy + health median 24s; builds 15–16s | Worker 120s; build 120s. **Current final / existing-host artifact unqualified** | Correct qualified source stamp, notices, auth/intent/manual retry, images and reads | Source/adoption/hydration/legal/read failure | Restore compatible artifact; measured Worker restore 90s reserve, existing-host restore unknown |
| Coordinated 40 Functions | Median 10m26s | 24m00s checkpoint | 34 callable + six event exact-source parity, config/IAM/traffic and derived behavior; ON intact | Failed/unknown subset, incompatible old client or event behavior | Compatible guarded/schema-aware restore; 29m00s measured transport checkpoint, schema recovery unqualified |
| Final Firestore candidate | 4.1–5.2s release/readback + fresh denial equivalent | 41s checkpoint + applicable listener reserve/enforcement checks | Exact final source and active policy parity; public reads and denial/setup tests | Unexpected protected admission/public denial/unknown activation | Compatible secure overlay; 37s fresh-request restore reserve + propagation gate |
| Final permit Storage candidate | 3.2–4.0s release/readback + fresh lease admission equivalent | 38s checkpoint + lease/transfer settlement gates | Exact bucket/rules; new permits still paused, expired/no permits denied; image reads | Unsafe admission, broken read or unsettled transfer | Secure freeze; 36s restore reserve, then settlement verification |
| Complete paused smoke / auction precheck | Individual synthetic negative checks pass; full coordinated run not timed | **Unknown; cannot fabricate a verification budget** | Every current/historical protected path refuses; public/setup/legal/image reads work; fresh zero aggregates and lifecycle evidence | Any failure/unknown counts/incident | Preserve ON/freeze and compatible components |
| Guarded final reopen | Equivalent staging OFF 0.26–1.20s | 8s control checkpoint; production legal/runtime gates not qualified | Owner approval + exact CAS + final policy/legal/source/rules parity/readback | Gate refused or unknown outcome | Inspect/re-enable with fresh token; never bypass final source gates |
| Bounded positive smoke / monitor | Not authorized/executed on production; full equivalent coordinated final smoke not timed | **Unknown** | Separately approved synthetic outcomes, normal reads, no unexpected errors | Any regression or unresolved monitoring | Re-establish ON/freeze; compatible recovery; preserve committed effects and evidence |

Prerequisite package/artifact preparation occurs outside the protected-write window where possible. The bridge installs OFF first; do not enable ON before complete historical callable/direct-write coverage is verified. The pause duration and total operational duration differ: installing bridges before ON does not mean writes were already paused. Preinstalled rule propagation can overlap callable installation, but do not subtract overlap without reliable timestamps and enforcement proof.

## Failure and decision table

Seven isolated controller failure checkpoints were exercised: after maintenance, simulated draft legal exposure, policy bootstrap, frontend, Functions, Firestore, and Storage. Each kept/reestablished ON, actual backend/frontend negative guards refused protected writes, synthetic acceptance evidence remained unchanged, and no automatic reopen occurred. Provider Worker/rule/Function restores were measured separately. These are controller negative-path tests plus real component rollbacks, **not seven complete production/end-to-end failure deployments or actual final legal publication**. Legal exposure/acceptance cannot be made never to have occurred by restoring a version.

| State | Action | Continue? | Rollback? | Reopen writes? |
| --- | --- | --- | --- | --- |
| Bridge incomplete/unhealthy while OFF | Stop installation; reconcile each target and restore matching compatible behavior | No | As needed | Do not claim ON covers it |
| ON + all enforcement/public reads verified | Finish timestamped drains and settlement | Only to approved next checkpoint | No unless a regression appears | No |
| Any protected admission succeeds or public reads fail | Stop rollout, retain/reestablish pause and secure freeze | No | Compatible repair/restore | No |
| Maintenance established, failure before legal/bootstrap | Keep pause/freeze and inspect exact state | No | Compatible baseline if reviewed | Current operator cannot reopen legacy pre-policy state |
| Legal exposed, bootstrap failed/unknown | Preserve exposure/evidence; reconcile fixed policy, never blind write/retry | No | Qualified legal-host restore if needed; timing unknown | No |
| Bootstrap succeeds, frontend fails | Keep ON, retain immutable evidence and mirror | No | Restore qualified compatible frontend | No |
| Function batch partly deployed/unverified | Stop new mutations; reconcile all aliases before restore | No | Reviewed compatible guarded batch | No |
| Final Firestore fails | Keep ON and Storage freeze; preserve public reads | No | Verified compatible rule release | No |
| Final Storage fails | Keep ON; freeze create/update and preserve read/owner cleanup | No | Verified secure freeze | No |
| Coherent final rules/source/runtime, acceptance, images and auction gate all verified | Owner reviews guarded reopen with exact CAS token | Only with separate approval | Optional compatible restore | Only with final legal/runtime gates and approval |
| Reopen smoke fails | Re-enable using fresh CAS, verify pause/freeze, preserve reads/evidence | No | Compatible repair/restore | No until repaired and reapproved |

| Deliberate failure checkpoint | Observed stop/pause/negative-guard verification | Required compatible restore and measured component reserve | Reopen conditions |
| --- | --- | --- | --- |
| After maintenance enable | 2.799s including cold status endpoint | Keep ON/freeze; reconcile coverage and any partial bridge | No current pre-policy legacy reopen path is qualified |
| After simulated draft legal exposure | 0.344s | Existing-host legal restore **unmeasured**; preserve exposure/evidence | Final legal/policy/source gates and separate owner approval |
| After isolated bootstrap | 0.337s | Inspect fixed mirror; preserve evidence; production revocation/recovery **unmeasured** | Exact final coherent source/runtime policy, no unknown outcome |
| After frontend deployment checkpoint | 0.299s | Older staging Worker restore observed 7.9–8.9s; reserve 90s. Actual final/existing-host restore unknown | Current frontend/rules/runtime adoption verified |
| After Function deployment checkpoint | 0.319s | Guarded historical source restore median 11m23s, 29m00s checkpoint; **post-adoption compatible recovery unqualified** | Schema-aware parity plus final guards; do not reopen historical contracts |
| After Firestore rules checkpoint | 0.310s | Compatible guarded rule restore observed 2.98–3.00s; reserve 37s plus active-listener propagation verification | Direct protected denials and public reads verified, full final parity |
| After Storage rules checkpoint | 0.271s | Secure freeze observed 2.756–2.757s; reserve 36s plus transfer settlement verification | Exact permit rules, stopped/expired leases, settled transfers and final parity |

Each stop preserves the synthetic acceptance fixture and ON. Restore component figures come from separate real provider cycles; they are not seven measured complete abort totals.

Do not delete or repair `releasePolicies/current` automatically. A production policy revocation/recovery procedure and any safe pre-policy legacy reopen are separate unqualified paths. Current production reopen deliberately refuses false/null legal source. Staging control OFF measurements do not qualify that bypass.

## Monitoring and stop conditions

No normal production customer-data/error baseline was collected. Do not invent percentage/latency spike thresholds. Use the following qualitative conditions for the bounded synthetic verification, keeping expected maintenance refusals separate from errors:

- Any unexpected successful protected write, missing guard, wrong resource/project/bucket/source or unknown mutation outcome: stop immediately, retain/reestablish pause and reconcile.
- Function unexpected 5xx/timeout, unhealthy revision, build failure or repeated verification transport failure: stop the batch. Do not regard 400 malformed-callable probes as business success. A conservative checkpoint overrun is an abort/reconcile condition, not evidence the operation failed or can be blindly retried.
- Newly denied public read, current acceptance/setup failure, malformed/missing policy or auth redirect regression: stop before reopening; preserve immutable evidence.
- Synthetic upload unexpectedly admitted after freeze/expiry, unavailable existing image, or any unresolved in-flight settlement: stop. Expected 403 after freeze is success evidence, not a failure spike.
- Worker unexpected 5xx, wrong source stamp, anonymous rehearsal access, broken legal routes or missing frontend/rule parity: restore compatible components and retain pause.
- Failed/missed/unresolved auction lifecycle, unknown Scheduler application outcome or boundary count, changed auction clocks/winner, or any active/published scheduled auction during the frozen window: stop; never extend clocks automatically.

Aggregate normal/error baselines and owner-approved alert thresholds are required before real activation. Use only nonpersonal counters/status/timing; exclude request payloads, credentials, headers, tokens, customer IDs and private content.

## Totals, evidence and remaining gates

| Window | Best | Expected | Conservative | Qualification |
| --- | ---: | ---: | ---: | --- |
| Serial measured component subtotal | 21m05s | 22m13s | 57m57s | Bridge, preparation, coordinated, two Firestore deploys, two Storage transitions, older Worker deploy, bootstrap, ON/OFF only. Excludes build, propagation/drain, legal hosting, complete verification, recovery/adoption and margins. This is **not** a production activation window. |
| Measured transport-recovery component subtotal | Not a complete abort total | Not a complete abort total | 31m49s | 40 guarded Function restores + Firestore restore + Storage freeze + older Worker restore + ON recognition; excludes legal/policy/schema recovery, propagation, settlement and full verification. |
| Complete production activation window (A) | Unknown | Unknown | Unknown | Required final-host/current-artifact and coordinated verification phases unqualified. |
| Complete compatible abort/recovery window (R) | Unknown | Unknown | Unknown | Legal/policy and schema/history-aware recovery and full readback unqualified. |
| Complete final verification (V) | Unknown | Unknown | Unknown | 35-callable refusal sweep is only one subset. |
| Auction X / Y | Not required | Not required | Not required | Superseded by zero unfinished auctions + verified admission freeze. |


The complete production activation and abort totals remain unknown because the final legal-only artifact on the existing serving host, current final frontend deployment/rollback, final end-to-end paused/positive verification and early-abort legal/policy recovery are not measured/qualified. Cloudflare staging transport timings cannot replace Netlify legal-only timing. Production publication source is false, dates/address/counsel unresolved. No activation flags were changed to force a measurement.

The pure `operationalTimingBudget` retains outliers and refuses single/incomplete/unverified samples. `completeOperationalWindow` and auction helpers refuse unknown phases. Only explicit planning reserves, clearly labelled partial component sums and verified sample durations are provided; no public SLA or universal upper bound is claimed.

Verification passed: **391 app tests, 160 Functions tests, TypeScript, ESLint and diff whitespace checks**. The five new pure planning/precheck test groups retain outliers, reject incomplete samples/unknown phases, and refuse stale, partial, wrong-project or nonzero auction evidence. They never authorize activation. Remote authenticated refusal sweeps, real rule enforcement, Worker health/access, uploads and synthetic lifecycle observations are recorded separately from unit tests.

Cleanup is verified: all 47 private Function aliases, 10 owned rulesets, two isolated releases, the named database, owned bucket, temporary Scheduler and private rehearsal Worker were removed; 92 owned source archive generations were deleted. All 47 known owned Artifact Registry packages are verified absent after Function deletion. Disposable synthetic Auth accounts and their owned default-database fixture documents were removed; the private probe ID token was removed. Provider-managed upload caches, build history and logs were not broadly enumerated/deleted, and shared cleanup/retention policies were not changed. Private receipts/review packages remain outside Git for audit; no credentials or generated output were staged.

Final comparisons passed: the 95 existing staging Functions and default staging rule releases are unchanged; `takeme-web-preview` retains baseline version `685c1094-8ea9-4f8b-a591-1d4755c9167c`. Read-only production comparison confirms all 91 serving Function revisions and both production rule releases unchanged; `releaseControls/current` and `releasePolicies/current` remain absent. Approved legal source/publication settings and main are unchanged. No commit, push, production serving deployment or customer-content access occurred.

Historical timing-task changes only: `functions/src/operational-timing.ts`, `tests/operational-timing.test.mts`, this runbook, and the follow-up reference in `docs/production-activation-rehearsal.md`. The prior qualification changes remain local and uncommitted; unrelated pre-existing main review/probe files were left untouched.

**Historical 5 October assessment:** whole-window timing was incomplete under the previous bounded-horizon criteria. **Current 6 October reassessment:** those timing gaps no longer block runbook preparation. Stop repeated timing rehearsals; use the new runbook and its actual legal/artifact/compatibility/enforcement/monitoring/zero-auction execution gates. Real activation remains unauthorized. Stop for owner review; do not commit, push, activate, deploy serving production or change routing.
