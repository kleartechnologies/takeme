# Marketplace UX refinement

Phase 10 refines TAKEME's consumer experience without changing its trusted marketplace backend. The implementation remains local-only and reuses the listing, auction, transaction, reputation, recommendation, promotion and saved-item systems delivered in earlier phases.

## Product principles

- Mobile is the primary product surface. Core actions have touch-sized controls, bottom-navigation clearance and safe-area support.
- Discovery is image-led, compact and fast to scan. Listing data always comes from the existing bounded marketplace queries.
- States are honest. TAKEME does not invent inventory, interests, notification events, trust labels, payments or result totals.
- Paid placement and reputation remain visually and conceptually separate.
- Interactions use patterns that can map cleanly to a future Flutter application: tabs, horizontal carousels, sheets, cards, skeletons and clear primary actions.

## Navigation architecture

The mobile navigation is now the product-level five-item structure:

1. Explore
2. For You
3. Sell
4. Updates
5. Me

Sell remains the prominent central action. Personal destinations show their existing focused sign-in state to signed-out visitors instead of becoming dead links. Desktop navigation exposes Explore, For You, Saved, Sell, Updates and Me without creating a competing consumer navigation model.

## Explore

`/explore` follows a marketplace-first hierarchy:

1. Dominant keyword search and sorting
2. Compact promotional carousel when no filters are active
3. Official category carousel
4. Top Picks, Nearby, Auctions and Free discovery tabs
5. Filter sidebar or mobile filter sheet
6. Paginated real listing results

The header's duplicate mobile search is replaced by a compact TAKEME identity on Explore, leaving the route search as the single dominant control. Query and filter values remain in the URL. A search heading names the submitted query, while the displayed number is explicitly the number of listings loaded rather than a fabricated total. Free listings remain an honest unavailable state because current listing validation requires a positive price.

## For You

`/for-you` calls the existing Phase 6 recommendation endpoint. It preserves recommendation source attribution and impression/click tracking. The screen shows only an `All` interest chip because the current callable does not return a user-interest taxonomy. When the engine is in discovery mode, the UI explains the cold-start state instead of implying personalization. Signed-out users receive a focused sign-in state.

## Categories

`/categories` presents all 14 official categories from `src/data/categories.ts` with the existing image assets and fallback icons. The same category visual language remains in the home and Explore carousels. No unsupported subcategory hierarchy was invented.

## Updates

`/updates` provides All, For Action, Activity, Promos and Support tabs. Existing transactions are the only current source of user-specific update records:

- `in_progress` and `disputed` transactions appear under For Action.
- `completed` and `cancelled` transactions appear under Activity.
- All shows the combined bounded transaction response.

Promos and Support explain that no global notification feed exists yet. Likes, views, messages, tier-change notices and system announcements are not fabricated.

## Me

The account header now prioritizes avatar, name, email, aggregate published rating/review count, location and membership date. Selling and Buying tabs expose only working destinations:

- Selling: Create listing, My listings, My sales and Updates.
- Buying: Saved, Purchases, Auctions and For You.

Existing buyer and seller reputation cards, tier progress, reviews, transactions, listings, edit, promotion and removal flows remain intact. Promotion actions do not affect reputation.

## Listing cards and detail

Listing cards retain a fixed image aspect ratio and easy-to-reach save action. The scan order is title, price, essential marketplace metadata and optional auction timing. Auction labels now distinguish scheduled, live, ended and cancelled states. Featured and Boosted labels continue to say they are paid placement.

The detail summary now surfaces condition and seller access alongside the type, title, price and location before the existing transaction or bid panel. The existing action logic still determines whether a buyer sees a request/offer flow, a bid action, transaction state or an unavailable result.

Card-level seller trust badges were intentionally not added. Trust is not denormalized onto listings, and adding a per-card trust read would create an unnecessary N+1 query pattern. Seller trust remains on detail and profile surfaces where it can be loaded accurately.

## Sell

The existing listing form is regrouped as:

1. Photos
2. Details
3. Price and listing format
4. Pickup location
5. Preview and publish

Image limits, validation, auction timing, bid amounts, uploads and create/update services are unchanged. Numeric price inputs keep mobile-friendly decimal keyboards. The preview remains sticky only where desktop space supports it and follows the form on smaller screens.

## Saved items and states

Saved remains a first-class destination from Me and desktop navigation. The existing saved-record behavior is preserved: removed or inaccessible listings remain visible as unavailable cards until the user explicitly removes them.

Loading uses existing card or row skeletons. Empty states use TAKEME's mascot and task-specific copy. Errors remain short, actionable and do not expose raw Firebase messages.

## Reference principles

The supplied Carousell screenshots informed hierarchy, browsing density, category access, bottom navigation, role separation and obvious actions. TAKEME did not copy Carousell's branding, colors, icons, typography, copy, product names, proprietary artwork or exact layouts. The result uses TAKEME green, Poppins, official category art, mascot assets, marketplace terminology and existing product systems.

## Backend and data safety

No Firebase Functions, Firestore rules, Storage rules, indexes, schemas, authorization checks or trusted calculations changed. No new realtime listener or unbounded Firestore query was introduced. No production data was modified and no deployment was performed.

## Known limitations

- The recommendation callable returns ranked listings and source attribution, but not a user-interest vocabulary. For You therefore shows only `All` until real interest data is available.
- Updates has no durable cross-feature event collection. It currently presents real transaction state and honest empty states for other channels.
- Free listings are not supported by current positive-price validation.
- Messaging remains unavailable and is not represented as an active inbox.
- Card-level trust badges need a future bounded, denormalized public trust projection before they can be added without per-card reads.
- A multi-item cart is intentionally absent because current transactions are listing-specific.

## Future opportunities

- Define a privacy-safe interest-label projection for recommendation chips.
- Add an authoritative user notification collection populated by server-side marketplace events, with read state and bounded pagination.
- Add a denormalized public seller-summary snapshot to listing reads if card-level trust proves useful.
- Add a supported free/give-away listing type through a separately reviewed validation and transaction design.
- Add native deep-link and push-notification mappings when the Flutter applications are introduced.
