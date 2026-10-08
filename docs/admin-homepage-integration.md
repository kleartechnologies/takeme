# Public homepage integration and performance

The consumer Home remains public-first. Its existing anonymous server feed call asks `getPublicListingPage` to include the compact published homepage in the same response. The projection read starts in parallel with catalogue work. It adds exactly one Firestore document read and no second frontend request, authentication dependency, or admin-collection joins. Other callers omit the option and perform no editorial read.

The response is strictly parsed. Private/internal fields, excessive arrays, invalid relative destinations, unsafe references and foreign media fail closed. Listing/banner images must be from the configured Firebase bucket; public seller avatars may also use the existing Google avatar host. Missing, invalid, inaccessible or invalidated config uses the existing hero/category/public-feed/secondary-module Home. A feed failure retains stable loading/retry affordances.

Published manual/campaign sections render server-side product, seller, category, banner and announcement summaries. Featured auction summaries say Starting bid; live bidding correctness remains on the existing detail route. Campaign CTA and optional collection artwork are supported. Automatic Fresh Drops uses the already-fetched first feed; secondary Near You/Ending Soon/Hot/Under RM20/Saved modules load progressively. Personalized Hot/Saved data is eligibility-gated. Trending Sellers needs explicit manual/campaign selection: no fake automatic ranking or new aggregate backend was invented. Category controls do not delete taxonomy records.

No admin UI, claim logic, authentication provider, session API or private editorial SDK enters consumer bundles. Existing auction/message/offer realtime behavior and protected-action enforcement are unchanged.

## Measurements

Baseline source: `470a2947ed9e8ff5f2ea3c21079d5d83ada3dbb1`. Both consumer builds use the same pinned dependencies, cached authentic Poppins fonts and production-mode configuration, privately compiled with Node network transports blocked. Home route client-reference/root chunk inventory, gzip level 9:

| Build | Raw JavaScript | Gzip JavaScript |
| --- | ---: | ---: |
| Before | 1,236,341 bytes | 378,893 bytes |
| After | 1,237,514 bytes | 379,150 bytes |
| Delta | +1,173 bytes | +257 bytes (0.07%) |

The dedicated admin overview's production-configured referenced JavaScript inventory is 620,417 raw / 186,949 gzip bytes, independent of the consumer. These are referenced route chunks, not a simulated network-transfer or INP benchmark. No production runtime speed improvement is claimed.

A controlled mobile browser comparison used the two isolated production-mode builds at 390×844. External requests were blocked; the anonymous public-feed retry used an identical synthetic product and 40 ms response delay. The offline server-feed fallback was exercised, not live production latency. After discarding the first pair, seven paired samples gave these medians:

| Signal | Before | After |
| --- | ---: | ---: |
| Local document TTFB | 8.5 ms | 9.8 ms |
| First contentful paint | 48 ms | 48 ms |
| Anonymous retry to usable product | 59.5 ms | 58.9 ms |

This shows no material fallback regression under the controlled workload; it does not measure live first-product latency, INP or cloud execution. The published projection is independently qualified through the emulator, including the combined anonymous feed response and default no-editorial-read behavior. Its budget is one additional document read, launched in parallel, in the existing response; no per-section public joins are added.

Both apps pass the OpenNext package build and local Wrangler dry-run. The production-configured admin build has no emulator target; the browser workflow uses only local demo configuration. No build output is committed. The checkout's unrelated ignored generated declarations include duplicate old Next types; consumer TypeScript is qualified through the clean isolated build rather than deleting those files.

## Rollout and follow-ups

Deploy the compatible public feed endpoint extension first, then the consumer frontend; the older strict backend rejects `includeHomepage`. Keep the fallback available while new admin collections are empty. Do not enable publication before invalidation triggers and Storage publication protections are verified.

Future backend performance work, if needed: authenticated Hot/Saved module query efficiency and a trusted public seller-ranking aggregate. Those existing services are bounded and deferred here; no new ranking schema, index, caching service, media processor, payments, deletion or TTL feature was added. Public schedule filtering uses server time without a new polling scheduler.
