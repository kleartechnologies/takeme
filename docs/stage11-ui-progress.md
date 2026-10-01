# Stage 11 local UI redesign — in progress

## Implemented milestone

- Mobile Home / Explore / Sell / Saved / Profile navigation; header access to Updates and Messages remains available.
- Home categories followed by Fresh Finds, explicit general-area Near You search, and a bounded active-auction Ending Soon rail.
- Rounded listing cards, green price hierarchy, Explore pills, listing detail typography, photo-upload presentation, and draft filtering.
- Shared action sheet for existing bid and offer callables, with dialog semantics, keyboard focus containment/restoration, scroll locking, and busy-state dismissal protection.
- Messages, Saved and Updates presentation refinements. Existing backend contracts, public projections, image sanitizer, ownership checks and transaction lifecycle remain unchanged.
- Expired open offers now display their expiration correctly; this changes presentation only.

## Validation

Under Node v22.23.2: app tests 53/53, Functions tests 46/46, TypeScript, ESLint, Next production build and `git diff --check` pass.

The Home surface regression test was updated from the former tab structure to the supported V1 discovery rails. It remains a source-level contract test, not an interactive browser test.

## Remaining before Stage 11 completion

- Finish public seller/reputation and transaction/history visual review, saved-search/state refinements, and explicit highest/outbid/ended visual-state QA.
- Exercise authenticated Sell/draft resume, Saved, messages, offers and bidding using isolated local emulator fixtures.
- Verify action-sheet focus cycling, Escape, focus restoration, busy behavior, errors and single submission interactively.
- Complete visual/accessibility checks at 320, 375, 390, 430, 768, 1024, 1280 and 1440px; confirm image loading, long titles, overflow, touch targets and keyboard navigation.
- Run relevant emulator regression suites and final performance/SEO checks. Existing successful build is not a substitute for these checks.

Browser continuation was blocked by the browser tool's URL policy on the existing tab. No alternate browser surface or policy bypass was attempted. Local preview server is available at `http://localhost:3000/`.

## Safety

No production reads or writes, deployment, Git push, rules/IAM/backend changes, payment activation or new V2 functionality. Pre-existing Stage 10 verification changes remain separate from this UI milestone.
