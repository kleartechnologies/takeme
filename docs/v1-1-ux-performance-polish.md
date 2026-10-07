# TAKEME V1.1 UX and performance qualification

Scope: frontend-only follow-up to Sell V1.1 checkpoint `4a55ab17e208e845bdd4223be272a4fbe05d6256`. No dependencies, backend contracts, rules, legal wording, activation controls or production configuration changed.

## Evidence and changes

- Product Detail formerly waited for a seller's other listings before clearing its primary loading state. The product now renders as soon as its public projection arrives; related inventory updates separately. Existing detail polling and bid validation remain authoritative.
- Profile formerly awaited profile + listing history + private trust together. Identity and shortcuts now render independently, with localized status loading. Account changes scope all private results by UID. Collapsed reviews and recent transactions do not fetch until opened.
- Profile's Saved count formerly hydrated up to 10 public listing details after reading saves. It now makes one bounded count query (`limit(11)`) and preserves the previous `10+` presentation under the existing owner-list rule. No rule change is needed.
- Concurrent identical public-detail, Saved-state and unread-count reads share only their pending request. Settled values/errors are not cached; viewer identities are part of private keys. This avoids overlap without delaying critical auction/message/account freshness.
- Public seller summaries already batch distinct IDs. Their existing five-minute cache is now bounded to 200 entries, overlapping requests coalesce, missing/failed summaries retry after 15 seconds, and completed requests clear their timeout.
- Messaging initially awaited optional listing/deal context before clearing loading. Conversation/message rows now render first, retaining the same listeners, idempotency and offer rules.
- Fixed Product Detail formerly ticked every second; all fixed cards formerly ticked every minute. They now have no clock timer. Auction second ticks are isolated to countdown components; page/card status clocks wake at start, urgency and end, and refresh on visibility. Server freshness and bid checks remain unchanged. No CPU improvement percentage is claimed.
- Saved Items and Auctions filter the same fetched page without rereading on each tab change. Visibility refresh, account isolation, mutation events, pagination and terminal-auction removal remain intact.
- Follow updates optimistically only after eligibility succeeds, blocks duplicate taps, ignores visibility refresh during mutation and restores the previous state on failure. Save already had guarded optimistic behavior; no optimism was added to bids/offers/publication.
- Optional Home Ending Soon/Featured modules mount near the viewport instead of competing with the first useful discovery request.
- Gallery priority is reserved for the first image. Existing responsive image sizes, Worker image loader, aspect ratios and lazy catalogue images are preserved.

## Presentation

My TAKEME Status uses compact branded Buyer/Seller cards, neutral New Buyer/New Seller labels, truthful counts/ratings and progress calculated from the existing server-supplied thresholds. Status remains owner-only. The tiers help control is a 48px icon/text/chevron row. Standalone retry/report/settings/language actions use focusable 44px rows or quiet controls; prose/acceptance links keep underlines. Private Admin interfaces were deliberately left outside this consumer sprint. No new animation/icon/UI dependency was added. Reduced-motion overrides cover existing pulse/spin and image transitions.

## Measurement limits

An isolated React Profiler fixture measured 163 timer-driven commits over 163.448 seconds for the legacy per-second clock, versus zero additional commits for the new fixed-listing and scheduled-auction status clocks after initialization. The countdown still ticks separately; this is not a whole-page CPU measurement.

A bounded pre-change production HTTP sample covered Home, Explore, Product, Auction, Saved, Profile, Updates, Messaging, Sell and Login (all HTTP 200). Single-request wall times ranged 960–3324ms and include network/transfer overhead: these are not Core Web Vitals or client navigation timings. Route script bytes were correlated with the retained matching optimized build. Private qualification captures and credentials remain outside Git. Network variability and a small synthetic inventory prevent a defensible production latency/large-catalogue scrolling claim.

## Backend performance follow-up

- Saved/Updates/Inbox hydrate details per distinct listing. Pending deduplication removes overlap, not the distinct-listing fan-out. A reviewed bounded batch public-detail endpoint/projection would require a separate backend task.
- Profile still retrieves bounded transaction/listing history for shortcut counts; a server-owned aggregate projection would require separate schema/Function qualification.
- The current image loader can resize through the existing Worker binding, but source media have no guaranteed small derivatives. Audit actual uploaded source dimensions and build the separately planned media pipeline; do not introduce HEIC conversion here.
- Shared Firebase/auth client code remains the largest initial JS cost. A separate measured route/chunk experiment should address that boundary while preserving one trusted auth state and protected-write verification.
- Auth/policy state is already centralized in AuthProvider. Per-action server verification and lifecycle listeners remain mandatory, not a cache optimization target.

## Qualification

Optimized route-script comparison (same method, no dependency changes): Home +1,378 gzip bytes; Explore +1,203; Product/Auction +1,404; Saved +1,302; Profile +1,251; Updates +876; Messages +848; Sell +1,405; Login +713. This is a small increase (less than 0.4% per measured route), not a bundle reduction. Product comparison excludes the same unmatched streamed script on both sides; it is not a complete product transfer budget.

App suite: 488 passed, 2 existing emulator-only skips; Functions: 169 passed. TypeScript, ESLint, optimized Cloudflare build/check pass. Build made zero outbound application calls. All 55 screen/viewport combinations passed at 390×844, 430×932, 768×1024, 1024×768 and 1440×900 with exact viewport readback: no horizontal overflow, observed broken images, composer overlap or hydration errors. Private preview uses the same optimized source and real synthetic account; its build-only network guard is removed from the preview process, never from the build. Explore keyboard navigation preserved search, sort and scroll (80.5px before/after). A delayed-failure Follow fixture confirmed immediate state, rollback and zero additional calls when eligibility is denied.

No customer writes, bids or offers are needed for this sprint. Reversible Save/Follow checks use only the existing synthetic listing/accounts.

Deployment gate: all tests, TypeScript, ESLint, artifact/credential checks, clean scoped commit and a fresh verified Worker rollback reference. Deploy only `takeme-web`, retaining production variables, logging/redaction and routing. If a critical frontend regression occurs, restore the previous Worker version only.
