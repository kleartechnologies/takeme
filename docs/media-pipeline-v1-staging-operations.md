# Media V1 staging operations and production boundary

Project: `takeme-staging-822a5`; region: `asia-southeast1`. Media bucket: `takeme-staging-822a5-media-v1`; default app identity remains `takeme-staging-822a5.firebasestorage.app`. The central `listingMediaBucket()` mapping is authoritative. Do not replace the app/default bucket globally. Legacy uploads and Admin PNG editorial assets remain on their existing contract.

## Applied limits and identities

Cloud Run `takeme-media-v1`: immutable digest `sha256:5c1cb3cf2a54f9fa83aa6385d3cf60f51d1a1dd1cbf81b95761f2437dea3201b`; revision `takeme-media-v1-00004-gx8`; 2 CPU / 2 GiB; concurrency 1; min 0, max 2; 90-second request timeout. Processor uses `media-v1-processor`. No anonymous invoker.

New API endpoints beginListingMedia/getListingMedia use `media-v1-api`; uploadListingMediaSource uses `media-v1-broker`. Begin's staging max instances is 4, concurrency 1 after the evidenced two-user burst; get/source remain max 2. Existing read-only getProtectedWriteStatus is also present with media API identity and exact staging pins. It was missing from the older staging baseline; failure must continue to deny writes. Nothing bypasses this precheck.

All five identities are dedicated staging service accounts: processor, broker, API, events, cleanup. Custom object roles omit list/update and are conditioned on exact private raw/final path prefixes in the isolated bucket. Firestore metadata IAM is database-wide because collection scope is not supported by IAM; application ownership/permit/eligibility/maintenance guards remain required. This residual is not misrepresented as collection-scoped IAM. Processor child environment scrubbing does not isolate the Cloud Run metadata service from native-code compromise.

Eventarc `takeme-media-v1-finalize`: exact bucket finalize filter and authenticated processor target, `media-v1-events` identity. Dedicated bucket uniform access is ON; shared bucket uniform access remains OFF and its ACLs, CORS and Storage release are preserved. Public access prevention is ON. Firebase Storage rules authorize tokenless published derivatives, not anonymous GCS IAM. Browser CORS is exact preview origin, GET/HEAD only; source POST goes through the authenticated, permit-bound broker's exact-origin CORS.

Dead-letter topic/review subscription: `takeme-media-v1-dead-letter` / `takeme-media-v1-dead-letter-review`. Managed Eventarc transport subscription has approximate max attempts 5 and retry 10–120 seconds. Pub/Sub agent gets publisher only on the dead-letter topic, subscriber only on the transport subscription. Investigate metadata-only poison receipts; do not expose raw media, tokens or customer payloads.

Scheduler `takeme-media-v1-cleanup`: UTC `0 3 * * *`, HTTP POST `{}` to processor `/cleanup`, OIDC `media-v1-cleanup`, audience exact processor origin, 90-second deadline, bounded retry 3. It is staging only. Sweep is capped at 100 operations and four exact object names per operation; no TTL or bucket-wide object listing. Linked live images and live leases are retained. Soft-delete recovery is seven days, so successful raw deletion is not a promise of immediate physical erasure.

## Required runtime readback

Use authenticated control-plane commands pinned with `--project takeme-staging-822a5` and `--region asia-southeast1`. Read service image, invoker IAM, max/concurrency, Eventarc filter/destination, scheduler identity/audience, bucket uniform/PAP/CORS, rules releases, and endpoint runtime variables. Required pins: GCLOUD_PROJECT and TAKEME_FIREBASE_PROJECT_ID staging; TAKEME_RELEASE_TARGET staging; TAKEME_STORAGE_BUCKETS default app bucket; TAKEME_MEDIA_BUCKET isolated media bucket; TAKEME_MEDIA_PIPELINE v1. Deletion and payments OFF. Preserve unrelated values and service accounts when updating existing endpoints. Never paste tokens/credentials into receipts or Git.

Staging Firestore release adds only owner get / denied client writes for mediaOperations over the captured prior rules. Isolated Storage release contains only media-path reads and denied client writes. Shared release stays unchanged. Capture rollback references before any update. Existing affected publication/projection endpoints are publish/update fixed and auction, public detail/page/recommendations, and own listing history. Other Admin endpoints are not redeployed.

## Production plan remains blocked

No production resource is deployed or modified here. Commercial HEVC obligations require owner/legal disposition. Finish physical-device qualification (desktop eight-photo publish/edit/withdraw and private-draft resume now pass) and review the retained bad-seek fixture's compatibility limits. Verify production bucket uniform-access compatibility before granting conditional object roles; the owner-approved *staging* separate-bucket decision does not authorize a production bucket change or blanket uniform-access migration.

Then capture production baseline and rollout only reviewed image/digest, scoped IAM, private raw/read rules, trigger and dead-letter transport, exact new/affected endpoints, existing status dependency, Sell media flag and consumer variants. Smoke with approved synthetic production records before broader admission. Keep existing app authDomain, legal policy, Admin assets, payments, deletion, TTL, DNS, Netlify and unrelated Functions untouched.

Rollback first disables media admissions, preserving READY derivative reads/records and legacy readers. Preserve seller drafts. Let already-issued uploads settle; then pause trigger/processor if required. Do not blindly restore rules/frontend that cannot read already-published derivative paths. Retain private evidence and exact prior releases; no automatic migration of historical listings.

## Final browser checkpoint

Consumer staging Worker version `3517c8cc-2fd9-426b-b4d4-2457113274ec`, runtime source `2fa380dc6293a1f780e2c22ae11bba5f029aa38b`. The staging wrapper CSP permits only the original app bucket and the exact isolated media bucket for browser-direct images. Cloudflare Access and its two-tester identity guard are preserved. Existing private READY draft previews use bounded authenticated SDK reads and local blob URLs, while publication/edit submits the original canonical references. Anonymous draft media remains denied. No production deployment occurred.
