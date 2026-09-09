========
Summary of work completed over the last 3 days, and what remains.


COMPLETED
---------

1. PaymentOrchestratorService
   - Replaced the old PaymentsService after identifying critical bugs:
     missing balance checks, race conditions, premature invoice status
     updates, and non-deterministic idempotency keys.
   - Implemented three user-selected payment flows:
       * WALLET   — pay fully from internal wallet balance
       * GATEWAY  — pay fully via Shepa payment gateway
       * COMBINED — split between wallet + gateway
   - Payment method is explicitly user-selected, not auto-determined
     by the backend.
   - Wraps invoice + wallet + payment state changes in a single DB
     transaction with pessimistic row locks (invoice, wallet) to
     prevent race conditions on concurrent payment attempts.
   - Successfully paid invoices are set to NOT_FULFILLED (not PAID)
     until fulfillment is explicitly triggered — decouples "paid" from
     "fulfilled."

2. Paliz wallet integration
   - PalizWalletService: thin HTTP client for Paliz's create / commit /
     cancel / info / balance actions. Handles payload encryption via
     PalizEncryptionService and Basic Auth.
   - PalizCallCounterService: atomic, race-safe sequence_id generator
     per serviceId, backed by Postgres (INSERT ... ON CONFLICT DO
     UPDATE ... RETURNING), avoiding the read-then-write race present
     in early drafts.
   - PalizTransferService: persists an audit trail of every Paliz call
     (PENDING -> DELIVERED / FAILED / UNKNOWN) keyed by paymentId, so
     create/commit/cancel calls can be traced and reconciled.
   - PalizPaymentService: orchestration layer tying the above together
     — generates unique_id/sequence_id, records pending state before
     calling Paliz, updates status after.
   - Fixed a payload bug where sequence_id was sent as a string;
     Paliz's API requires it as an integer.
   - Explicit delivery-status handling (not_delivered / unknown /
     rejected) via PalizRequestFailedException, so failed calls can be
     told apart from calls that reached Paliz but got no response.

3. TypeScript / TypeORM fixes
   - Retyped bigint columns as string across entities (Payment,
     Wallet, ServiceCallCounter) to avoid precision loss.
   - Fixed `import type` usage for the PaymentGateway interface under
     isolatedModules + emitDecoratorMetadata.
   - Fixed several NestJS DI wiring errors (missing @InjectRepository,
     missing TypeOrmModule.forFeature registrations, missing module
     exports/imports between PalizWalletModule and PaymentsModule).

4. Database
   - Migration for all DB changes.


NOT DONE / REMAINING
---------------------

- Gateway (Shepa) callback controller — endpoint to receive and
  process Shepa's payment confirmation callback.
- Paliz callback controller — endpoint to receive Paliz's async
  callback (separate from the polling-based INFO check currently
  used in the WALLET flow).
- Invoice fulfillment endpoint — marks an invoice NOT_FULFILLED ->
  FULFILLED after successful payment.
- Refund endpoint.
- Demo wallet seeding endpoint (for testing/demo environments).
- GET /invoices/:id/payment-options endpoint (returns which payment
  methods are available/valid for a given invoice, e.g. based on
  wallet balance).
- Reconciliation job for Paliz transfers stuck in PENDING/UNKNOWN
  status (started as PalizPaymentService.reconcile(), not wired to a
  scheduler yet).
- [TBD: add/remove items here to match your actual current state]
