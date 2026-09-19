# TAKEME mobile marketplace patterns

These are product patterns, not HTML components. Reproduce their hierarchy and states with native Flutter widgets when building iOS and Android apps. The web homepage is the current reference implementation.

## Shared tokens

- Brand: green `#00C853`, dark green `#006233`, light green `#E8F5E9`; charcoal `#1F2937`, gray `#6B7280`, off-white `#FAFAFA`.
- Typography: Poppins. Price is the strongest listing-card text; title follows, then location and condition. Auction state is explicit text, not color alone.
- Minimum interactive target: `44 × 44` logical pixels. Keep visible focus on web and clear pressed/selected states on every platform.
- Surfaces: white cards, soft borders, restrained shadows and rounded corners. Use consistent compact gaps; do not rely on hover to reveal actions.
- Motion: short and optional. Respect reduced-motion settings.

## Discovery flow

1. Compact header with prominent text search, menu and account action. Search opens the existing listing-search experience.
2. Promotional banner carousel: roughly `16:7` on mobile, horizontal swipe, four original TAKEME promotions, visible pagination and large CTA targets. Content is stored in `src/data/promotions.ts`; platform presentation may differ.
3. Category carousel: horizontal swipe, a 68–76px icon with its name, one category source (`src/data/categories.ts`), tap to filtered Explore. Do not add a second circular backdrop to supplied images.
4. Discovery tabs: horizontal, underlined selection, Top Picks / Nearby / Auctions / Free. A selected tab controls one feed; switching tabs does not imply a global realtime subscription.
5. Listing feed: two columns on phones, three on medium screens, four on large screens. Cards use a 4:3 image, price, two-line title, available location and condition, and actual auction status. Use bounded pages and explicit Load more.
6. Bottom navigation: Explore / Saved / Sell / Updates / Me, with Sell prominent. Home remains reachable from the menu. Saved opens a real account-backed page; unsupported Updates stays disabled.

## Honest data and component states

- Top Picks means discovery from recent and trending active listings. It becomes “Recommended for You” only after the server reports sufficient personalized interest; see [mobile intelligence](mobile-intelligence.md).
- Nearby uses the seller's entered location text, not GPS or distance. Ask for a location before querying.
- Auctions shows actual auction listings only. Free items remain an explanation state until zero-price listings are supported.
- Loading uses listing-card skeletons. Empty states explain what is absent and offer a real Sell or Explore action. Errors use plain language and Retry; never show raw Firebase errors.
- Filters remain a touch-friendly sheet on mobile. Listing detail, Sell, price, and auction status retain the same meaning across web and future native apps.

## Saved and trust flow

- A visible 44px heart on each listing card and a full-width action on detail toggle the same server-backed Saved record. The state updates immediately and rolls back with an error if the write fails. Guests go to sign-in, then return to the listing.
- Saved is a two-column mobile grid with a bounded 10-item page and Load more. Removed/private items keep a neutral unavailable tile so the owner can unsave them without seeing private data. A native app should use the same state machine: auth required → loading → empty/content → error/retry.
- Public profile shows name, photo, general location, member since and active listings. Only the owner can edit the public fields. Email stays in the owner's account view, never on seller profile or listing cards.
- Trust badges appear only from verified server-computed summaries. Verification, earned reputation and paid promotion are separate. Until legitimate transactions and aggregation exist, no rating, sales count or level is displayed.
- A future conversation is attached to one listing and has exactly a buyer and seller. Messages have bounded pages and explicit sender identity; a future trusted service must maintain unread counts and latest-message metadata before an inbox is enabled.
- Transaction states are pending, completed and cancelled; auction end does not imply completed sale. Review submission is available only for a server-recorded completed transaction, once per participant. Keep checkout/review UI honest until those workflows exist.
