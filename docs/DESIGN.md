==========
Architecture and design overview of the wallet/payment service.


1. OVERVIEW
------------
Backend service (NestJS + TypeORM + PostgreSQL) that lets a user pay
an invoice using one of three methods, chosen explicitly by the user:

  - WALLET    — pay entirely from an internal wallet balance
  - GATEWAY   — pay entirely via an external card gateway (Shepa)
  - COMBINED  — pay partly from wallet, partly via gateway

The service integrates with two external providers:
  - Paliz  — internal wallet transfer service (create/commit/cancel
             transfers, check balance, get transfer info)
  - Shepa  — card-based payment gateway (create payment request,
             redirect user, receive callback)


2. HIGH-LEVEL FLOW
--------------------
1. Client calls PaymentOrchestratorService.pay(invoiceId, method).
2. Invoice is loaded and validated (must be UNPAID).
3. Wallet balance is refreshed from source of truth before any
   amount calculation.
4. A DB transaction is opened; invoice and wallet rows are locked
   with pessimistic_write to prevent concurrent payment attempts on
   the same invoice/wallet from racing each other.
5. Wallet/gateway amounts are computed based on the selected method
   and current wallet balance.
6. A Payment row is created (or an existing one reused, to support
   idempotent retries of the same invoice/method).
7. Depending on method, one of three private handlers runs:
     - handleWalletPayment
     - handleCombinedPayment
     - handleGatewayPayment


3. PAYMENT METHOD DESIGN DECISION
------------------------------------
Payment method is user-selected, not inferred by the backend (e.g.
not "auto-use wallet if there's enough balance"). This keeps payment
intent explicit and auditable, and avoids surprising the user by
silently draining their wallet when they expected to pay by card.

validatePaymentMethod() rejects impossible combinations, e.g.
selecting WALLET without enough balance, or COMBINED when the whole
amount could be covered by one method alone.


4. INVOICE / PAYMENT STATE MACHINE
--------------------------------------
Invoice: UNPAID -> PAID (on successful payment)
         [TBD: PAID -> NOT_FULFILLED -> FULFILLED — describe exact
         enum values and transitions once fulfillment endpoint exists]

Payment: INITIATED -> WALLET_RESERVED (combined only)
                    -> AWAITING_GATEWAY (gateway/combined)
                    -> SUCCESS / FAILED
                    -> REFUNDED [TBD once refund endpoint exists]

Key decision: a successfully paid invoice is NOT immediately marked
as fully fulfilled — payment success and fulfillment are separate
concerns, allowing fulfillment to fail/retry independently of
payment.


5. PALIZ INTEGRATION DESIGN
-------------------------------
PalizWalletService
  - Pure HTTP client. Knows how to build/encrypt/send create, commit,
    cancel, info, and balance requests. No business state, no DB
    access.
  - Every outbound call goes through a single private post() method,
    so error classification (see below) is centralized.
  - Distinguishes three failure modes on every call, since each
    implies different recovery behavior:
      * not_delivered — request never reached Paliz; safe to retry
        with a fresh sequence_id.
      * unknown       — request was sent but no response was
        received (timeout/connection reset); Paliz MAY have
        processed it. Must be reconciled via getTransferInfo before
        retrying, never blindly retried.
      * rejected       — Paliz responded with an explicit error;
        inspect the response body before deciding whether to retry.

PalizCallCounterService
  - Generates sequence_id values, one atomic upsert per call
    (INSERT ... ON CONFLICT DO UPDATE ... RETURNING count), scoped
    per serviceId. Avoids the classic read-increment-write race.
  - sequence_id is never reused or rolled back on failure — gaps are
    acceptable, reuse is not (reuse risks Paliz treating two distinct
    attempts as the same request).

PalizTransferService
  - Persists an audit trail of every Paliz call attempt, written as
    PENDING *before* the HTTP call is made (not after), so that a
    crash or timeout mid-call still leaves a traceable record to
    reconcile against, instead of a silent gap.
  - Status transitions: PENDING -> DELIVERED / FAILED / UNKNOWN.

PalizPaymentService
  - Orchestration layer: generates unique_id/sequence_id, writes the
    pending record, calls PalizWalletService, updates the record
    based on outcome. This is the only entry point
    PaymentOrchestratorService should use for Paliz operations (as
    opposed to calling PalizWalletService directly).

[TBD / KNOWN GAP: PalizTransferService currently writes via its own
injected repository, not the EntityManager passed into
PaymentOrchestratorService's DB transaction. This means Paliz audit
records are NOT part of the same atomic transaction as
invoice/payment/wallet updates. If the outer transaction rolls back,
the Paliz audit row can remain committed. This should be revisited —
either by passing the transactional EntityManager through, or by
accepting eventual-consistency between the audit trail and the core
payment state and building reconciliation around that.]


6. MODULE BOUNDARIES
-----------------------
PalizWalletModule
  - Owns: PalizWalletService, PalizEncryptionService,
    PalizCallCounterService, PalizTransferService.
  - Exports what's needed by consumers (PalizWalletService,
    PalizCallCounterService, PalizTransferService).

PaymentsModule
  - Owns: PaymentOrchestratorService, PalizPaymentService.
  - Imports PalizWalletModule to get access to the above.
  - [TBD: confirm final boundary — consider moving PalizPaymentService
    into PalizWalletModule itself, so PaymentsModule only depends on
    one exported service instead of three.]

PaymentGateway (Shepa)
  - Abstracted behind a PaymentGateway interface + PAYMENT_GATEWAY
    injection token, so the orchestrator does not depend on Shepa
    concretely. Allows swapping/adding gateway providers later
    without touching PaymentOrchestratorService.


7. CONCURRENCY / SAFETY
---------------------------
- Pessimistic row locks on Invoice and Wallet during payment
  processing prevent two concurrent requests from double-spending the
  same wallet balance or double-processing the same invoice.
- sequence_id generation is atomic at the DB level, safe under
  concurrent Paliz calls for the same serviceId.
- Idempotency: Payment lookup by invoiceId lets pay() be called
  again safely for the same invoice — an existing SUCCESS or
  AWAITING_GATEWAY payment is returned as-is rather than
  reprocessed.


8. KNOWN LIMITATIONS (see DEVELOP.txt for planned follow-ups)
-----------------------------------------------------------------
- No background reconciliation job yet for PENDING/UNKNOWN Paliz
  transfers.
- Paliz callback and Shepa callback controllers not yet implemented;
  the WALLET flow currently polls getTransferInfo after a fixed
  1500ms sleep rather than reacting to a callback.
- Paliz audit trail not part of the core payment DB transaction (see
  section 5).
