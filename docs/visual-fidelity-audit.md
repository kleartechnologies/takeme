# TAKEME visual fidelity audit

Baseline: `1738fa68c17b680be893eb01e3fc850140fcf085`. Local inspection, 2 October 2026. All six images in `TAKEME PROJECT/design-reference/` inspected before UI edits. Baseline captures were inspected at 390px consumer routes, 375px Explore and 1440px Home. Their temporary `/tmp/takeme-visual-audit` files were lost in the machine/session restart; they are not retained comparison artifacts. Existing demo-emulator fixture script supplies test states; no marketplace content is added to application code.

## Shared reference language

White/off-white canvas, Poppins, compact dark headings, green prices and rounded CTAs, soft small shadows, image-led cards, pill filters, simple outline icons, five-item navigation with floating Sell. The supplied horizontal TAKEME logo is a closer match than the existing app-icon-plus-typeset-word treatment. Keep accessible contrast: white button text needs a darker green than the bright #00C853 brand accent. Preserve minimum 44px interactive targets even where raster mockups appear smaller.

## Discrepancy matrix (audit completed before implementation)

| Screen / reference | Current implementation | Difference | Required presentation change |
| --- | --- | --- | --- |
| Home / home.PNG | `app/page`, hero, categories, home rails | Hero uses floating square icon tiles; overlarge gap at pagination; grid repeats vertically; small generic header logo | Use supplied horizontal logo, mascot-led hero with reference headline, tight dots, circular category treatment, horizontal mobile rails and consistent sections |
| Explore / explore.PNG | `ExploreBrowser`, `app/explore` | Oversized intro precedes search; categories disappear with filters; multiple toolbar rows; one column below 380px | Search first, persistent category rail, compact contextual heading/sort, two columns at all mobile widths, compact metadata |
| Product detail / for-you.PNG panel 5 | `ListingDetailView` | Price before title; large framed summary; multiple stacked full-width utility actions; About far below deal form | Image-first composition, title then condition/location and price, compact utility row, white detail surface, seller summary and truthful V1 deal actions |
| Auction detail / auction.PNG | `AuctionPanel`, detail | Dark gradient countdown dominates, price repeated, square metric boxes, large spacing | Compact warm countdown, unified green bid summary, slim state callouts, consistent bid sheet and anonymous bid history |
| Auction states / auction.PNG panels 3–8 | same panel, authenticated viewer state | Generic notices, weak winner emphasis | Strongest truthful state heading and icon for winner/ended/highest/outbid; retain server-derived viewer state, never public winner identity |
| Profile / profile-seller.PNG panel 1 | `ProfileView` | Tall gradient cover on personal profile, stacked avatar/name, large boxed metadata | Compact horizontal identity, subtle general-area/member line, grouped shortcuts, retain private buyer/seller reputation separation; no Wallet |
| Seller / profile-seller.PNG panels 3–4 | `SellerProfileView`, `ReputationView` | Generic gradient cover, large repeated explanation blocks; listings single-column at mobile | Simple brand surface without invented cover photo, compact seller identity/trust, two-column listings, seller-only review projection |
| My Listings / profile-seller.PNG panel 2 | `MyListingRow` within profile | Large card per row, promotion/actions crowd item identity | Compact thumbnail rows, title/price/status hierarchy, actions remain accessible; preserve resume draft and all existing controls |
| Messages / messages-offers.PNG panels 1–2 | inbox and conversation | Floating inbox cards; conversation lacks product thumbnail; bulky composer and header | Flat separated thumbnail rows, compact product context card, neutral chat canvas, green outgoing bubbles, compact composer; no invented unread counts or price fields |
| Offers / messages-offers.PNG panels 3–4 | `ListingDealPanel`, `ActionSheet` | Sheet omits product image, large listed-price panel; detail exposes future Protected Transaction panel | Product summary in sheet, strong amount field, existing payment-method choices only; remove disabled V2 presentation, keep all request handlers/contracts |
| Saved / no dedicated reference | `SavedView` | Uses oversized cards and explanatory toolbar | Inherit compact two-column card system and pill actions; private saved state unchanged |
| Updates / no dedicated reference | `NotificationsCenter` | Large boxed rows and duplicated headings | Match message row rhythm and compact header; maintain actual unread state/actions |
| Sell / no dedicated reference | `SellForm` | Oversized editorial headline and heavy sections | Compact page title, consistent section cards and fields; preserve validation, image pipeline and unsaved warning |
| Bottom nav / all reference packs | `MobileNav` | Home / Explore / Sell / Saved / Profile differs from Explore / For You / Sell / Updates / Me | Match reference destinations, Explore selected for home/explore/listing, floating plus; Saved remains header/profile accessible |
| Shared cards / home + explore | `ListingCard` | Redundant fixed-price label, tall seller section, small title, dense wrapped duplicate bid copy | Compact title/green price/location/condition; preserve seller trust, auction bid labels and paid promotion disclosure without duplicated text |
| Sheets/dialogs / auction + offers | `ActionSheet`, existing custom confirmations | Structure is accessible; excessive padding and text-only item context | Retain focus trap/Escape/restore/busy semantics; consistent rounded sheet and compact product context |
| Empty/loading/error | shared states | Large mascot box/shadow; skeleton doesn't match new card | Match compact cards, real empty/error messages and retry actions; no fabricated inventory |
| For You / for-you.PNG | `ForYouFeed` | Recommendation rails, not video | Use larger image-led discovery cards within existing ranking; no video/comments/live commerce controls |
| Desktop / references mobile-only | shared responsive layouts | Very large type, broad dark footer and card shadows | Keep same typography/radii, constrained columns and quieter footer; no new desktop aesthetic |

## Scope boundaries

No backend, contracts, auth, rules, ranking, media-processing, location, transaction or reputation behavior changes. No invented product photography: supplied branding/category assets are available, while emulator products use visibly synthetic test images. The reference product photos are not standalone product assets and will not become fake live listings. No Wallet, delivery promise, video feed, buyer protection or protected checkout is added. The existing disabled protected-payment panel is presentation only and must be removed to meet the V1 constraint.

## Verification plan

Compare local captures after each group. Primary widths 375/390/430; regression widths 320/768/1024/1280/1440. Exercise existing bid/offer sheets without altering their handlers, and local profile/Saved/message states. Run app and Functions tests, TypeScript, source ESLint, production build, and diff checks. Record residual differences explicitly; technical validation alone is not visual completion.

## Implemented and verified

- Shared wordmark from the supplied asset pack, smaller shadows/type scale, white-on-dark-green accessible CTAs, five-destination floating-Sell navigation and light footer.
- Home mascot-led composition and horizontal inventory rails; Explore search-first layout, persistent categories and two-column mobile grid.
- Image-first detail hierarchy, compact Save/Message row, warm auction countdown, compact seller summary and unchanged anonymous bid/viewer state.
- Horizontal profile identity, two-column public seller inventory, larger My Listings thumbnails; compact Saved, Updates, Sell and empty/loading presentation.
- Flat message rows, shared product context in conversation/offer sheet, green outgoing bubbles and expandable seller trust. Removed only the unsupported protected-payment teaser; authoritative standard settlement code is unchanged.
- Encoded the existing category asset's ampersand after a rendered image-optimizer 400 was observed. No image file, category identifier or filtering contract changed.

### Browser evidence

Optimized Next.js build served on `localhost:3001`, using only demo Firebase emulators. Captures are outside the repository at `../visual-fidelity-captures/`.

Home, Explore, listing, auction, seller, Messages, Saved, Updates, Sell, Profile and For You were rendered at 320, 375, 390, 430, 768, 1024, 1280 and 1440 CSS pixels. All had document width equal to viewport width. Final detail/Sell adjustments were recaptured at all eight widths. Primary mobile screenshots and desktop captures were inspected, not only measured.

Bid and offer sheets were opened without submission at 320/375/390/430; no horizontal clipping. Escape closed both and focus returned to their respective opening buttons. Conversation thumbnail/message/composer rendering was inspected. Scheduled, active, highest, outbid, ending-soon, ended/no-bid, winner and lost auction fixtures were captured at 390px; authenticated winner information remained in the existing viewer projection.

### Validation

- App: 62/62 passed.
- Functions: 46/46 passed, including Functions TypeScript build.
- Stage 11 closure emulator suite: passed (eight auction projections, bid/offer duplicate protection, same-ID draft publication).
- Engagement emulator suite: passed (saved searches, follows, notification/private-owner boundaries and denied direct writes).
- App TypeScript, source and modified-test ESLint, production build and `git diff --check`: passed.
- Production build was also repeated with explicit demo environment variables for browser inspection. The emulator preview artifact is not a deployment artifact.

No Functions, services/contracts, types, rules, dependencies, production environment/configuration or marketplace business logic changed. Existing Stage 10 tests remain unchanged. No production browsing/actions, deployment or push were performed.

## Remaining visual differences / intentional V1 adaptations

This is a material alignment pass, not a pixel-identical reproduction. Product photography and populated review/avatar content differ because local fixtures deliberately use synthetic images and neutral new accounts. No reference products, review counts or trust claims were fabricated.

- Hero uses the supplied standalone mascot/category assets rather than the exact flattened reference collage. Desktop art is height-constrained to avoid cropping the mascot.
- Dark green buttons and slightly darker secondary gray preserve contrast instead of copying inaccessible raster colors literally.
- Detail pages retain truthful settlement forms, reporting and safety explanations, making them taller than the mockups. Auction result notices remain inline instead of separate celebratory full-screen illustrations.
- Public seller reputation keeps the existing seller-only summary/review sections, not the reference's mixed Buying/Selling review tabs. Personal profile retains separate buyer/seller reputation and existing management controls; no Wallet.
- For You remains the existing ranked recommendation rails, styled through shared cards, not a full-screen video feed. No video, comments, live commerce or invented ranking behavior.
- Messaging retains its supported text composer, participant/reporting notices and available conversation fields. No photo attachments, invented delivery/tracking controls, payment confirmation or fake inbox prices were added.
- No dedicated Saved, Updates or Sell reference exists; these screens inherit the same shared visual language. Existing functionality and accessibility take precedence over reducing controls to match a flattened mockup.

Human visual acceptance remains subjective; the captures and this explicit mismatch list are the review evidence, not a claim of pixel-level equivalence or screen-reader certification.
