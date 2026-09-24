# Phase 14B verification closure — local, 24 September 2026

This record uses Firebase **demo projects only**. No production data was created, migrated or deployed. No GitHub push, Stripe setup or real-money action occurred.

## Engagement emulator diagnosis

The Firebase CLI 15.25.1 attempted Functions discovery from the synced repository using global Node 26.8.1 but timed out at its default 10-second discovery limit. Repeating under the project's Node 22.23.2 with `FUNCTIONS_DISCOVERY_TIMEOUT=120` still timed out after 120 seconds, before test assertions began. An isolated temporary copy of the same checked-in Functions source and test, with `npm ci --offline --ignore-scripts` for root and Functions dependencies and Node 22, passed: `firebase emulators:exec --project demo-takeme-engagement --config .firebase-engagement-test.json --only auth,firestore,functions 'node tests/engagement-emulator.integration.mjs'` exited **0**. This distinguishes local synced-checkout/dependency startup from application behavior. The exact low-level filesystem stall was not proven. The default README command was also corrected to match the test's dedicated demo project ID.

## Responsive browser QA

The local app used `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, the default demo Auth/Firestore/Storage/Functions emulators, and disposable demo users, listings, a conversation, a transaction and a report. No production data was used. Browser layout was checked at **320, 375, 390, 430, 768, 1024, 1280 and 1440 CSS px**, height 800px. For each loaded surface below, `document.documentElement.scrollWidth` equaled the viewport width; primary controls were not clipped, and mobile navigation was visible where the product includes it. The promotional/category carousels and admin section navigation intentionally scroll within their own containers, without document overflow. Visual screenshots were inspected at 320px; this is browser QA, not a substitute for real-device/cross-browser testing.

| Surface | Populated/interactive state checked | Result |
| --- | --- | --- |
| Home, Explore | Live demo listings, cards, category carousel, promo, search | No page overflow; inventory visible early on mobile. Empty search showed a distinct no-match message and Clear filters. 320px filter sheet fit the viewport. |
| Listing detail, seller profile | Real demo listing, seller-only trust, images, report entry | No page overflow or stretched visible images; trust and action hierarchy remained legible. |
| Saved, Updates | Saved listing, unread notices, loading skeleton and loaded list | No page overflow or clipped primary actions; bottom navigation remained usable. |
| Messages inbox, conversation | Populated thread, listing/transaction context, composer, report form | No page overflow; report form fit at 320px. |
| Sell, existing-listing edit | Form, preview, two existing images, reorder/cover/remove controls | No page overflow. Found and fixed narrow reorder targets: at 320px the two-column photo grid gives each arrow **55×44px**; other tested widths were at least 44px tall. |
| Profile, My Listings | Populated own listing, role tabs, management actions | No page overflow. Removal dialog fit all eight widths; Escape closed it and restored focus to the initiating button. |
| Transaction detail | In-progress demo agreement and Open Conversation | No page overflow or clipped primary controls. |
| Admin reports, report detail/triage | Claim-authorized admin, populated report, context and triage fields | No page overflow; internal admin navigation scrolls horizontally on narrow screens and triage fields fit. |

The browser checks exercised populated, empty and some loading states. They did **not** force every network-error branch or run on physical devices. Production device, browser and accessibility review remains separate.

One additional offline check stopped the demo Firestore emulator while Explore was open. The Firestore client logged `unavailable` and entered offline mode, while Explore rendered “No active listings yet” rather than a connection-error state. The query may have resolved from an empty local cache; the exact SDK path was not established. This is a remaining error-state ambiguity to resolve before calling discovery fully verified, not evidence that the production marketplace has no inventory.

## Regression and security results

- App tests: **23/23 passed** (Node 22, isolated source copy after required docs were copied).
- Functions tests: **40/40 passed**, including Functions TypeScript build.
- TypeScript: `npx tsc --noEmit --incremental false` **passed**.
- ESLint: `npm run lint` **passed**.
- Optimized web build: `npm run build` **passed**, 32 static pages generated.
- Emulator suites: engagement **passed** (exit 0); public-seller **passed**; trust **passed**; admin **passed**; transactions **passed**; auction **passed**. Expected `PERMISSION_DENIED` log lines in security suites are assertions of rejected client writes, not failed suites.
- Security boundaries covered by these suites: public seller projection omits buyer reputation; direct full-summary reads denied; conversations/messages participant-only through callables with direct writes denied and server sender IDs; report writes/status/notes server-controlled; admin triage claim-gated; transaction/reputation/auction authority not writable through client rules.

## Production decisions still outside this closure

The deterministic, idempotent legacy auction derived-price reconciliation is [documented](auction-discovery-semantics.md), **not executed**. Message retention, deletion/export, account closure and moderation disclosure require privacy/legal/product decisions; see [messaging](messaging.md). A separately approved production rollout must coordinate Functions, rules and indexes, verify operational controls and run real-device accessibility QA. This verification did not deploy anything.
