# Plan 02 — Replace ZaloPay with SePay Checkout

Status: implementation-ready after SePay Sandbox and AMIS tenant preflight
Baseline: `origin/codex/ai-commerce-staging@b4d28a3`

## 1. Decision

Implement SePay Payment Gateway with:

- one-time purchase;
- `BANK_TRANSFER` only in phase 1;
- hosted SePay checkout;
- server-generated signed fields;
- verified IPN as the primary payment evidence;
- server reconciliation as recovery;
- manual, audited refunds for bank transfer.

Do not implement a raw static QR-only flow as the primary checkout. The hosted gateway gives a clearer order identity, Sandbox, IPN, status APIs, and a future path to NAPAS/card without redesigning the order contract.

## 2. Current truth

ZaloPay is not live and cannot be renamed in place:

- checkout UI posts `/api/cart/submit` to Fillout;
- `zaloPayRequested` is always `false`;
- ZaloPay and VNPAY cards are disabled;
- `/api/checkout` captures an authenticated cart but creates no payment;
- `/api/commerce/checkout` is retired with HTTP 410;
- no payment create/IPN/return/query/refund route exists;
- ZaloPay adapters and SQL ledgers are disconnected scaffolding;
- canonical `orders` and `commerce_checkouts` are not linked.

The first task is therefore to establish one durable checkout/order path.

## 3. Canonical checkout behavior

### 3.1 Cart classification

| Cart | Result |
| --- | --- |
| Every line has fixed server price and payment eligibility | Paid checkout candidate |
| Any contact-price/configurable line | Quote request |
| Mixed fixed/contact cart | Entire cart becomes quote request |
| Missing/stale AMIS stock | Quote request or explicit unavailable state; no SePay |
| Invalid/ambiguous SKU | Block and ask for staff assistance |

The browser never decides price mode, amount, stock, tax, or payment eligibility.

### 3.2 Guest and authenticated order identity

Support both:

- authenticated owner: internal `customer_accounts.id` from Plan 04;
- guest owner: random server-generated owner ID in signed HTTP-only cookie.

Every checkout creates:

- immutable order ID;
- human-facing `WEB-*` order number;
- owner scope;
- server price snapshot;
- exact SKU and canonical variant snapshot;
- order kind: `quote_request | paid_order`;
- idempotency key;
- status axes for business, inventory, AMIS export, payment, fulfillment, and refund.

The guest receives a short-lived order access token bound to the owner cookie. Phone/email is not an order authorization key.

Plan 04 makes transactional order email optional so a verified phone-only account can checkout. Delivery phone remains required. Before enabling that path, prove the SePay bank-transfer contract and actual AMIS tenant accept an absent email, update `orders.email`/delivery schemas in a forward migration, and cover phone-only order creation in integration tests.

### 3.3 Canonical endpoints

- `POST /api/checkout` — validate cart, create durable order, return next action.
- `POST /api/orders/[orderId]/payments/sepay` — create signed SePay fields for an eligible order.
- `GET /api/orders/[orderId]/payment-status` — owner-scoped current state.
- `POST /api/payments/sepay/ipn` — public server callback.
- `GET /[locale]/checkout/sepay/success`
- `GET /[locale]/checkout/sepay/error`
- `GET /[locale]/checkout/sepay/cancel`

Success/error/cancel pages query server state. Query parameters and redirect destination never mark an order paid.

### 3.4 Account offer and adjustment contract

Plan 04 customer offers are server-owned checkout inputs:

- the browser submits only an offer code/ID, never a discount amount;
- checkout resolves current `customer_accounts.id`, eligibility, scope, limits, combination rule, and expiry;
- a durable order stores an immutable adjustment snapshot and rule/version evidence;
- a bounded `offer_reservations` row prevents concurrent over-redemption;
- the exact adjusted grand total is the amount signed for SePay;
- verified payment redeems the reservation idempotently;
- checkout expiry, cancellation, or failed payment releases it;
- refund does not automatically restore an offer unless the approved business rule says so;
- guest checkout receives no account-only offer unless a separate guest-offer rule exists.

Forged, ineligible, expired, reused, wrong-scope, concurrent-reservation, cancel/release, payment/redeem, and refund cases are part of the Plan 02 integration suite.

## 4. AMIS ordering rule

nanoHome's AMIS semantics must remain truthful:

- pre-payment or quote record: not approved;
- verified purchase: approved;
- unapproved SaleOrder remains quote/interest for personalization.

Preferred sequence when the tenant supports an audited status update:

1. Validate cart and live stock.
2. Create durable website order.
3. Create/reconcile AMIS draft with approved=false.
4. Create online soft hold.
5. Start SePay.
6. Receive verified SePay `ORDER_PAID`.
7. Mark website payment paid.
8. Promote the exact AMIS draft to the approved value through a narrow, allowlisted operation.
9. Release/convert the online hold and trigger fulfillment.

Fallback if AMIS cannot safely update draft to approved:

1. Keep the pre-payment record only in Supabase.
2. Start SePay after stock validation and online hold.
3. After verified payment, create/reconcile the approved AMIS SaleOrder.
4. If AMIS creation fails, keep a visible paid-but-export-pending exception; never lose or refund silently.

Do not claim an AMIS draft reserves offline stock until the actual tenant proves it.

## 5. Provider-neutral payment contract

Remove duplicate ZaloPay-specific gateway contracts and introduce one port:

```ts
interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  retrievePayment(input: RetrievePaymentInput): Promise<PaymentResult>;
  cancelUnpaid(input: CancelPaymentInput): Promise<CancelPaymentResult>;
  verifyNotification(input: RawNotificationInput): Promise<VerifiedPaymentEvent>;
}
```

Provider-neutral identifiers:

- `payment_provider`;
- `merchant_reference`;
- `provider_order_id`;
- `provider_transaction_id`;
- `provider_event_id`;
- `payment_method`;
- `raw_payload_digest`.

Rename domain state:

- `creating_zalopay_order` → `creating_payment_request`;
- provider-specific evidence → `VerifiedPaymentEvidence`;
- Zalo-specific references → provider-neutral references.

Suggested files:

- `src/lib/payments/contracts.ts`
- `src/lib/payments/sepay/client.ts`
- `src/lib/payments/sepay/checkout.ts`
- `src/lib/payments/sepay/ipn.ts`
- `src/lib/payments/sepay/reconciliation.ts`
- `src/lib/payments/sepay/schemas.ts`

## 6. SePay setup

### 6.1 Business dashboard

1. Register/login at `my.sepay.vn`.
2. Activate Payment Gateway in Sandbox.
3. Enable bank-transfer QR.
4. Record Merchant ID and Secret Key in the secret manager.
5. Configure public HTTPS IPN:
   - staging: `/api/payments/sepay/ipn`;
   - production: same route on the production domain.
6. Configure IPN authentication type `SECRET_KEY`.
7. Keep production disabled until the complete Sandbox receipt is approved.

### 6.2 Server environment

```text
PAYMENT_MODE=off|sepay_sandbox|sepay_primary
SEPAY_ENV=sandbox|production
SEPAY_MERCHANT_ID=
SEPAY_MERCHANT_SECRET=
SEPAY_IPN_SECRET=
SEPAY_PAYMENT_METHOD=BANK_TRANSFER
SEPAY_SUCCESS_URL=
SEPAY_ERROR_URL=
SEPAY_CANCEL_URL=
SEPAY_RECONCILIATION_ENABLED=false
```

Rules:

- every secret is server-only;
- reject any `NEXT_PUBLIC_SEPAY_*` secret;
- startup fails if payment is enabled without IPN verification;
- Sandbox and production use different secrets and callback origins;
- do not print headers, signed fields, or full IPN payloads.

### 6.3 SDK

Official Node package: `sepay-pg-node`.

Before adoption:

1. pin an exact version;
2. inspect license, transitive dependencies, and checkout field ordering;
3. add contract tests against documented fields;
4. wrap it behind the local `PaymentGateway`;
5. never import it in a client component.

If the SDK cannot meet the contract, implement the documented HMAC-SHA256 form signature locally behind the same adapter. Do not mix SDK and custom signing in different routes.

## 7. Creating payment

Server flow:

1. Lock/load order.
2. Confirm owner and `paid_order`.
3. Confirm not already paid/cancelled.
4. Recalculate amount from order snapshot.
5. Verify fresh stock gate and hold.
6. Create one active payment attempt for the order.
7. Build SePay fields:
   - `merchant`;
   - `currency=VND`;
   - `operation=PURCHASE`;
   - `payment_method=BANK_TRANSFER`;
   - unique `order_invoice_number`;
   - integer `order_amount`;
   - bounded description;
   - optional opaque customer reference;
   - success/error/cancel URLs.
8. Sign fields server-side in documented order.
9. Store only safe attempt metadata and signed-field digest.
10. Return action URL plus hidden fields to a server-rendered auto-submit form.

Idempotency:

- one active merchant reference per order;
- retry after uncertain create uses retrieve/reconciliation first;
- same client idempotency key returns the existing attempt.

## 8. IPN processing

### 8.1 Authentication and validation

For every IPN:

1. Read bounded raw body.
2. Validate `X-Secret-Key` using a constant-time comparison.
3. Parse strict JSON schema.
4. Accept only allowlisted `notification_type`.
5. Check timestamp freshness and record delayed events separately.
6. Resolve order by immutable `order_invoice_number`.
7. Verify currency, expected amount, merchant/customer reference, payment method, and order state.
8. Require `ORDER_PAID`, `CAPTURED`, and `APPROVED` transaction evidence for the paid transition.
9. Reject unknown order, wrong amount, wrong currency, or conflicting provider transaction.

IP address allowlisting may be defense-in-depth but is not a replacement for the shared secret.

### 8.2 Idempotency and transaction

Within one database transaction:

1. Insert event by unique provider event/transaction ID or digest.
2. If duplicate and identical, return success without a second transition.
3. If duplicate and conflicting, quarantine and alert.
4. Lock payment attempt and order.
5. Apply a monotonic transition.
6. Append payment ledger event.
7. Mark order paid.
8. Commit fulfillment/AMIS export outbox.
9. Commit.
10. Return HTTP 200 JSON.

Do not acknowledge success before the durable transaction commits.

### 8.3 Reconciliation

Run every 5–10 minutes for:

- pending attempt older than expected;
- redirect success without IPN;
- IPN parse/auth error;
- timeout;
- AMIS/payment disagreement.

Use SePay server API with Basic Auth to retrieve the order. Respect rate limits and back off. Reconciliation records a digest and decision, not raw credentials/payload.

## 9. Database migration

Add a new forward migration. Do not edit the historical ZaloPay migration.

Schema direction:

`payment_attempts`

- order ID;
- provider;
- merchant reference;
- provider order/transaction IDs;
- payment method;
- amount/currency;
- state;
- create/retrieve timestamps;
- expiry;
- request/response digests.

`payment_events`

- attempt ID;
- provider event/transaction identity;
- event type;
- received timestamp;
- payload digest;
- verification result;
- transition decision;
- append-only.

`payment_reconciliations`

- attempt ID;
- query timestamp;
- safe provider status;
- response digest;
- decision.

`refund_operations`

- order/payment ID;
- method `manual_bank_transfer | provider_void`;
- requested/approved/completed states;
- amount/reason;
- two actors for manual refund;
- bank evidence reference and digest;
- timestamps;
- append-only event history.

Backfill:

- keep historical `app_trans_id`/`zp_trans_id` nullable columns;
- add provider-neutral columns;
- dual-read only during migration verification;
- do not fabricate SePay IDs for old rows;
- remove Zalo-specific code only after data inventory proves no live ZaloPay records.

Regenerate `src/types/database.types.ts` after migration proof.

## 10. Refund and cancellation

Phase 1 bank transfer:

- unpaid SePay order may be cancelled through the documented cancel API;
- leaving the browser is not cancellation;
- verified paid bank transfer is not automatically refundable through the currently documented QR flow;
- use a manual refund operation with approval, bank reference, amount verification, customer notification, and final reconciliation.

Do not carry ZaloPay refund/query-refund assumptions into SePay.

If cards are enabled later:

- evaluate documented pre-settlement void separately;
- do not enable cards or void from the phase-1 bank-transfer flag.

## 11. UI

Replace disabled ZaloPay/VNPAY UI with:

- `Chuyển khoản ngân hàng qua SePay`;
- order amount;
- secure redirect explanation;
- pending state;
- “Đang chờ xác nhận từ ngân hàng”;
- paid/error/cancel/expired states;
- retry that reuses the same safe order/attempt.

Quote carts:

- show `Gửi yêu cầu báo giá`;
- no payment radio;
- Advisor handoff reference after submission.

Remove:

- `zaloPayRequested`;
- `FILLOUT_CART_QUESTION_ZALOPAY_REQUESTED_ID`;
- ZaloPay payment translations and disabled card;
- ZaloPay-specific payment analytics.

Keep:

- `ZaloWidget` and Zalo OA customer-contact functionality.

Update all `vi/en/ko` translations and `DESIGN.md`.

## 12. Test matrix

Order:

- guest/auth owner isolation;
- duplicate submit;
- fixed/contact/mixed cart;
- browser price tampering;
- stale/missing AMIS stock;
- AMIS draft ambiguity.

SePay create:

- exact field order/signature contract;
- missing secret;
- duplicate invoice;
- invalid amount/currency;
- SDK timeout;
- safe retry.

IPN:

- valid paid;
- wrong secret;
- missing/old timestamp;
- wrong amount/currency/reference;
- duplicate identical event;
- duplicate conflicting event;
- out-of-order cancel/paid;
- unknown order;
- delayed event;
- concurrent callbacks.

Reconciliation:

- IPN missing but provider captured;
- redirect success but provider pending;
- provider cancelled;
- rate limit/backoff;
- response malformed.

Refund:

- manual two-person approval;
- partial/full amount bounds;
- evidence required;
- duplicate completion;
- refund does not change purchase history until completed.

## 13. Rollout

1. Deploy schema and code with `PAYMENT_MODE=off`.
2. Run unit/SQL/RLS tests.
3. Configure Sandbox merchant/IPN.
4. Complete scenario receipt:
   - payment success;
   - cancel;
   - wrong amount/reference;
   - duplicate IPN;
   - missing IPN plus reconciliation;
   - AMIS export failure;
   - manual refund.
5. Enable internal staff test only.
6. Enable production for allowlisted orders.
7. Canary by order count, not traffic percentage.
8. Keep kill switches for new payment creation, IPN processing, reconciliation, AMIS export, and fulfillment outbox.

## 14. Official references

- [SePay overview](https://developer.sepay.vn/vi/cong-thanh-toan/gioi-thieu)
- [SePay payment flow](https://developer.sepay.vn/vi/cong-thanh-toan/luong-thanh-toan)
- [Payment form and HMAC signature](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan)
- [Node.js SDK](https://developer.sepay.vn/vi/cong-thanh-toan/sdk/nodejs)
- [IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN)
- [Sandbox](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox)
- [Cancel unpaid QR order](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/huy-don-hang)
