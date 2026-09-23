# TAKEME protected transaction architecture

> **REAL PAYMENT MOVEMENT NOT ENABLED**

Phase 11 is production-oriented architecture, not a payment launch. The code cannot create a payment, connected account, payout, refund, or verified webhook event. No Stripe SDK or credential is present. Changing `PROTECTED_PAYMENTS_ENABLED` cannot activate the stub because `implementationReady` and runtime `enabled` remain false.

## Standard and protected settlement

The existing transaction is the marketplace agreement. It keeps the existing `in_progress`, `completed`, `cancelled`, and `disputed` lifecycle, amount in integer MYR sen, buyer, seller, listing, source, review window, and reputation behavior.

- `settlementMode=standard`: COD, bank transfer, external payment, or other. TAKEME records an agreement, not processed payment. Two-party confirmation remains the only completion path.
- `settlementMode=protected`: future provider-backed settlement. Payment, payout, fulfilment, refund, and dispute state are independent records. Mutual standard confirmation is blocked. Only a future provider-aware server operation may complete after its policy is satisfied.
- Existing records without `settlementMode` are read as `standard`; no backfill is needed.

`paymentStatus` does not set `transaction.status`. A successful payment is not a payout, fulfilment, completion, GMV event, review entitlement, or reputation credit. A completed transaction also does not by itself prove seller payout.

## Provider boundary

`functions/src/payments/payment-provider.ts` defines the replaceable `PaymentProvider` contract:

- create and retrieve protected payment;
- create and retrieve seller onboarding;
- release an eligible payout;
- create and retrieve a refund;
- verify a provider webhook event.

`StripeConnectProvider` is the intended first implementation but is deliberately non-operational. Every method throws `PaymentProviderDisabledError`; no network call can occur. The transaction domain depends on the provider contract and normalized states, not Stripe event names. A future provider can implement the same contract without changing marketplace transaction semantics.

## Firestore model and authority

| Path | Key fields | Authority |
| --- | --- | --- |
| `transactions/{transactionId}` | `settlementMode`, `paymentProvider`, existing agreement/status fields | Functions only for writes |
| `protectedPayments/{transactionId}` | provider, status, protected amount, `MYR`, optional fee/net amounts, reference and timestamps | Provider-aware server only |
| `payouts/{transactionId}` | status, amount in sen, reference, eligibility/paid timestamps | Provider-aware server only |
| `refunds/{refundId}` | transaction/payment/dispute references, amount in sen, actor, reason, status, reference, timestamps | Provider-aware server only |
| `sellerPaymentProfiles/{uid}` | onboarding status, provider, private account reference, capability flags, requirements | Provider-aware server only |
| `transactionDisputes/{transactionId}` | parties, reason/description, state, response, resolution, refund amount, internal notes | Server only; narrow participant actions |
| `transactionDisputes/{transactionId}/evidence/{id}` | participant role, note, timestamp | Server-created through callable |
| `transactionEvents/{deterministicId}` | event, actor, timestamp, safe metadata, optional provider reference | Server only and immutable |
| `paymentProviderEvents/{providerEventId}` | future verified-event receipt and processing result | Server only; reserved for deduplication |

Participants read a minimal projection from `getTransactionDetail`. Provider references and internal notes are omitted. Admins use a claim-gated read-only projection that may include operational provider references and internal notes. Direct Firestore reads and all writes are denied for every protected collection. Card numbers, CVV, bank credentials, provider secrets, and webhook signing secrets must never enter Firestore.

## State machines

Payment transitions are server-only and idempotent when the current and requested state match:

| From | Allowed next states |
| --- | --- |
| `pending` | `requires_action`, `authorized`, `failed`, `cancelled` |
| `requires_action` | `authorized`, `failed`, `cancelled` |
| `authorized` | `protected`, `failed`, `cancelled` |
| `protected` | `released`, `partially_refunded`, `refunded` |
| `partially_refunded` | `released`, `refunded` |
| `failed` | `pending` |
| `released` | `partially_refunded`, `refunded` |
| `not_required`, `refunded`, `cancelled` | terminal |

Payout transitions:

| From | Allowed next states |
| --- | --- |
| `not_eligible` | `eligible` |
| `eligible` | `processing` |
| `processing` | `paid`, `failed` |
| `failed` | `processing` |
| `paid` | `reversed` |
| `reversed` | terminal |

A future eligibility command must confirm buyer receipt or approved fulfilment, payment protection, no unresolved dispute, seller onboarding, and server policy. A retry with the same logical key may observe the existing result but cannot issue a second payout.

Refund transitions:

| From | Allowed next states |
| --- | --- |
| `none` | `requested` |
| `requested` | `pending`, `approved`, `cancelled` |
| `pending` | `approved`, `processing`, `failed`, `cancelled` |
| `approved` | `processing`, `cancelled` |
| `processing` | `refunded`, `partially_refunded`, `failed` |
| `failed` | `processing`, `cancelled` |
| `partially_refunded` | `requested`, `processing`, `refunded` |
| `refunded`, `cancelled` | terminal |

Each refund amount is a positive safe integer in sen, and cumulative refunds may not exceed the protected amount. The client never supplies an authoritative amount. Phase 11 performs no refund operation.

## Seller onboarding

Marketplace identity and provider identity are separate. A private seller payment profile can be `not_started`, `pending`, `restricted`, `active`, or `disabled`, with independent `chargesEnabled`, `payoutsEnabled`, and provider requirements. Public seller profiles and discovery never expose these fields or a provider account reference. The seller UI currently says “Protected payments are not enabled yet” and never implies that onboarding was completed.

## Disputes, evidence, and audit

Protected disputes extend the current transaction dispute path rather than competing with it. Only the buyer may open an eligible protected dispute; the transaction becomes `disputed`, blocking completion and reviews. The seller may submit one response while `awaiting_seller`. Either participant may add evidence notes while the dispute is open. Duplicate open, response, and evidence requests return the existing logical result where safe.

States are `open`, `awaiting_buyer`, `awaiting_seller`, `under_review`, `resolved_buyer`, `resolved_seller`, `partially_resolved`, and `cancelled`. Resolution, refund amount, resolver, and internal notes require a future admin/server workflow. No automatic resolution is implemented.

Audit IDs are SHA-256 hashes of transaction, event type, and idempotency key. Firestore `create` makes a duplicate event fail instead of overwriting history. Events include only necessary actor and safe metadata. Participant projections exclude provider references and internal notes.

## Future webhook processing

No webhook HTTP endpoint exists in Phase 11. A production implementation must:

1. read the raw request body and verify the Stripe signature with a secret held only in managed server configuration;
2. normalize the provider event through `PaymentProvider.verifyWebhook`;
3. create `paymentProviderEvents/{providerEventId}` transactionally before applying effects;
4. resolve internal records by a server-recorded provider reference, never client input;
5. validate current state and tolerate reordered events by retrieving provider truth when necessary;
6. update domain state and append the deterministic audit event atomically where possible;
7. mark the receipt processed only after the domain transaction succeeds;
8. return success for an already-processed event and leave retryable failures visible without partial effects.

Retries, timeouts, concurrent calls, and stale clients must use stable idempotency keys. Provider idempotency and the Firestore operation ledger are both required for every future money-moving command. Completion and reputation credit retain their existing deterministic transaction/event protections and must occur once.

## GMV and accounting

GMV remains the sum of legitimate `transactions.amountSen` records whose server-owned status is `completed`. Attempts, pending or failed payments, protected funds, unsettled payouts, unresolved disputes, cancelled transactions, bids, listing prices, and promotion spend are excluded. The protected completion predicate requires payment `released`, payout `paid`, fulfilment `received`, and no unresolved dispute; there is no callable that performs this transition in Phase 11.

Current reporting is **gross completed agreement value**. If a legitimate completion were later partially refunded, the completed amount would remain in gross GMV; no net GMV, refund deduction, revenue, balance, or accounting ledger is claimed. Before launch, finance and product must choose and separately implement net-of-refund reporting rather than silently changing this definition.

## UI and legal language

The buyer sees Standard selected and a disabled “TAKEME Protected Transaction” choice with “Protected payments coming soon”; there is no “Pay now” action. Transaction detail renders only actual audit/state records. Seller onboarding and admin financial actions are read-only or disabled.

Use: “Protected transactions are designed to support eligible purchases and disputes under TAKEME’s applicable terms.” Do not describe the feature as escrow, insurance, guaranteed protection, or a guaranteed refund. Eligibility, fees, payout timing, refund/dispute policy, and final terms require legal and product approval.

## Production prerequisites

- legal review of protection, refunds, disputes, seller obligations, fees, payout timing, privacy, chargebacks, prohibited goods, and support wording;
- approved Stripe Connect account/business model and Malaysia availability review;
- secret-manager configuration, key rotation, least-privilege service identity, and verified raw-body webhook endpoint;
- completed provider implementation with provider plus Firestore idempotency, dedupe, ordering, retry, reconciliation, and alerting;
- seller KYC/onboarding UX and secure account-link handling;
- fulfilment, receipt confirmation, dispute-review, refund, chargeback, reversal, and payout operations;
- App Check/rate limits, fraud controls, support runbooks, audit retention, privacy/PDPA review, and incident response;
- accounting decisions for fees, taxes, partial refunds, reversals, gross versus net GMV, and reconciliation;
- test-mode end-to-end certification, concurrency tests, rules/index review, staging rollout, monitoring, and rollback plan;
- explicit production approval before enabling any flag, deploying a webhook, or accepting money.
