# Phase 8 — transactions, reviews and role-specific reputation

This is a web and future Flutter contract. No TAKEME buyer-to-seller checkout, money movement or payment proof is implemented. COD, bank transfer, external payment and other are *agreed methods*, not evidence of payment. Both parties should confirm only after the item and agreed payment are genuinely exchanged. Offline collusion cannot be completely prevented by software; moderation and abuse review remain necessary before treating tiers as strong assurance.

## State machines and authority

`submitOffer` creates an `offers/{id}` request (`type=buy_now|offer`, `status=submitted`, seven-day expiry), **not** a transaction. Buy Now uses the listed price; an offer uses buyer-proposed integer sen. The seller may accept/reject a submitted request or counter an offer once. A buyer may withdraw or accept a seller counter. Rejected/withdrawn/expired requests do not count; an hourly bounded job records expiry while callables also enforce the timestamp immediately. The seller's acceptance or buyer's counter acceptance creates exactly one `transactions/offer-{offerId}` with `status=in_progress` and the final snapshotted amount; the fixed-price listing becomes `ended` (reserved, not sold). A per-listing deal lock prevents parallel accepted transactions. A cancelled fixed-price deal reopens the listing if still ended. A disputed one remains unavailable.

The existing auction finalizer continues to establish the winner and final bid. An idempotent Firestore trigger on `auctionStatus: ended` materializes `transactions/auction-{listingId}` with `status=in_progress`, `buyerId=winnerId` and `amountSen=finalBid`. It does not change bidding, winner selection or auction cancellation. An auction win is never a completed sale. Historical auctions finalized before this trigger is deployed require a separately reviewed migration; no silent backfill runs.

Transaction transitions:

| From | To | Rule |
| --- | --- | --- |
| No transaction | `in_progress` | Accepted live fixed-price request or trusted auction result |
| `in_progress` | `in_progress` | One buyer or seller completion confirmation, or a pending cancellation request |
| `in_progress` | `completed` | Both distinct parties confirm, no pending cancellation/dispute; atomic count and event |
| `in_progress` | `cancelled` | One requests cancellation, the other agrees; no count/GMV/reviews |
| `in_progress` | `disputed` | Either opens a dispute; completion and reviews paused pending future admin process |
| `completed`, `cancelled`, `disputed` | — | No user-facing reversal or arbitrary transition |

The other party may decline a cancellation request, after which completion is again possible, or may open a dispute. The first completion confirmation never grants tier credit. Simultaneous confirmations are serialized by the Firestore transaction. The second confirmation writes status, review deadline, role counts and a deterministic `TRANSACTION_COMPLETED` event together. Repeated requests return without a second credit. A completed fixed-price listing becomes `sold`; its detail remains directly viewable as public history but is excluded from marketplace discovery queries. An auction stays `ended` with its original winner/bid fields.

## Reviews and reputation

The review window is `REVIEW_WINDOW_DAYS=14` in the server policy. Both participants may independently submit exactly one immutable 1–5-star review, up to four role-appropriate tags and optional text (1,000 characters maximum). Buyer-to-seller tags concern item/communication/fulfilment; seller-to-buyer tags concern buyer conduct. Neither can read the other's private submission. Both reviews become public and enter role-specific rating aggregates only when both submit. If only one submits, the hourly expiry job publishes that review after the window; no later submission is accepted. Direct client writes and early aggregate leaks are denied. Reports on published reviews enter the existing moderation intake. There is no user delete-negative-review control.

`trustSummaries/{uid}.buyer` and `.seller` store separate completedCount, tier, reviewCount, ratingSum, averageRating and ratingDistribution. Counts increase only on confirmed completion. Tier thresholds are Bronze 5, Silver 15, Gold 30, Platinum 75; they are initial product configuration, returned to web/Flutter by `getReputationPolicy`. There is no hidden quality gate today. The progress meter uses real completed counts and the next configured threshold. Profiles show counts and published-review averages, never private transaction amounts. Listing detail shows a subtle seller signal only where real activity exists. Supplied tier-badge PNGs were resized for web under `public/brand/tiers/`.

Tier education lives at `/help/tiers`, linked from profiles and the footer: roles are separate, tiers are earned rather than bought, promotions and verification do not grant tiers, fake activity is prohibited, requirements may evolve, and tiers are not guarantees. Formal legal Terms need a separate legal review before launch; this help page is product education, not a substitute.

## Signals, metrics, cost and security

Completed transaction amount is private integer MYR sen. Future GMV is the sum of `amountSen` where `status=completed` only; exclude pending/cancelled/disputed deals, offers, bids/listing prices and promotion revenue. Admin analytics can later group transactions by type/status, reviews by role, and summaries by buyer/seller tier. No public GMV or private lifetime spend appears in UI. Phase 6 receives only server-authored completion/review events; clients cannot forge them. Phase 7 paid promotion never changes deal status or tier.

All callable workflows require Auth except public policy/review reads. Participants can view only their deals. Offers, locks, private reviews, public-review projections, reputation summaries and event writes are server-owned. Public reviews use opaque IDs and sanitized callable output. Seller offer pages read at most 20; participant transaction histories read 20 per role; public review pages read 10; the release job processes 100 due transactions/hour. No global realtime listener, per-second polling or client-side trust calculation is added. Required composite indexes are in `firestore.indexes.json`.

`confirmTransactionCompletion` accepts a transaction ID, not a client-selected participant role. `submitTransactionReview` accepts a transaction ID, rating, tags and comment, not a client-selected reviewer role. Both callables derive the caller's role exclusively from the authenticated UID and the server-stored transaction participants. A supplied `role` or `reviewerRole` field is unsupported extraneous input: it is ignored, not an authorization instruction or a promised validation error. The server can update only the authenticated party's confirmation or create only that party's role-specific review; non-participants are denied. Emulator security tests deliberately forge these unsupported fields and verify that no opposite-party confirmation or review is created. The security guarantee is denial of wrong-role privilege escalation, not rejection of an unknown request field.

Future Flutter clients should use the same regional callables and server statuses. Provide 44 logical-pixel touch targets, loading/empty/error/auth states, a review form only when the server permits it, a waiting-for-other-party completion state, and separate buyer/seller progress. Never let Flutter write trust fields or infer payment from a redirect or payment-method label.

Local verification uses `demo-takeme` emulators: `node tests/transactions-emulator.integration.mjs`, the auction/trust/intelligence/promotion suites, Functions/unit tests, lint, strict TypeScript and production build. No Firebase/Vercel deployment or GitHub push occurs in this phase. Later manual rollout requires Function/rule/index deployment together, ready indexes, review scheduler verification, moderation operations, fraud monitoring/App Check policy, historical-auction migration decisions, and legal/product review of offline confirmation and tier criteria.

Phase 11 keeps this standard flow intact and adds a separate disabled protected-settlement contract. Flutter must branch on `settlementMode`, never infer payment from `transaction.status`, and use the states described in [mobile protected transactions](mobile-protected-transactions.md).
