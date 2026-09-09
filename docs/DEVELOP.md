===========
How to continue development, and what's planned for future work.


1. IMMEDIATE NEXT STEPS (completes current scope)
-----------------------------------------------------

a) Paliz callback controller
   - Add an endpoint matching the callback URL already built into
     PalizPaymentService.createTransfer():
       {APP_BASE_URL}/payments/paliz/callback/:paymentId
   - Should verify the callback payload (check Paliz docs for
     signature/auth requirements), load the Payment by :paymentId,
     and move it from AWAITING/PENDING state to SUCCESS/FAILED —
     replacing (or backing up) the current polling-based
     getTransferInfo-after-1500ms approach in handleWalletPayment.

b) Shepa (gateway) callback controller
   - Add an endpoint matching:
       {APP_BASE_URL}/payments/gateway/callback/:paymentId
   - Verify payload against Shepa's callback contract, mark Payment
     AWAITING_GATEWAY -> SUCCESS/FAILED, update Invoice status
     accordingly.

c) Invoice fulfillment endpoint
   - POST endpoint to transition Invoice from NOT_FULFILLED to
     FULFILLED after payment SUCCESS is confirmed.
   - Should be idempotent — calling it twice on an already-fulfilled
     invoice should be a no-op, not an error.

d) Refund endpoint
   - [TBD: confirm whether refunds go back through Paliz
     (cancelTransfer / a dedicated refund action) or are gateway-side
     (Shepa refund API) or both, depending on original payment
     method.]
   - Should record a new PalizTransfer / gateway record rather than
     mutating the original payment record, to preserve the audit
     trail.

e) Demo wallet seeding endpoint
   - For test/demo environments only — should be disabled or guarded
     behind an environment check (e.g. only available when
     NODE_ENV !== 'production') to avoid accidental use in prod.

f) GET /invoices/:id/payment-options
   - Returns which of WALLET / GATEWAY / COMBINED are valid for the
     given invoice, based on current wallet balance vs invoice
     amount — essentially exposing validatePaymentMethod's logic as
     a pre-check the client can call before letting the user choose.


2. FOLLOW-UP / HARDENING (after immediate scope)
-----------------------------------------------------

a) Reconciliation job for Paliz transfers
   - PalizPaymentService.reconcile() already exists as a starting
     point but isn't wired to anything.
   - Add a scheduled job (NestJS @Cron or a queue worker) that finds
     PalizTransfer rows stuck in PENDING/UNKNOWN beyond a threshold
     (e.g. 5 minutes) and calls reconcile() to resolve them via
     getTransferInfo, rather than leaving them unresolved
     indefinitely.

b) Bring Paliz audit trail into the payment DB transaction
   - See DESIGN.txt section 5/8 — PalizTransferService currently
     writes outside PaymentOrchestratorService's transaction. Either:
       (i) pass the transactional EntityManager through
           PalizPaymentService -> PalizTransferService, or
       (ii) explicitly accept eventual consistency and build the
           reconciliation job (2a) to handle the gap.
   - Decide and document which approach is intentional.

c) Retry policy for not_delivered failures
   - PalizRequestFailedException already distinguishes
     not_delivered / unknown / rejected. Add an actual retry
     strategy (e.g. exponential backoff, max attempts) for the
     not_delivered case specifically, since that's the one case
     that's unambiguously safe to retry automatically.

d) Reduce console.log verbosity in production
   - The orchestrator currently logs extensively via console.log for
     debugging. Consider moving to NestJS Logger with log levels, and
     gating verbose logs behind NODE_ENV/LOG_LEVEL.

e) Tests
   - [TBD: current test coverage — add unit tests for
     PaymentOrchestratorService's amount-calculation and validation
     logic, and for PalizCallCounterService's concurrent-increment
     behavior specifically, since that's the highest-risk race
     condition in the system.]


3. FUTURE / LONGER-TERM (beyond current scope)
----------------------------------------------------
[TBD — list anything discussed but not yet started, e.g.:
  - Multi-currency support
  - Admin dashboard / reporting on payments and Paliz call volume
  - Support for additional payment gateways beyond Shepa
  - Rate-limit-aware backoff (using service_call_counters data)
  - Webhook signature verification hardening
]


4. HOW TO PICK UP WORK
--------------------------
- Start from DONE.txt to see what's implemented vs outstanding.
- Read DESIGN.txt for the architecture and the two known gaps
  (transaction boundary, callback vs polling).
- Any new Paliz-facing logic should go through PalizPaymentService,
  not PalizWalletService directly — this keeps the audit trail and
  sequence_id handling consistent.
- Any new endpoint that changes Payment/Invoice state should follow
  the existing pattern in PaymentOrchestratorService: lock rows,
  validate state, act, save within a single transaction.
