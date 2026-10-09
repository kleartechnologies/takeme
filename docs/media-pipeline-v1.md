> **Resumed qualification (2026-10-08):** see [current qualification](media-pipeline-v1-resume-qualification.md), [container disposition](media-pipeline-container-security.md) and [licensing review](media-pipeline-v1-licensing.md). The original measurements and scan below are retained as historical parked-checkpoint evidence; they do not describe the newly rebuilt candidate. Production deployment remains blocked.

# TAKEME Media Pipeline V1 — local implementation and deployment review

Status: original parked local implementation; staging-only resumed deployment is recorded in the current qualification document. No production deployment or push. Production remains unchanged. Both pipeline flags default OFF. This document is a preparation plan, not production deployment authorization.

## Architecture

Firebase remains canonical. Sell keeps Photos → Category → Details → Review. New photos receive stable image IDs before a listing exists. An authenticated, exact-permit HTTP broker stores a tokenless private raw object. An IAM-authenticated Cloud Run service receives Eventarc Storage-finalized events, decodes in a disposable bounded subprocess, creates three immutable WebP derivatives, commits READY metadata, then deletes the raw input. Listing publication/edit attaches only complete owner-bound READY operations, in the same transaction and in caller order.

Raw: `users/{uid}/listing-media-staging/{imageId}/source`.
Final: `users/{uid}/listing-media/{imageId}/v1-{sourceSha256}/{thumbnail|card|detail}.webp`.

A listing ID is intentionally absent from the pre-listing upload path. This allows processing in the Photos stage; the server later binds the operation to exactly one listing. Public listing URLs never point to raw originals.

**Privacy finding:** direct Firebase SDK raw uploads minted Firebase download tokens. An anonymous emulator request using that token read the raw object even with read-deny rules. The implementation therefore denies ALL client access to the raw namespace. `uploadListingMediaSource` verifies a revoked-checked Firebase ID token and the exact server-issued permit before using Admin GCS create-only storage. It does not mint a Firebase download token. The browser uses authenticated Storage SDK reads for private READY thumbnail previews. Raw upload uses the broker; ordinary legacy uploads continue using their existing SDK flow.

## Inputs and normalization

JPEG/JPG, PNG, WebP, HEIC/HEIF and AVIF are identified by bytes, not filenames. The decoder must actually decode pixels. Reject non-images, corrupt/unsupported input, animated/sequenced containers, zero bytes, size above 30 MiB, long edge above 16,384, or more than 50 million pixels. Retain libheif's default security limits. No browser HEIC decoder is added.

Apply orientation, convert to sRGB, fit proportionally without upscaling, and produce WebP quality 82 / effort 4:

| Variant | Maximum long edge | Use |
|---|---:|---|
| thumbnail | 400 px | private Sell previews, small Profile/Updates/Messages surfaces, gallery thumbnails |
| card | 800 px | Home, Explore and Saved grid cards |
| detail | 1600 px | selected Product gallery image |

Outputs contain no inherited EXIF, GPS, XMP, IPTC, ICC or orientation metadata. The output colour space is sRGB. JPEG fallback is not currently necessary for supported marketplace browsers. Transparency is retained. Gallery detail loads only the selected image; cover is prioritized, other detail images wait for selection. Existing Next image sizes/lazy loading/aspect reservations remain.

Paths are immutable/content-addressed, but origin responses deliberately use `private,no-store`: READY derivatives may still be private draft images. A shared public cache must not bypass draft authorization. Publication-aware long-lived origin caching remains unqualified; byte savings come from the variants, not a claimed cache improvement.

## State and metadata

Server-owned `mediaOperations/{imageId}` holds UID, input hash/size/type, exact raw path, permit reference/expiry, UPLOADING/PROCESSING/READY/FAILED, attempts, generation, lease and timestamps. Owners can GET their own operation; clients cannot list/create/update/delete it.

READY projection: imageId/status/width/height/mime/thumbnailPath/cardPath/detailPath. Listing mediaImages has at most eight projections, each with coverOrder; mediaImageIds supports exact public Storage authorization. No permanent signed URL/token or EXIF is stored. The public listing projection explicitly whitelists READY data.

The browser preserves selection order independently of completion order. Original previews are immediate where supported. Processing continues while entering Category/Details. Review/publication waits for every retained photo. Failed photos can be removed/replaced without restarting successes. Retry of the same File reuses its operation ID. Concurrent queued source bytes are capped at 60 MiB to bound browser memory; users can add further photos after preparation completes. Browser file recovery limitations remain: a reload may require reselecting unavailable files; the flow never silently publishes or automatically executes an interrupted action.

## Security and lifecycle

- Existing policy eligibility, account lifecycle, revoked Auth checks and protected-write maintenance remain authoritative. Processor rechecks both policy and maintenance at claim AND metadata commit.
- Raw permits match UID, image ID/path, MIME, exact byte count and expiry. Bucket/project/target are trusted runtime pins, never client-selected.
- Existing upload cadence stays active. Additional server-owned codec allowance: 32 admitted uploads per account per rolling hour. Corrupt quota state fails closed. Retry of an existing active permit does not consume a second allowance.
- Raw and derivatives use generation-match-zero creation. Duplicate events cannot overwrite outputs. Existing immutable outputs must have the same content hash before reuse.
- Processing: three attempts, 120-second lease, 20-second Sharp-operation timeout, 45-second child hard kill. Child gets no inherited Firebase/project credential environment. This is resource containment, **not a complete native-code security sandbox**; IAM and Cloud Run isolation remain critical.
- Recommended service: 2 GiB / 2 CPU, concurrency 1, min instances 0, max instances 2, request timeout 90 seconds. Service MUST require IAM authenticated invocation. No allUsers run.invoker grant.
- Raw originals are deleted only after READY commit. Decode failure marks FAILED and removes raw. Infrastructure download/write/commit failure retains raw for bounded retry.
- Daily IAM-authenticated `/cleanup` sweeps at most 100 operations older than 24 hours, with a pagination cursor. It claims candidates transactionally and checks their linked listing before deletion. It removes only four exact server-owned object names; no bucket-wide deletion.
- Retained draft/live listing images stay. Removed/replaced images and withdrawn/deleted-listing media become eligible for bounded cleanup. A cleanup claim blocks publication/processing races. Account deletion execution remains OFF; future removal of listing documents makes their new media eligible for this same sweep. No statutory evidence, private report/evidence path or acceptance history is touched.
- No TTL is enabled. Historical uploads/listings are not migrated/deleted.

## Decoder and licence review (2026-10-08)

Pinned source archives and SHA-256 are in media-processor/native-sources.json. Docker base images are digest pinned; deploy the final container by its image digest, never a floating tag. Debian runtime package resolution still depends on the repository snapshot and must be captured by the final image/SBOM.

| Component | Pin | Licence / deployment handling |
|---|---|---|
| Sharp | 0.35.5 | Apache-2.0; backend only |
| libvips | 8.18.7 | LGPL-2.1-or-later; dynamic library; notice retained |
| libheif | 1.23.6 | LGPL-3.0-or-later; dynamic library; notice/source hashes retained |
| libde265 | 1.1.3 | LGPL-3.0-or-later; dynamic HEVC decoder; notice/source hashes retained |
| dav1d | Debian runtime package | AV1 decode; inspect actual SBOM/notice |

No x265 encoder, browser codec distribution or Cloudflare Images migration. HEVC patent/licensing questions are separate from open-source copyright obligations; final commercial applicability requires owner/legal review. Preserve notices, source access and relinking obligations if this container is redistributed. Do not claim legal clearance.

Primary technical references: [Sharp install](https://sharp.pixelplumbing.com/install/), [Sharp output](https://sharp.pixelplumbing.com/api-output/), [libheif 1.23.6 security release](https://github.com/strukturag/libheif/releases/tag/v1.23.6), [libde265 advisories](https://github.com/strukturag/libde265/security), [libvips advisories](https://github.com/libvips/libvips/security), [Sharp advisories](https://github.com/lovell/sharp/security).

Public advisory review covered 74 libheif, 13 libde265, 12 libvips and 5 Sharp advisories. Versioned fixes are incorporated by the pins. Three imprecise libheif advisory records require reachability interpretation: inline-mask region API (not called by this loader), non-pict item-enumeration API (not explicitly called by TAKEME), and TIFF heif-enc input loader (examples OFF; TIFF rejected). Do not equate an empty npm audit with a complete native/OS review.

The runtime image now contains production dependencies only; package managers/build tools were removed and available Debian updates applied. Final image ID: `sha256:ea7568032322554e0ed318a43dece8f73f34a576b7a7cb17e8c0551902a7426f` (local image identity, not an uploaded Artifact Registry manifest digest). npm production audit: zero findings. Final Trivy report: no Node-package findings; OS reports 2 critical and 54 high findings, with no available high/critical fixes in that Debian package report. Counts are scanner classifications, not a claim that every report is reachable through a photo.

Initial disposition: [Debian CVE-2023-45853](https://security-tracker.debian.org/tracker/CVE-2023-45853) states the vulnerable contrib/minizip code is not built into the bookworm zlib binary. [CVE-2026-58016](https://security-tracker.debian.org/tracker/CVE-2026-58016) concerns D-Bus introspection XML, and [CVE-2026-58010](https://security-tracker.debian.org/tracker/CVE-2026-58010) concerns GVariant deserialization; TAKEME does not submit photo input to those APIs. Other reported high findings include privileged mount helpers, archive utilities, terminal parsing and GLib functions. This initial API/privilege triage does **not** replace a complete native dependency call-graph/security disposition. Keep the full report privately; do not suppress findings to get a green result.

**Remaining security gate:** complete reachable-native/OS findings disposition and review service-identity exposure. Clearing the child's environment does not prevent native code from reaching a Cloud Run metadata identity; this implementation must not be described as a credential-isolated sandbox. Cloud staging deployment has not been attempted while this gate is unresolved.

## Local qualification and fixture evidence

All fixture bytes, rendered comparisons, profiling results, container scans and logs are outside Git in the private media qualification directory. Public fixture corpus source: [Ente HEIC fixtures](https://github.com/ente/test-fixtures/tree/e2b65015d855aaee98e3d66be74dfcd681c38c05/media/heic/v1); downloaded files were checked against its manifest. They are test-only, kept outside Git and production. The resumed qualification used selected fixtures temporarily in protected staging listings; see the resumed report for withdrawal/retention evidence. Small HEIF fixtures came from the pinned libheif test corpus. A public Android HEIC sample was also decoded; it is not mislabelled as iPhone evidence.

Successful Linux amd64 container cases: ordinary JPEG/12MP JPEG/rotated GPS JPEG, PNG/transparency, WebP, AVIF, iPhone 17 Pro HEIC (IMG_0983), 4.90 MB ~14MP HEIC, small transparent HEIF. Every successful case produces all three variants, within limits, with stripped metadata. Corrupt JPEG/HEIC, fake extension payloads, zero bytes, oversized declarations and unsupported containers reject.

Known compatibility limitation: IMG_8606_rotate_90_cw_contains_text.HEIC in that corpus does not decode with this build (the upstream fixture manifest also records decoder incompatibility). It is covered as a safe rejection, not counted as a successful HEIC conversion. Do not lower parser security limits to make it pass. A separate >50MP panorama is outside the deliberate resource cap; no claim of panorama support beyond that cap.

Visual review compared the oriented iPhone image with its WebP card. Orientation/colour were consistent; card was slightly softer on enlarged inspection, acceptable for normal card display. This is a bounded fixture review, not an exhaustive product-photo/device colour qualification.

Performance: Linux amd64 under local Rosetta VM, 2 CPU / 2 GiB container; includes subprocess startup and all three encodes, excludes network/Eventarc cold starts. 21 single-photo samples: best 646 ms, median 852 ms, slowest 2,999 ms. Three serial eight-photo mixed batches: best 10,901 ms, median 10,962 ms, slowest 11,282 ms. iPhone input 1,120,965 bytes → thumbnail 27,202 / card 77,888 / detail 189,458 bytes. Large HEIC input 4,900,407 → 25,966 / 80,030 / 206,960 bytes. Synthetic flat-colour fixtures compress unusually well; their sizes are not typical product-photo estimates.

Emulator integration uses demo-takeme only: real Firebase Auth/Functions/Firestore/Storage SDK, raw broker, and actual Linux processor event handling. Covers raw privacy/no download token, identical create retry, direct client write denial, wrong user/path/MIME/size, expired permit, policy mismatch, deletion_pending, maintenance ON/OFF, raw deletion, duplicate event, pending-publication denial, READY publication, ordered metadata and removed-listing public denial. Unit tests cover partial failures, transient infrastructure failures, ordering, variants/fallback and bounded cleanup.

Local browser checks: a PNG and iPhone HEIC processed while Category remained interactive; both became authenticated READY previews. Reordering the HEIC to cover preserved correct order and loaded dimensions. Sell and Product had no horizontal overflow at 390×844, 430×932 and 1440×900, no broken ready/gallery images and no observed hydration errors. A local presentation fixture showed the selected Product DETAIL path, small gallery THUMBNAIL paths and an Explore CARD path; these rendered through the local Next image optimizer. Canonical references can resolve to the Storage emulator only with an explicitly pinned demo project; production/staging remain canonical. These are emulator browser checks, not physical-phone or remote-staging claims. Recovery restores only already-ready preview reads; it never silently creates a new permit or replays an upload after authentication/policy interruption.

Final local checks: app phases 501 cases total (499 pass; two existing emulator skips), Functions 173/173, Linux processor 10/10 with HEIC fixtures, actual-Linux/Firebase emulator integration PASS, TypeScript PASS, ESLint PASS, credential scan of all 44 changed/new source files zero findings, diff check PASS. Cloudflare build/check qualifies the new client path with outbound application traffic blocked; see the final task report for the last build result. No fixtures/logs/screenshots/scans/generated output are tracked changes.

Remote staging Eventarc/IAM/CORS/cloud retry/dead-letter behavior and physical iPhone selection remain unqualified. No cloud media service or trigger was created in this task. Until those and the final container review pass, SAFE TO DEPLOY = NO. The known auxiliary-image HEIC rejection also requires an explicit supported-input compatibility disposition.

## Cost and abuse

Measurements are not production billing estimates. Three encodes, temporary original storage, three immutable writes, operation/eligibility transactions, Auth checks, trigger delivery and eventual cleanup add costs. New final images save catalogue bytes; existing images receive no automatic saving until separately migrated.

Anonymous derivative authorization reads the operation and its attached listing (two backing-document checks). Actual billed reads/cache reuse must be measured in staging. Private origin cache headers mean no long-lived shared-origin-cache savings are claimed. This is a performance/cost qualification item, not a reason to remove draft/public authorization.

Worst practical abuse: many eligible accounts fill the conversion backlog. Per-account 32/hour admission, existing cadence, 30 MiB/50MP limits, three attempts and max-two instances bound local/request resource use. A many-account backlog can still sustain the global service limit and consume storage; maxInstances alone is not a billing cap. Add budget awareness and queue-age monitoring; measure actual Cloud Run/Firestore/Storage usage in staging before selecting production allowances. No exact currency estimate without region/pricing/usage measurements.

## Privacy alignment

Existing Privacy Notice describes image processing/storage and Firebase/Google Cloud providers. Metadata stripping reduces public exposure and does not require an invented new notice claim. Legal text is unchanged. Its current wording does not promise all historic photos have stripped EXIF; this pipeline does not retroactively make that promise true. Do not log photo bytes, metadata values/GPS, tokens, authorization headers or credentials.

## Infrastructure inventory and exact rollout order — execute only after owner approval

1. Capture current frontend/Functions/rules rollback references. Re-run final image scan and all local tests against the final image digest. Pin image digest and source checkpoint in a reviewed deployment receipt outside Git.
2. **Staging first**, project takeme-staging-822a5 only. Create Artifact Registry repository/service identity/Eventarc identity/cleanup scheduler identity dedicated to media. No production resources are targets during qualification.
3. Grant processor identity narrowly scoped Storage get/create/delete on the staging raw/final namespace; no Storage object update/list or private-evidence access. Grant required Firestore get/list/create/update/delete transaction permissions in the correct database via a custom role. Firestore IAM cannot constrain individual collections like client rules: this residual privilege needs explicit review; do not claim collection-scoped IAM. Grant Auth user-read required by disabled-account guard. No project Editor/Owner/Firebase Admin grant.
4. Broker identity needs raw-prefix Storage get/create (generation-precondition checks), Firestore transaction access and Auth token/user lookup. Existing Functions identities/configurations must be inventoried, not silently broadened. Its HTTP transport must allow browser preflight/invocation while application-level Firebase Auth, exact permits and policy guards remain mandatory; that is separate from the processor's private IAM endpoint. Do not grant anonymous invocation to the processor. Eventarc identity needs eventarc.eventReceiver and run.invoker only on the new processor; Storage service agent Pub/Sub publishing is a separate required control-plane grant. Scheduler identity has run.invoker on this service only. Use IAM Conditions/resource prefix where the permission supports it; validate actual staging evaluation before production.
5. Deploy `takeme-media-v1` Cloud Run in asia-southeast1 by qualified image digest, authentication required, 2Gi/2CPU/concurrency1/max2/min0/timeout90s. Required pins: GCLOUD_PROJECT, TAKEME_RELEASE_TARGET=staging, TAKEME_FIREBASE_PROJECT_ID=takeme-staging-822a5, TAKEME_STORAGE_BUCKETS=takeme-staging-822a5.firebasestorage.app, TAKEME_MEDIA_PIPELINE=v1. No emulator vars in cloud. Include existing required runtime safety pins unchanged.
6. Staging bucket metadata currently reports **ASIA1**, a multi-region. Eventarc trigger location must match the bucket, not be blindly set to asia-southeast1. Confirm service destination support and network billing/locality in the staging project. [Cloud Run Storage trigger requirements](https://docs.cloud.google.com/run/docs/triggering/storage-triggers). Future production bucket location must be read at its own precheck; it was not assumed/read in this task.
7. Prepare Storage finalized trigger for the correct bucket with service-account authentication. Retain platform retries. Handler ignores all non-raw paths (including derivative finalize events). Configure a reviewed bounded retry/dead-letter recovery policy; prove poison events do not retry indefinitely. Max-three decode attempts and 24-hour cleanup are application safeguards, not a substitute for transport retry qualification.
8. Deploy only new endpoints beginListingMedia/getListingMedia/uploadListingMediaSource and the four affected listing publication/edit endpoints plus getPublicListingDetail projection support. Capture all existing runtime pins/service-account settings and dry-run exact target selection; do not use blanket Functions deploy. Keep backend pipeline flag OFF until processor+trigger+rules/read permissions qualify.
9. Deploy additive Firestore operation read-only guard and Storage raw/final guards in staging. Existing profile/listing/private-evidence rules stay intact. Verify cross-service rules Firestore lookup role/read mechanism using the actual staging Storage service identity. No policy activation required or performed.
10. Prepare daily cleanup scheduler (IAM POST `/cleanup`, no customer writes), 100-record page cap, 24-hour retention and cursor. Qualify cleanup claims/retained listing preservation/retry after deletion failures before enabling it. No TTL.
11. Deploy staging frontend with NEXT_PUBLIC_TAKEME_MEDIA_PIPELINE=v1, staging Firebase pins and unchanged Access wrapper/allowlist. Qualify real phone file chooser, 8-photo mixed upload, processing continuation, replacement, reordering, publish/edit/withdraw, CORS/Auth, public/private raw/variant reads, worker image cache and legacy listings.
12. Monitor conversion FAILED/deferred count, queue age, pending operations >3min, cleanup failures, Storage/Firestore denial rates and service CPU/memory. Set conservative launch alerts after measured staging baseline; do not log private input or tokens.
13. Only after staging approval, prepare an exact production manifest using takeme-52b80/bucket and confirmed region. Deploy backend infrastructure/additive rules/affected endpoints with flags OFF; qualify a bounded synthetic production flow under the approved controls. Then enable backend v1 and deploy frontend v1. Do not modify DNS, legal policy, unrelated Functions, deletion, payments or TTL. No execution of these steps in this task.

## Rollback and future migration

- Disable new admissions with backend flag OFF and return frontend flag OFF using the retained frontend version. Keep variant display support: published new listings must remain readable.
- Do not remove additive final-media read rules or READY metadata/projection support while published new images exist. A blanket rollback to old rules would break new media.
- Retain READY operations and variants. Pause cleanup if processor integrity is in doubt. Retain unfinished seller drafts; offer replacement/retry instead of discarding them. Raw inputs remain private and bounded; reconcile pending operations before disabling the event consumer permanently.
- No old image deletion or broad backfill. Later migration should be opt-in/bounded per listing, preserve original references until normalized variants are verified and atomically switched, with ownership/policy/lifecycle gates and independent rollback.

## Owner-review gate

The original local preparation was preserved in feature checkpoint f29c1d1bd0d3c455c992763852f27c1c60d4081b. Cloud staging integration, final OS/native reachability review, commercial decoder licensing disposition and phone qualification remain explicit outstanding items. Production is unchanged. No commit, push, production deploy, legal edit, deletion/payment/TTL activation or backfill is part of this checkpoint.

Current decision: MEDIA PIPELINE NOT READY; HEIC/HEIF NOT READY for production qualification (positive Linux cases pass, auxiliary compatibility/staging/device gate outstanding); GPS/EXIF stripping PASS; responsive variants READY locally; backward compatibility PASS; Privacy change NONE; backend changes REQUIRED; SAFE TO DEPLOY NO.
