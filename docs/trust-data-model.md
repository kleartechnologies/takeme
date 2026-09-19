# Phase 5 trust data model

`listings/{listingId}` remains the canonical item and `users/{uid}` remains a public-only profile. Firebase Auth owns private account identity. No payment, transaction creation, reputation calculation, or production messaging UI is enabled in this phase.

| Path | Ownership and reads | Writes | Query/index plan |
| --- | --- | --- | --- |
| `users/{uid}/saved/{listingId}` | Owner only. Document ID prevents duplicate saves. | Owner creates an immutable `{listingId, savedAt}` for an active listing or deletes it. | `savedAt DESC`, 10–12 per page; automatic single-field index. Resolve only that page's listing documents. |
| `users/{uid}` | Public profile fields only: name, photo, general location, timestamps. | Owner edits allowed public fields; Auth sign-in never rewrites an existing profile. | Direct document lookup; no private email or reputation totals. |
| `transactions/{id}` | Buyer, seller, and trusted server only. | Trusted server only; clients cannot create, complete, cancel, or change amounts. | Participant-scoped history in a later phase; no history query yet. |
| `transactions/{id}/reviews/{reviewerUid}` | Transaction participants only until public aggregation exists. | One immutable review per participant after server-recorded completion, with exact counterparty, rating, comment and server time. | Direct per-transaction lookup or bounded subcollection page; no aggregate scan for rating. |
| `trustSummaries/{uid}` | Public when one exists. | Trusted server only. Verification, earned reputation, and paid promotion are separate concepts. | Direct lookup; no summary is seeded or displayed without evidence. |
| `conversations/{listingId}_{buyerUid}` | Buyer and seller only. | Buyer creates a unique listing-bound conversation. Client metadata updates are disabled until a trusted fan-out service maintains latest-message/unread state. | `participants ARRAY_CONTAINS` + `updatedAt DESC` for future bounded inbox. |
| `conversations/{id}/messages/{id}` | Conversation participants only. | Participant creates immutable sender-owned messages. | `createdAt DESC` for bounded message pages; automatic single-field index. |
| `reports/{id}` | Reporter and trusted moderator only. | Signed-in reporter submits one immutable controlled-reason report with initial status; only trusted server can change moderation status. | Reporter history, if later needed, requires a composite index. |

All monetary transaction amounts use integer sen and currency `MYR`. A transaction can move from `pending` to `completed` or `cancelled` only through a future trusted server workflow. Auction end or an offline promise is **not** completion. A review is valid only after a `completed` transaction and does not itself grant a badge. Future reputation thresholds live in one policy module and remain disabled until verified aggregates and product criteria are available. Paid promotion will never write verification or reputation fields.

The web service contracts use IDs, timestamps, bounded pages and explicit states that can be implemented with the Firebase Flutter SDK without copying HTML or CSS behavior. Rules are the common security boundary for both clients. No new profile Storage path is needed: the existing owner-only `users/{uid}/profile/` path is reused.
