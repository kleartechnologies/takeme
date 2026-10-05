# Marketplace action cadence and upload permits

These are server-enforced short-window abuse controls, not listing-count or Storage-capacity quotas. They apply to authenticated accounts after the existing lifecycle and current Terms/Privacy/18+ checks. Invalid ownership, stale bids, invalid increments, invalid offers and unavailable listings retain their existing errors and do not consume an accepted-action allowance.

| Action | Rolling allowance per account | Purpose |
| --- | --- | --- |
| New fixed-price or auction draft | 10 / 60 seconds, shared | Prevent automated draft floods while allowing normal manual creation. |
| New logical message | 120 / 60 seconds | Preserve conversational bursts; idempotent retries return before charging. |
| Offer submission, counter or acceptance | 30 / 60 seconds; 8 / 30 seconds for the same listing | Bound negotiation spam. Rejection and withdrawal remain available so recipients can resolve unwanted offers. |
| Accepted auction bid | 180 / 60 seconds | Target automation; preserve valid quick bidding, increment checks and transaction races. |
| New marketplace or public-review report | 20 / 60 seconds | Allow several distinct legitimate reports; duplicate reports return before charging. |
| Photo upload permit starts | 64 objects / 60 seconds | Count each object in a batch, while allowing normal eight-photo listing creation and profile updates. |

`functions/src/action-cadence-policy.ts` holds the fixed reviewed thresholds. `consumeActionCadence` reads and writes quota state in the same Firestore transaction as the accepted action. Callers finish business reads before it and write only afterward. A denied transaction creates no listing, bid, offer, report, receipt or permit. State consists of at most six server-only documents under the user's `private` subtree. Each event array is bounded by its action limit. Only server timestamps and optional SHA-256 resource digests are stored; raw request bodies and raw idempotency keys are not stored in these documents.

Expired events are pruned on the next successful use. `expiresAt` describes the validity window; no new TTL policy or scheduler is activated. Inactive expired documents may remain until reuse or account cleanup, but their size cannot grow. User deletion recursively removes this subtree. Corrupt/future state fails closed. Denials expose only `resource-exhausted`, the safe message “Too many attempts. Please try again shortly.” and bounded `retryAfterMs`/reason metadata. Private counters, IDs and tokens are not logged or returned.

## Direct Storage uploads

The authenticated `requestUploadPermits` callable accepts at most eight exact requests containing path, content type and byte size. It independently validates owner paths, MIME/size limits and the existing editable-listing state. The guarded transaction issues opaque, two-minute permits in the existing server-only `users/{uid}/private/onboarding` acceptance document. The map retains at most 128 unexpired permits, pruning expired entries on the next grant; this bounds transient state while accommodating the full cadence window. It is not a stored-product or stored-object quota.

Storage Rules require the matching permit ID in `customMetadata.takemeUploadPermit`, exact path, exact declared type/size, current acceptance and unexpired server time. Another account, another path, mismatched bytes/type, expired permits and arbitrary direct uploads are denied. Reusing the same acceptance lookup preserves the existing maximum of two Firestore documents per listing-media rule evaluation. Existing image size/type rules and auction locks remain in force. Client updates to existing Storage objects are denied; listing images and new avatars use unique paths. Existing owner delete authorization remains available for cleanup. The profile flow deletes a previous owned TAKEME avatar after the new profile URL is saved and cleans a new object when verification/profile saving fails.

Rules cannot atomically consume a cross-service permit. Create-only authorization also explicitly requires `resource == null`, preventing overwrite even when an emulator classifies upload overwrite as a create; a permit cannot authorize extra paths. An owner who deletes the exact object can attempt recreating that same path until its short expiry. This limitation must not be represented as atomic single-use authorization. It does not grant arbitrary object growth. App Check and a server-proxied upload pipeline remain separate future hardening decisions, outside this sprint. Firebase's [Storage Rules API reference](https://firebase.google.com/docs/reference/security/storage/) documents checking the absent existing resource to enforce object immutability.

Deletion initiation atomically erases the acceptance document, immediately revoking outstanding permits. Its recursive user cleanup also removes cadence state. No production deletion, policy approval, TTL or deployment is activated by these local changes.

## Qualification and deployment order

Run Functions pure tests with Node 22 (`npm --prefix functions test`) and client tests (`npm test`). The new bounded `tests/action-cadence-emulator.integration.mjs` exercises concurrency at a seeded limit, offers/counters, bids/stale rejection, distinct/duplicate reports, private-state denial, permit path/type/size/expiry/owner failures, replay overwrite, cleanup and deletion-pending guards. It uses only `demo-takeme` and loopback Auth/Firestore/Storage/Functions emulators, disposable in-memory credentials, and small synthetic records. Other positive Storage integrations now obtain real permits through `permitDemoUpload`; negative direct-write tests remain direct attempts.

For a later separately approved release, deploy the reviewed Functions including `requestUploadPermits` before activating the matching Storage rules and website client. Old clients will fail closed at uploads once permit rules are active; the candidate client and rules must be qualified together. Apply no production changes during this sprint. The visual matrix fixture is bounded demo setup, not a cadence test: it resets its own demo seller's listing counter before creating its multi-state matrix. It never changes production limits.
