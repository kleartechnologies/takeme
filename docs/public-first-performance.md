# Public marketplace before account boot

Local P0 qualification against production baseline `45544ecd725621138025149b675910bfc6b4714c`. No production deployment, backend change, dependency change or Media Pipeline integration is included. The parked Media Pipeline branch remains `feature/media-pipeline-v1` at `f29c1d1bd0d3c455c992763852f27c1c60d4081b`.

## Architecture

Previously, signed-in Home waited for Auth, account setup and personalized recommendations. Account checking replaced the public subtree, discarding its work. Product restarted its primary subscription when the viewer changed.

Home now streams a bounded, anonymous public catalogue through Suspense. Auth/account setup run concurrently. Fresh Finds stays mounted and unchanged; recommendations attach as a separate final secondary section after verified account readiness. Failure, sign-out or a stale response cannot replace the public first row. Existing secondary sections remain progressive.

An exact public route allowlist preserves Home, Explore, catalogue/category discovery, public Product/Auction and seller storefront rendering during account boot or transient lookup failure. Unknown/private routes retain their account gate. Own Profile, Saved, Messages, Settings and Sell have no public exemption. The existing provider keeps UID-bound state through ordinary client navigation; it is not replaced with persistent client authorization.

Product metadata and body share one request-scoped public snapshot. The client reuses it instead of immediately fetching the same detail again. The existing 10-second refresh and explicit authoritative post-bid refresh remain. Only account-sensitive action panels reset on viewer changes; gallery/title/public content retain identity. Missing public data can reach the existing private owner read only after verified account readiness, and private draft/removed content is masked on account changes.

Public catalogue and seller-summary reads use the existing anonymous HTTP Function contracts without waiting for Firebase Auth SDK token resolution. Private reads and writes still use the authenticated SDK. The server reader forwards no browser cookies, ID token or authorization headers, follows no redirects, validates the existing environment/release proof, and uses no shared personalized cache. Public DTOs explicitly select fields, reject private listing states, and omit addresses, policy/account records, Saved state and bidder/winner identities. The new retry endpoint serves only the fixed public Home query.

Streaming public controls initially use the same pending Auth snapshot as their server HTML, then attach the client identity. This prevents hydration mismatch when Auth resolves before a streamed boundary hydrates.

## Security qualification

| State | Public surface | Protected/private behavior |
| --- | --- | --- |
| Signed out | Public catalogue and listing/storefront browsing allowed | Existing login and explicit return intent retained |
| Auth/account unknown | Public content retained | Save/Follow pending; private Profile/Sell withheld; no automatic action |
| Account ready | Public content retained | Existing maintenance, fresh eligibility, ownership and UID checks required |
| Policy unavailable/required | Public content retained | Protected action routes to acceptance; no consent inferred from browsing |
| Profile/welcome required | Public browsing allowed | Sell routes to the corresponding onboarding stage with return intent |
| Account lookup failure | Public feed remains available | Private route reconnect state and guarded actions remain fail-closed |
| Deletion pending | Existing lifecycle redirect remains authoritative | Only existing resolution surfaces are exempt |
| Removed/private/ineligible | Public DTO rejects private states | Existing backend lifecycle/eligibility enforcement unchanged |
| Account switches | Public shell retained | Private response/state remains UID-bound; sensitive panels reset |

Browser checks used an existing synthetic account and intercepted only qualification account-status responses. Protected mutations were blocked by the test driver. Thirty-eight security/responsive cases observed zero protected writes and zero page/hydration errors. Delaying Auth lookup and account setup by three seconds each left the same Home/Product DOM node connected. Private boot, failed lookup, policy/profile/welcome/deletion redirects, explicit Save acceptance intent, Explore and public seller rendering were checked. Protected action success/failure contracts were covered by the app and Functions suites; this task did not repeat production marketplace writes.

Responsive checks covered 390×844, 430×932, 768×1024, 1024×768 and 1440×900 on Home, Explore, Product, Sell and Profile. No horizontal overflow or hydration errors were observed.

## Paired performance results

Production webpack builds of baseline and final candidate ran on identical local Next servers, with real existing public Firebase endpoints and the approved synthetic account. Three runs per case; figures below are medians. Chrome 154 was isolated with extensions and service workers disabled. Mobile used a mobile user agent, 390×844, CPU slowdown 4×, 150 ms latency, 1.6 Mbps download and 750 kbps upload. Cold means cleared HTTP browser cache with the Auth session retained. These are production-like local comparisons, **not newly deployed Cloudflare performance measurements**.

| First useful content | Baseline ms | Candidate ms |
| --- | ---: | ---: |
| Desktop Home, signed out, warm | 152.0 | 302.5 |
| Desktop Home, signed in, warm | 1807.9 | 321.7 |
| Desktop Home, signed in, cold | 2279.4 | 332.6 |
| Mobile 4G Home, signed out, warm | 737.3 | 433.6 |
| Mobile 4G Home, signed in, warm | 2248.7 | 533.6 |
| Mobile 4G Home, signed in, cold | 5424.1 | 965.9 |
| Desktop Product title / CTA shell | 1050.0 | 300.6 |
| Mobile 4G Product title / CTA shell | 1502.4 | 495.3 |

The Product metric measures a visible action shell, not authorization to complete a protected action. Eligibility still must resolve. Signed-in desktop Home improved approximately 82%; cold signed-in mobile Home approximately 82%. Warm signed-out desktop incurred approximately 151 ms additional latency from server feed streaming/dispatch. No claim of universal route improvement is made.

Representative final desktop Home: server public feed starts at 2 ms and completes at 67 ms; first product appears at 321 ms; account request completes at 660 ms; recommendations complete at 1682 ms. Cold mobile first product appears at 966 ms, before Auth/account boot finishes. A separate early client public-page request belongs to the Ending Soon secondary module; it does not replace Fresh Finds.

Representative final Product: one server detail request serves metadata and body, completing at 56 ms; title/action shell appears at 301 ms; account completes at 671 ms. No initial client primary-detail request occurs in the observation window. Baseline account transitions caused two client detail reads in addition to metadata. The periodic freshness read is intentionally retained. Unrelated prefetched listing reads are not counted as duplicate primary reads.

Delayed-account tests confirm removal of account-driven subtree teardown. Ordinary streaming/hydration boundary mounts can still occur; this is not a claim that every DOM detachment or React commit has disappeared. Per-component production React durations and an exact hydration completion time were not independently measurable, so no such improvement is claimed.

## Bundle and asset impact

No new dependency, global prefetch change or broad Firebase rewrite. Complete client-reference route graphs plus shared runtime chunks, compressed independently:

| Route | Baseline raw / gzip bytes | Candidate raw / gzip bytes |
| --- | ---: | ---: |
| Home | 1229285 / 376825 | 1236302 / 379649 |
| Explore | 1247815 / 383044 | 1254833 / 385872 |
| Product | 1301969 / 398945 | 1309414 / 401948 |
| Profile | 1268781 / 389612 | 1275802 / 392436 |
| Messaging | 1253713 / 386620 | 1260734 / 389449 |
| Sell | 1373545 / 423251 | 1380747 / 426120 |

Home increases 7017 raw / 2824 gzip bytes, below 1%. Firebase remains material in shared client JavaScript but no longer determines primary public Home content timing. Storage is not imported by the new public reader. Partial initial HTML script lists are not used to claim a bundle reduction.

The existing branded browser PNG is now 48×48, 3875 bytes instead of 318239 bytes. Apple/PWA branding assets are unchanged.

## Qualification and boundaries

- App phase suites: 506 passed, two existing skips (508 total).
- Functions: 169/169 passed; runtime source untouched.
- TypeScript, ESLint and diff review passed.
- Cloudflare production build/check passed: 1885 files validated; no deployment performed.
- Credential scan passed. Temporary traces, logs, profiles, screenshots and build outputs remain outside Git.

Strict TypeScript and Functions/build qualification used clean temporary source copies with the same installed dependencies. The workspace has unrelated duplicate ignored type directories and generated Next type files; temporary explicit type lists exclude those duplicates. No repository compiler settings or dependencies were changed. Cloudflare qualification used an APFS clone of installed dependencies to keep native dependency resolution inside the temporary checkout.

Backend follow-up: recommendation execution remains sequential and should be assessed independently now that it is secondary. Shared Firebase code size, route prefetch competition and bounded public server caching may warrant separate measurement. Media variants/HEIC stay on the parked feature branch; no media pipeline, schema, index, Function or rule change is included here.

The measured P0 fix is suitable for owner deployment review. Production Worker latency and post-deployment regressions still require a bounded smoke after separately authorized deployment. No push or deployment is authorized by this checkpoint.
