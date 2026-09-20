# TAKEME — Phase 3 auctions

TAKEME is a mobile-first peer-to-peer marketplace for Malaysia. Phase 3 adds server-authoritative auction listings and bidding while preserving the Phase 2 buy-now marketplace and the official TAKEME brand.

Brand: **Same Stuff. A Brighter Tomorrow.** · **Buy. Sell. Give. Reuse.** · Poppins · `#00C853`, `#006233`, `#E8F5E9`, `#1F2937`, `#6B7280`, `#FAFAFA`.

## Architecture

`listings/{listingId}` remains the canonical listing object. A buy-now listing retains its Phase 2 shape. An auction listing adds:

- `listingType: "auction"` (the model also reserves `"buy_now_and_auction"` for a future phase; the Phase 3 UI does not create combined listings)
- `auctionStartAt`, `auctionEndAt` (UTC Firestore timestamps)
- `startingBid`, `minimumBidIncrement`, `currentBid`, `finalBid` (integer sen)
- `currentBidderId`, `winnerId` (Firebase Auth UIDs or `null`)
- `bidCount`, `auctionStatus`, `endedAt`

Bid history is stored under `listings/{listingId}/bids/{bidId}` as `{ bidderId, amount, createdAt }`. It contains no email, phone number, or other private profile fields. The detail view reads only the latest 25 bids. Each bid is immutable to clients.

The browser uses Firebase v2 callable functions in `asia-southeast1`; it never updates auction authority fields directly. The functions use Firebase Auth context and Firestore transactions:

1. `createAuctionListing` validates an auction and creates a draft owned by the authenticated seller.
2. Images are uploaded to the seller/listing Storage path. `publishAuctionListing` verifies the objects and publishes the auction.
3. `updateAuctionListing` permits edits only before the start and with no bids.
4. `placeBid` checks auth, listing state, seller identity, schedule, expiry, amount and configurable increment. It atomically creates an immutable bid and updates the listing's current bid, bidder, and count. Concurrent requests retry against the latest transaction state; rejected bids create no record.
5. `cancelAuction` allows scheduled or active auctions to be cancelled only while no bids exist.
6. `advanceAuctionLifecycle` runs once per minute, changing scheduled → active and scheduled/active → ended. At end it records `winnerId`, `finalBid`, and `endedAt` from the authoritative listing state, or `null` winner/final bid when no bids exist.

The callable operation's Firestore timestamp is authoritative. The browser countdown is presentation only and disables its own bid form at zero. Even if the scheduled finalizer has not run yet, `placeBid` rejects requests after `auctionEndAt` or before `auctionStartAt`. A listing that ends with no bids remains publicly visible as ended history; there is no automatic conversion to buy-now. Payments, checkout, orders, notifications, messaging, reviews, and fraud scoring remain out of scope.

## Security

`firestore.rules` preserves the buy-now owner rules and denies all direct client creates/updates of auction listings. Direct writes to `currentBid`, `currentBidderId`, `bidCount`, `auctionStatus`, `winnerId`, `finalBid`, `endedAt`, and `listings/{id}/bids/{bidId}` are denied. A seller may delete only their own unbid draft. Public users can read active or ended listings and their bid history; drafts remain owner-only.

`storage.rules` allow auction uploads/changes only by the seller while the listing is a draft or scheduled before its start, and only with no bids. Published/ended auction media can be read. The callable verifies that every submitted image URL belongs to this listing's project bucket and seller path, references an existing JPEG/PNG/WebP object under 8 MB, and carries that object's download token.

There is no service-account key in this repository. The Functions runtime uses its managed service identity. Do not put Admin SDK credentials, private keys, or production tokens in client environment variables.

## Local development and emulator tests

Requirements: Node.js 22, npm, Java, Firebase CLI. Use a **demo project ID** for local emulator work; do not point local tests at production.

```bash
npm install
npm --prefix functions install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local`. The Firebase client supplies demo config only in this mode. In separate terminals:

```bash
npm --prefix functions run build
firebase emulators:start --project demo-takeme --only auth,firestore,storage,functions
npm run dev
```

Configured ports: Auth `9099`, Firestore `8080`, Storage `9199`, Functions `5001`, Emulator UI `4000`. The default Functions region is `asia-southeast1`.

Verification:

```bash
npm test
npm run test:functions
node tests/auction-emulator.integration.mjs # requires the four emulators above
node tests/trust-emulator.integration.mjs # requires Auth + Firestore emulators
npm run lint
npx tsc --noEmit
npm run build
```

The emulator integration test creates only demo-project accounts/listings/bids and checks callable authorization, minimum bids, concurrency, immutable history, direct-write denial, cancellation, expiry, and winner finalization. It does not create production data.

## Phase 5 trust and marketplace core

Saved listings use owner-only `users/{uid}/saved/{listingId}` records, an immutable timestamp and bounded cursor pages. The public profile is `users/{uid}` (no email or roles), with owner edits to name, general location and photo. Sign-in creates a missing profile but never overwrites an existing edit. Details, security boundaries, lifecycle and Flutter mapping are in [the trust data model](docs/trust-data-model.md) and [mobile patterns](docs/mobile-marketplace-patterns.md).

`transactions/{id}` and `trustSummaries/{uid}` are trusted-server-write-only. `transactions/{id}/reviews/{reviewerUid}` accepts one immutable review only for a server-recorded completed transaction between distinct participants. `conversations/{listingId}_{buyerUid}` and nested messages are participant-only; the conversation metadata is intentionally immutable until a trusted unread/latest-message fan-out exists, so no inbox UI is exposed. `reports/{id}` accepts controlled, immutable user submissions; moderation decisions require server authority. No Stripe, paid promotion, fabricated reputation, full messaging, or production data is part of Phase 5.

Saved pagination and message ordering use Firestore's single-field indexes. Composite indexes were added for a future participant-scoped inbox and reporter-scoped report history. Run the new emulator test before any separately approved rules deployment. This local phase does not deploy Firebase or Vercel and does not push GitHub.

## Phase 6 intelligence foundation

Marketplace intent now flows through authenticated callable tracking, with authoritative Saved, bid and conversation triggers. A bounded server recommendation endpoint provides honest discovery until enough interest exists to label the feed “Recommended for You”. Detail pages show deterministic Similar items. Raw behavior and interest scores remain private. The event schema, scoring formula, cost limits, security model, future admin analytics and Flutter contract are in [mobile intelligence](docs/mobile-intelligence.md). This phase is local-only; deploy neither Functions nor rules nor the web app without separate approval.

For local Phase 6 integration verification with Auth, Firestore and Functions emulators running on the demo project, run `node tests/intelligence-emulator.integration.mjs` in addition to the existing test commands above. Production rollout needs the new Functions and Firestore rules/indexes together, plus TTL setup noted in the document.

## Phase 7 optional visibility foundation

Sellers can review example Boost and Featured packages and save or cancel an **unpaid** promotion request for an eligible active listing. There is no Stripe integration, checkout or activation path yet: requests remain `pending_payment`, no charge is taken, no revenue is claimed and no public paid placement appears. A separately gated placement service accepts only trusted active/paid promotions without changing organic recommendations. The lifecycle, security, cost limits, analytics, Flutter contract and required later payment work are in [mobile monetization](docs/mobile-monetization.md). With the demo emulators running, verify with `node tests/promotions-emulator.integration.mjs`. This local phase does not deploy or push.

## Production deployment considerations

Phase 3 source is **not deployed by this README**. Deploying only the UI or only the rules would break auctions. When Phase 3 is separately approved for production, deploy and verify the new Firestore/Storage rules, two lifecycle indexes, and six Cloud Functions before enabling the Phase 3 web build. Confirm the Firebase project and Blaze plan, Functions runtime `nodejs22`, regional availability, managed runtime permissions, App Check policy, and that all indexes have reached `READY`. Keep `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` in Vercel and use the registered Firebase Web app's six `NEXT_PUBLIC_FIREBASE_*` values. Do not create fake production auctions or bids as smoke tests.

The existing `firestore.indexes.json` retains the Phase 2 marketplace indexes and the two Phase 3 lifecycle indexes: `(status, auctionStatus, auctionStartAt)` and `(status, auctionStatus, auctionEndAt)`. The scheduler filters for published listings so abandoned drafts cannot starve the 200-document per-run limit. Bid history uses a single collection's `createdAt` ordering and needs no composite index. Phase 5 adds the two trust-foundation indexes described above.

## Project structure

```text
functions/src/auction-domain.ts   Auction money/timing/lifecycle validation
functions/src/index.ts            Authenticated callables and scheduled finalizer
src/lib/services/auctions.ts      Client callable and bid-history repository
src/lib/services/listings.ts      Existing listing repository with auction flow
src/components/forms/            Buy-now and auction publish/edit form
src/components/listings/         Listing cards, auction panel, countdown, detail
firestore.rules                   Marketplace and immutable-bid authorization
storage.rules                     Seller-owned auction media authorization
firestore.indexes.json           Marketplace and auction lifecycle indexes
tests/                            Local validation and emulator integration
```
