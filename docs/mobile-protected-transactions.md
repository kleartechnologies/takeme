# Mobile protected transactions contract

> **REAL PAYMENT MOVEMENT NOT ENABLED**

This platform-neutral contract lets a future Flutter client represent protected transactions without Stripe-specific types or client-authoritative financial state. The app calls the same regional Firebase callables as web. It never writes transaction, payment, payout, refund, onboarding, dispute-resolution, or audit documents directly.

## Read models

`MarketplaceTransaction` adds:

- `settlementMode`: `standard | protected` (missing historical value is `standard`);
- `paymentProvider`: `none | stripe_connect`;
- existing transaction identity, amount/currency, status, confirmation, cancellation, completion, and review fields.

Protected detail returns separate optional objects:

- payment: provider, status, protected amount in sen, `MYR`, optional fee/net amounts, and public-safe lifecycle timestamps;
- payout: status, optional amount in sen, eligibility and paid timestamps;
- refunds: opaque ID, status, amount in sen, reason, request/refund timestamps;
- dispute: status, reason/description, opener, timestamps, seller response, public resolution/refund amount, and participant evidence;
- timeline: opaque ID, normalized event type, actor role/type, timestamp, and safe metadata.

Provider references, seller connected-account references, internal notes, webhook receipts, credentials, and raw provider payloads are absent from participant DTOs.

## Enumerations

- Transaction: `in_progress | completed | cancelled | disputed`.
- Payment: `not_required | pending | requires_action | authorized | protected | failed | refunded | partially_refunded | released | cancelled`.
- Payout: `not_eligible | eligible | processing | paid | failed | reversed`.
- Refund: `none | requested | pending | approved | processing | refunded | failed | partially_refunded | cancelled`.
- Seller onboarding: `not_started | pending | restricted | active | disabled`.
- Dispute: `open | awaiting_buyer | awaiting_seller | under_review | resolved_buyer | resolved_seller | partially_resolved | cancelled`.

Clients must preserve unknown-value fallbacks and refresh from the server after every command. They must not infer a later state, invent a progress percentage, or treat payment success as completion.

## Commands and disabled behavior

- `getProtectedPaymentPolicy` is public and currently returns `enabled=false`, provider ID, implementation readiness, honest product copy, and non-guarantee wording.
- `getSellerPaymentOnboarding` requires authentication and returns only the current seller’s sanitized state. It currently reports that protected payments are disabled.
- `createProtectedPayment` requires the buyer but always returns a failed-precondition while the provider is disabled; it creates no record.
- `disputeTransaction` opens an eligible protected dispute for the buyer through the existing transaction command.
- `respondToProtectedDispute` accepts one seller response in the expected state.
- `addProtectedDisputeEvidence` accepts a participant note plus a client-generated stable idempotency key; retry the same key after an uncertain result.
- `getTransactionDetail` requires a participant and returns the safe aggregate DTO.

There is no mobile checkout, onboarding launch, payout, refund, resolution, or money-moving command in Phase 11.

## Screen behavior

Payment selection shows Standard as active. Protected is visibly disabled with “Protected payments coming soon” and concise non-guarantee language; never label the action “Pay now”. Seller settings show the sanitized onboarding state and never display a provider account reference.

Transaction detail branches on `settlementMode`:

- standard: agreement, real confirmation timestamps, completion/cancellation/dispute state, then review eligibility;
- protected: independent payment and payout cards, real refund/dispute records, and server audit events in timestamp order;
- disputed protected: issue, seller response, participant evidence, and actual review/resolution state only.

Loading, auth-required, unavailable, empty timeline, disabled, retry, and error states are first-class. Touch targets are at least 44 logical pixels. The client must not optimistically show a protected financial state. Accessibility labels should announce normalized state and timestamp, not only color.

## Idempotency, offline, and refresh

Money-related mutations are future server concerns. Mobile supplies a stable request key per logical action and reuses it after timeouts; it never generates a new key just to retry. The server remains authoritative under duplicate taps, background retries, concurrency, and reordered webhooks. After reconnection, discard inferred state and fetch detail again. Cache may render the last known state only when clearly marked stale.

## Security and analytics

All amounts are safe integer sen with explicit `MYR`; never calculate authoritative fees or refund limits in Flutter. Do not log DTOs containing dispute text, evidence, provider references, or personal data to third-party analytics. GMV, reputation, and review eligibility are server-derived. A protected attempt, authorisation, failed payment, unresolved dispute, or payout state never becomes client-computed GMV.

The production application must use final, legally approved terms. Product copy must not promise escrow, insurance, guaranteed refunds, guaranteed seller protection, or guaranteed payment protection.
