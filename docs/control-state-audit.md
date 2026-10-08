# Consumer control-state and focus audit

Prepared locally on 2026-10-08 from production baseline
`9a250b10bd1ff46f25d8d217794ee9260b23fe4f`. No deployment or push.

## Root cause and treatment

The production Header Search input had a computed 3px dark-green outline,
3px offset and zero corner radius inside a pill-shaped form. The unlayered
global `:focus-visible` rule overrode the Tailwind `outline-none` utility.
The form also had its own focus-within ring, producing competing indicators.
Explore Search, sorting, offer amounts and bid amounts had the same inner-field
geometry problem or a duplicate wrapper/child indicator.

Composite fields now explicitly opt into `control-shell`, or their existing
component shell. A focused field transfers its 2px dark-green outline to the
rounded shell using `:has(...:focus-visible)`. Only that field's outline is
suppressed. Independently focusable shell buttons retain their own indicator.
Ordinary inputs, textareas and selects retain a 2px outline on the control.
Outlines, rather than shadows alone, preserve native forced-color treatment.
Forced-color mode and screen-reader speech were not separately exercised.

## Inventory and findings

| Surface / primitive | Reviewed state treatment |
| --- | --- |
| Header, Home and Explore Search | One pill-shaped field indicator; circular submit button; existing alignment and navigation preserved. |
| Text, numeric, textarea and select fields | Rounded 2px keyboard indicator; dark-green focus border; invalid form fields retain red border and associated error text. |
| Primary, secondary and icon buttons | Existing sizes and semantics; primary hover no longer translates the control; disabled buttons excluded from hover changes. |
| Explore categories, condition/type chips and sorting | Category focus corners restored; chip focus inset within horizontal clipping; sort shell owns its indicator; selected states unchanged. |
| Saved tabs and controls | Existing 2px inset tab focus retained; terminal removal and save eligibility unchanged. |
| Updates filters and notification rows | Dark-green 2px focus; selected green chips use white inset focus for contrast; inset indicators within clipped containers; first/last row corners match the list. |
| Product gallery, Save, Follow, back, share and CTAs | Shared focus follows existing rounded control shape; labels, optimistic state and marketplace rules unchanged. |
| Auction bid sheet | Rounded stepper shell owns input focus; increment buttons keep individual circular focus; disabled decrement skipped by Tab. |
| Messaging composer and offer sheet | Rounded composer focus retained; offer amount no longer has nested outlines; send/loading/disabled behavior unchanged. |
| Auth and onboarding forms | Rounded field focus strengthened; Google/submit/link/checkbox focus standardized; consent and routing logic unchanged. |
| Sell Photos, Category, Details, Review | Hidden photo input transfers focus to visible photo control; replace action rounded; category/condition selection and validation preserved. |
| Profile, settings and utility rows | Existing profile interactive affordances retained; Settings focus inset to prevent clipping; group end corners match the container. |
| Dialogs, sheets, menus and popovers | Existing focus trap, Escape, restoration and aria semantics retained; no focus-management JavaScript changed. |
| Help/legal navigation and social links | Focus no longer forcibly changes all link radii to 3px; circular social controls remain circular; prose links and legal wording unchanged. |
| Admin app | Dedicated app stylesheet and component tree are separate; no Admin source, shared Admin primitive or deployment changed. |

Default, hover, pressed/selected, disabled, loading and error rules were reviewed
in consumer styles/components. Browser checks exercised keyboard focus, pointer
selection, disabled tab skipping, real loading states, validation errors and
dialog restoration. No additional visual library, dependency, timer or effect.
This is a source-wide audit with representative interactive browser coverage,
not a claim that every possible data-dependent control was individually clicked.

## Browser qualification

Read-only live Home established the before state. After checks used an isolated
consumer copy and local Firebase emulators with disposable synthetic users,
listings, auction states, conversations and notifications. Production credentials
and customer-private data were not used. No bids, offers, messages or listings
were submitted/published during the control walkthrough. Opening Make Offer
created a local synthetic empty conversation only.

All requested sizes were checked: 390×844, 430×932, 768×1024, 1024×768 and
1440×900. Loaded Home, Explore, Product, Profile, Settings, Saved, Updates,
Auth, messaging composer, Offer/Bid sheets and Sell Review had no document
horizontal overflow. Focused Search, unchecked signup checkbox, Settings row,
composer and Offer/Bid inputs were checked across these sizes. Amount-shell
outlines stayed inside sheet bounds; Product actions remained 48px high and
Sell Review actions 50px high. Composer bottom remained above mobile navigation
(758/844 and 846/932) and within the desktop viewport (868/900).

All four Sell stages were walked with a local photo. Empty Details validation
was exercised, then valid details reached Review without publication. Keyboard
Search input, submit/filters, Product Save, Profile/Settings rows, Auth controls,
Sell controls and Messaging/Offer/Bid controls remained visible and logical.
Filter and offer sheets closed with Escape and restored trigger focus. A normal
pointer click selected an Updates filter with `focus-visible=false`; text inputs
can appropriately retain focus-visible for text editing. Browser console showed
no errors in the qualification tab.

Before/after Search and representative Auth, Explore, Product, Settings,
Sell Details, Messaging and Offer/Bid screenshots are retained privately outside
Git. Device screenshots, emulator data, logs and private fixture credentials are
excluded from this checkpoint. Physical-device and native OS picker appearance
were not separately qualified.

## Bundle and build qualification

The retained prior production build's entire tracked `src` tree, package/lock,
Next and OpenNext configuration match baseline HEAD. Deterministic gzip sizes
(each chunk compressed separately, timestamp zero) were compared with the new
production Cloudflare build using the same resolved dependency versions.

| HTML-referenced route assets | JS gzip delta | CSS gzip delta |
| --- | ---: | ---: |
| Explore | −9 B | +13 B |
| Profile | −16 B | +13 B |
| Settings | −24 B | +13 B |
| Sell | −28 B | +13 B |
| Messaging | −18 B | +13 B |
| Updates | −22 B | +65 B |
| Saved | −18 B | +13 B |
| Login / Register (each) | −16 B | +13 B |

Across all four compiled CSS chunks: 157,125 → 157,904 raw bytes;
31,416 → 31,481 gzip bytes (**+65 B**, approximately 0.21%). HTML-referenced
figures exclude later lazy route requests and are not claimed as network timing
or Lighthouse improvements. No new dependency or bundle regression.

The initial adapter check with a symlinked root dependency directory failed
native Sharp bundling. Qualification succeeded with a private isolated copy
using the existing resolved production dependency tree; application configuration,
dependency manifests and lockfiles were unchanged.

Checks passed:

- App/UI/auth/navigation/policy/legal suites: **533 passed, 2 existing skips**.
- Six new focus contract tests plus updated 2px accessibility expectation.
- Functions regression suite: **189/189 passed**, no Functions source changes.
- TypeScript, ESLint and diff whitespace review.
- Scoped credential scan: zero findings.
- Production Next/OpenNext Cloudflare build, **1,885-file** artifact validation,
  and local Wrangler dry-run (no deployment).

## Change boundary

Changed files only:

- `src/app/globals.css`
- `src/components/auth/auth.module.css`
- `src/components/forms/sell.module.css`
- `src/components/layout/header.tsx`
- `src/components/listings/auction.module.css`
- `src/components/listings/explore-browser.tsx`
- `src/components/messages/messaging.module.css`
- `src/components/public-information/public-information.module.css`
- `src/components/settings/settings.module.css`
- `src/components/updates/updates.module.css`
- `tests/control-focus.test.mts`
- `tests/stage11-accessibility-seo.test.mts`
- This review document.

No backend, Admin, legal wording, auth/consent enforcement, marketplace business
logic, production configuration, rules or routing changes. Media Pipeline stays
parked. Local checkpoint is ready for owner review; production deployment is a
separate action.
