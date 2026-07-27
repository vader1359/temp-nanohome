# Checkout Payment Foundation Handoff

## Delivered in Checkout Lane

### Payment Contracts and Business Logic

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

### Route Scaffolds (Foundation-Gated)

All routes return HTTP 501/503 until Foundation delivers the prerequisites:

- `POST /api/payments/sepay/ipn` — IPN endpoint with secret validation and mode guard
- `POST /api/orders/[orderId]/payments/sepay` — Create signed payment request
- `GET /api/orders/[orderId]/payment-status` — Owner-scoped state projection
- `GET /[locale]/checkout/sepay/success` — Query server state, never trust redirect params
- `GET /[locale]/checkout/sepay/error` — Display error with retry option
- `GET /[locale]/checkout/sepay/cancel` — Display cancellation with retry option

No database migrations, environment schemas, generated database types,
lockfiles, external provider calls, AMIS work, deployments, or identity/RLS
changes were made.

### Local Checkout Cleanup (2026-07-27)

- Removed deprecated ZaloPay/VNPAY disabled cards from
  `src/components/checkout/checkout-page.tsx`; off-mode checkout now presents
  unavailable payment copy only. `src/components/zalo-widget.tsx` remains
  untouched, preserving Zalo OA chat.
- Removed `zaloPayRequested` and
  `FILLOUT_CART_QUESTION_ZALOPAY_REQUESTED_ID` from cart submission parsing,
  validation, and Fillout payload assembly. VNPAY remains because this lane
  only owned ZaloPay removal.
- Updated SePay dynamic route handlers for Next 16 asynchronous `params`:
  `POST /api/orders/[orderId]/payments/sepay` and
  `GET /api/orders/[orderId]/payment-status` now await route params.
- Source audit found no ZaloPay translation or analytics references to remove.

**Verification:**
- `npm test -- src/app/api/cart/submit/route.test.ts --run` — 15/15 passed
- `npm test -- src/lib/payments src/app/api/cart/submit/route.test.ts --run` — passed
- `npx tsc --noEmit` — passed
- `npm run build` — passed after asynchronous-route-param fix

**Rollback:** revert Checkout cleanup commits independently; revert `dc3d3c9`
to remove Foundation-gated SePay route scaffolds. Keep `PAYMENT_MODE=off`.

**Still blocked:** production behavior needs Foundation schema/types, validated
server-only environment, transactional repositories, owner cookie resolution,
reconciliation worker, refund approvals, and monitoring. No live SePay or AMIS
call was made.


## Foundation-Owned Prerequisites

Foundation must deliver before Checkout can activate payment routes:

### 1. Database Schema (Forward Migration)

```sql
-- payment_attempts: immutable payment requests
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  merchant_reference text NOT NULL,
  provider text NOT NULL, -- 'sepay'
  provider_order_id text,
  provider_transaction_id text,
  payment_method text,
  amount integer NOT NULL,
  currency text NOT NULL,
  state text NOT NULL, -- 'awaiting_customer' | 'paid' | 'customer_left' | 'manual_review'
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  request_digest text,
  response_digest text,
  UNIQUE(merchant_reference, provider)
);

-- payment_events: append-only event log with idempotency
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES payment_attempts(id),
  provider_event_id text NOT NULL,
  provider_transaction_id text NOT NULL,
  event_type text NOT NULL, -- 'payment_verified' | 'payment_cancelled'
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_digest text NOT NULL,
  verification_result text NOT NULL,
  transition_decision text NOT NULL,
  delayed boolean NOT NULL DEFAULT false,
  UNIQUE(attempt_id, provider_event_id)
);

-- payment_reconciliations: server-to-server query log
CREATE TABLE payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES payment_attempts(id),
  queried_at timestamptz NOT NULL DEFAULT now(),
  provider_status text,
  response_digest text,
  decision text NOT NULL
);

-- refund_operations: audited manual refunds
CREATE TABLE refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  payment_attempt_id uuid REFERENCES payment_attempts(id),
  method text NOT NULL, -- 'manual_bank_transfer' | 'provider_void'
  state text NOT NULL, -- 'requested' | 'approved' | 'completed'
  amount integer NOT NULL,
  reason text NOT NULL,
  requester_id uuid NOT NULL,
  approver_id uuid,
  evidence_reference text,
  evidence_digest text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz
);
```

**RLS Requirements:**
- `payment_attempts`: owner-scoped reads via `orders.owner_id`
- `payment_events`: no direct user access
- `payment_reconciliations`: no direct user access
- `refund_operations`: admin-only

**Generated Types:**
After migration, regenerate `src/types/database.types.ts`

### 2. Environment Schema (`src/lib/env.ts`)

```typescript
// Update PAYMENT_MODE from 'off|enabled' to:
PAYMENT_MODE: z.enum(["off", "sepay_sandbox", "sepay_primary"]).default("off")

// Add SePay environment variables (server-only):
SEPAY_ENV: z.enum(["sandbox", "production"]).optional()
SEPAY_MERCHANT_ID: z.string().min(1).optional()
SEPAY_MERCHANT_SECRET: z.string().min(1).optional()
SEPAY_IPN_SECRET: z.string().min(1).optional()
SEPAY_PAYMENT_METHOD: z.string().default("BANK_TRANSFER")
SEPAY_SUCCESS_URL: z.string().url().optional()
SEPAY_ERROR_URL: z.string().url().optional()
SEPAY_CANCEL_URL: z.string().url().optional()
SEPAY_RECONCILIATION_ENABLED: z.coerce.boolean().default(false)
```

**Validation Rules:**
- If `PAYMENT_MODE !== "off"`, all SEPAY_* vars except RECONCILIATION_ENABLED must be present
- Never expose these as `NEXT_PUBLIC_*`
- Startup fails if payment enabled without IPN secret
- Sandbox and production use different merchant IDs and secrets

### 3. Payment Repository Operations

Foundation must provide transactional repository functions:

```typescript
interface PaymentRepository {
  // Create or retrieve active payment attempt (idempotent)
  createOrGetActiveAttempt(input: {
    orderId: string;
    provider: PaymentProvider;
    amount: number;
    currency: string;
    merchantReference: string;
  }): Promise<PaymentAttempt>;

  // Get expected payment for IPN verification
  getExpectedPaymentByInvoice(merchantReference: string): Promise<{
    merchantReference: string;
    amount: number;
    currency: string;
    orderId: string;
  } | null>;

  // Apply payment event in transaction
  applyPaymentEvent(input: {
    attemptId: string;
    providerEventId: string;
    providerTransactionId: string;
    eventKind: PaymentEventKind;
    evidence: VerifiedPaymentEvidence;
    delayed: boolean;
  }): Promise<ApplyEventResult>;

  // Get current payment state projection
  getCurrentState(orderId: string): Promise<PaymentStateProjection>;
}
```

**Transaction Requirements for IPN:**
1. Lock payment attempt and order (SELECT FOR UPDATE)
2. Check duplicate providerEventId
3. If identical, return idempotent success
4. If conflicting, quarantine and alert
5. Apply monotonic state transition
6. Append payment_events row
7. Update payment_attempts.state
8. Mark order paid if verified
9. Commit fulfillment/AMIS export outbox
10. Commit transaction
11. Return HTTP 200 only after commit

### 4. Order Repository and Authorization

```typescript
interface OrderRepository {
  // Get order with owner authorization
  getByIdAndOwner(orderId: string, ownerId: string): Promise<Order | null>;
  
  // Validate order eligibility for payment
  validatePaymentEligibility(orderId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }>;
  
  // Mark order as paid (within payment transaction)
  markPaid(orderId: string, evidence: VerifiedPaymentEvidence): Promise<void>;
}
```

**Owner Resolution:**
- Authenticated: `customer_accounts.id` from Firebase session cookie
- Guest: owner ID from HTTP-only signed cookie (Foundation owns cookie logic)

### 5. Operational Infrastructure

**Reconciliation Worker:**
- Cron job running every 5-10 minutes
- Query SePay API for pending attempts older than expected
- Handle missing IPN, timeout, delayed notification
- Respect rate limits and exponential backoff
- Record reconciliation events with decision

**Manual Refund Workflow:**
- Two-person approval (requester + approver)
- Bank transfer evidence required
- Amount verification
- Customer notification
- Append-only audit trail

**Monitoring and Alerts:**
- IPN authentication failures
- Conflicting duplicate events → quarantine
- Payment state mismatch with AMIS
- Delayed IPNs (>15 min)
- Reconciliation failures
- Refund completion

**Kill Switches:**
- Payment creation (return 503)
- IPN processing (return 503, queue for later)
- Reconciliation job
- AMIS export
- Fulfillment outbox

## Activation Gate

Keep `PAYMENT_MODE=off` until Foundation delivers:

1. ✅ Database migration with payment_attempts, payment_events, payment_reconciliations, refund_operations
2. ✅ Regenerated `src/types/database.types.ts`
3. ✅ Updated `src/lib/env.ts` with SEPAY_* validation
4. ✅ `.env.example` with all SEPAY_* vars documented
5. ✅ Payment repository with transactional IPN processing
6. ✅ Order repository with owner authorization
7. ✅ Guest owner cookie implementation
8. ✅ Reconciliation cron job
9. ✅ Manual refund approval workflow
10. ✅ Monitoring and alert handlers

**Integration Test Requirements:**
- IPN duplicate (identical) → idempotent success
- IPN duplicate (conflicting) → quarantine
- IPN wrong secret → HTTP 401
- IPN wrong amount/reference → rejected
- IPN delayed (>15min) → marked delayed
- Payment creation with stale stock → blocked
- Order owner isolation (auth vs guest)
- Guest cookie validation

**Non-Production Merchant Test:**
- SePay Sandbox configured with callback origin
- Bank-transfer QR flow success
- Cancel before payment
- Wrong reference/amount
- Delayed notification + reconciliation
- Manual refund evidence flow

## Checkout Next Steps After Foundation Delivery

1. Update route implementations with Foundation repos
2. Add payment creation to `/api/checkout` flow
3. Update checkout UI with SePay bank-transfer option
4. Remove ZaloPay-specific UI (keep Zalo OA chat)
5. Add payment reconciliation job integration
6. Add manual refund admin UI
7. Integration tests with Foundation repos
8. SePay Sandbox scenario proof
9. Update translations (vi/en/ko)
10. DESIGN.md payment flow documentation
