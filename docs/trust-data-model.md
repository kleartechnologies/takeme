# TAKEME trust data model

Firebase Auth owns private identity. `users/{uid}` holds public-only name, photo, general location and membership dates; profile edits cannot write trust fields. Verification, earned reputation and paid visibility are independent.

| Path | Authority and reads | Purpose |
| --- | --- | --- |
| `users/{uid}` | Public read; owner edits only public fields | Public identity without email or transaction value |
| `users/{uid}/saved/{listingId}` | Owner read/write with active-listing and timestamp rules | Bounded Saved pages |
| `offers/{offerId}` | Functions only | Buy Now request or offer, seller counter, terminal response; **not** a transaction |
| `offerLocks/{listingId}_{buyerId}` | Functions only | One open request per buyer/listing; expired/terminal requests can be replaced |
| `listingDeals/{listingId}` | Functions only | Prevent simultaneous accepted deals on one listing; supports cancelled replacement |
| `transactions/{transactionId}` | Buyer/seller direct get; all writes through Functions; participant history via bounded callable | Agreed amount in integer sen, source/type, confirmations, lifecycle, review window; private amount |
| `transactions/{transactionId}/reviews/{reviewerUid}` | Author's direct get only; Functions write immutable record; admin get | Unpublished double-blind review; other party cannot read early |
| `publicReviews/{opaqueId}` | Functions/admin only | Released, sanitized review. Public callable returns role, rating, tags, comment and date, not participant IDs or transaction amount |
| `trustSummaries/{uid}` | Public direct get; Functions write | Source of truth for separate buyer/seller completion count, tier, ratings and distribution; no fabricated defaults stored |
| `marketplaceEvents/{id}` | Admin read; Functions write | Deterministic `TRANSACTION_COMPLETED` and `REVIEW_SUBMITTED` events, private amount on completion event only |
| `reports/{id}` | Reporter/admin read; controlled listing/user client create, review reports through Function | Immutable moderation intake; no delete-negative-review action |
| `promotions/{id}`, `promotionLocks/{listingId}` | Phase 7 server authority | Paid placement cannot grant a transaction, review, reputation or tier |

Offer amounts and accepted transaction amounts are integer MYR sen. Buy Now snapshots the canonical listed price; offer acceptance snapshots the final counter/offer price. Auction `finalBid` is already integer sen and becomes one deterministic `auction-{listingId}` transaction after trusted finalization. A view, bid, offer, accepted request, or auction win is **not** completion.

`in_progress` deals require independent buyer and seller confirmations. The second confirmation atomically writes `completed`, one buyer count, one seller count, a 14-day review window and a deterministic private completion event. A duplicate or raced confirmation cannot increment totals twice. Cancellation needs both parties; a dispute blocks completion pending a later admin process. Cancelled/disputed deals have no GMV or reputation credit. `completed` is terminal in the user-facing workflow.

Reviews require a completed deal, the correct participant, 1–5 stars, role-appropriate optional tags and a still-open window. One immutable review per side uses the reviewer UID as document ID. First submission remains hidden from the other party, public profiles and rating aggregates. Both submissions release both reviews atomically; otherwise an hourly bounded job releases submitted reviews after the window. Public ratings count only released reviews, avoiding double-blind leaks through summary averages. A review of a cancelled, disputed or uncompleted deal is impossible through client rules/callables.

Buyer and seller tiers are separate, based **only** on completed transaction counts. Server policy in `functions/src/transaction-domain.ts` defines Bronze 5, Silver 15, Gold 30 and Platinum 75. There is currently no hidden minimum rating, review count or reliability threshold. Ratings are role-specific sum/count/distribution of published valid reviews. Tier progress obtains thresholds from `getReputationPolicy`, not a second UI constant. Admin can later aggregate completed `transactions.amountSen` for GMV; listing price, bids, offers and promotion spend do not qualify. Do not publish a lifetime RM value on a profile.

Client rules deny writes to all authoritative transactions, offers, locks, summaries, public reviews, counters and events. Functions re-check Auth, ownership, status, amount and time inside Firestore transactions. Bounded indexes support participant histories (20 per role), listing offers (20), public reviews (10) and expired-review release (100/hour). Auction, listing, Saved, Phase 6 intelligence and Phase 7 promotion rules remain in force. See [mobile transactions](mobile-transactions.md) for state/UX/Flutter mapping and [mobile monetization](mobile-monetization.md) for paid-visibility separation.

## Discovery seller projection

Marketplace cards and listing detail use the public `getPublicSellerSummaries` callable. It accepts at most 40 unique seller IDs and performs two bounded Admin SDK `getAll` reads: public `users` profiles plus server-owned `trustSummaries`. The response is an explicit allowlist, never a spread of either source document:

- `uid`, `displayName`, `photoURL`
- `sellerRating`, `sellerReviewCount`
- `sellerCompletedTransactionCount`, `sellerTier`
- existing server-owned `verificationStatus`

Buyer reputation, transaction IDs and amounts, offers, reports, disputes, fraud/risk signals, admin annotations and promotion/payment data are never returned. A missing trust document becomes a neutral new-seller summary with zero completed sales, no rating and no tier; the client does not infer or award trust. A missing public user profile is omitted. Seller rating is displayed only when at least one published review exists.

The web client coalesces seller requests from listing cards in the same microtask, de-duplicates IDs, chunks at 40 and caches the sanitized result for five minutes. This makes Explore, search, categories, Auctions, For You and Saved use one bounded request for normal 10/20/40-item result sets, with no per-card Firestore reads, realtime listeners or recursive fetching. Failure is optional-data-safe: listings remain browsable and the trust row is omitted (or reports unavailable on detail).

There is no new Firestore collection, index, migration or production backfill in Phase 10.5. The callable joins the current records on every request, so there is no second projection to synchronize; its web cache expires after five minutes. `trustSummaries` remains server-maintained and is updated only by trusted completion and published-review flows. If a summary is ever suspected to be stale, a privileged repair can recompute role completion totals from completed transactions and rating aggregates from released public reviews, then replace that summary; neither the discovery callable nor a client can perform the repair. Paid boost/featured placement remains visually and logically separate and cannot alter any projected trust field. Public seller profiles continue to render buyer and seller reputation as separately labelled role cards, while discovery projects only the seller role. `/help/tiers` remains the canonical tier explanation for web and future Flutter clients.
