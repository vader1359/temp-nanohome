# Checkout Payment Foundation Handoff

## Delivered in Checkout Lane

- Provider-neutral payment contracts and an explicit `PAYMENT_MODE` model with
  safe default behavior represented by `"off"`.
- Pure SePay hosted-checkout request construction. It produces a signed form
  request only; it has no transport and makes no provider call.
- Strict SePay IPN parsing and verification fixtures: constant-time secret
  comparison, allowlisted `ORDER_PAID`/`CAPTURED`/`APPROVED` status binding,
  immutable invoice/amount/currency matching, and delayed-delivery marking.
- Pure idempotent payment-event state transitions: repeat event IDs are
  idempotent, conflicting duplicates move to manual review, and terminal paid
  state cannot regress through cancellation.
- Off-mode payment creation, reconciliation, and cancellation policies that
  invoke no gateway operation. Manual refund intent is auditable and requires
  distinct requester and approver identities plus evidence.
- Commerce paid-state transitions now require provider-neutral branded verified
  payment evidence. Legacy ZaloPay implementation remains disconnected for
  compatibility and is not activated by this work.

No routes, database migrations, environment schemas, generated database types,
lockfiles, external provider calls, AMIS work, deployments, or identity/RLS
changes were made.

## Foundation-Owned Prerequisites

Before creating checkout payment/IPN/status/cancellation routes or enabling
`PAYMENT_MODE`, Foundation must supply:

1. A forward-only provider-neutral payment schema: immutable order snapshot,
   payment attempt, provider event idempotency key, quarantine/conflict record,
   append-only audit ledger, refund-intent evidence, and an outbox.
2. Transactional repository operations that lock the attempt and order, dedupe
   identical provider events, quarantine conflicting replays, apply monotonic
   state transitions, and commit ledger/outbox before an IPN returns HTTP 200.
3. Typed server-only environment validation. `PAYMENT_MODE` must migrate from
   the fixture's `off|enabled` model to `off|sepay_sandbox|sepay_primary`,
   default to `off`, and validate `SEPAY_ENV`, merchant identifier, checkout
   signing secret, and IPN secret. Do not expose these to the browser.
4. Authenticated owner/order authorization and a durable status projection for
   `/api/orders/[orderId]/payment-status`; browser redirect/departure is neither
   payment proof nor cancellation, and redirect handlers must never mark an
   order paid.
5. A scheduler/worker and operational runbook for reconciliation, delayed IPNs,
   timeout/cancellation handling, manual refund execution, alerts, rollback
   conditions, and the production kill switch.

## Activation Gate

Keep `PAYMENT_MODE=off` until the prerequisites are delivered, transactional
integration tests pass against the durable repository, and a non-production
merchant test validates callback replay, wrong secret, wrong amount/reference,
delayed notification, cancellation, reconciliation, and manual refund evidence.
