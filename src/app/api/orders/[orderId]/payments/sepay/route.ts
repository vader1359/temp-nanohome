import { buildSePayCheckoutRequest } from "@/lib/payments/sepay/checkout";

/**
 * POST /api/orders/[orderId]/payments/sepay
 * 
 * Create a signed SePay payment request for an eligible order.
 * 
 * Foundation prerequisites:
 * - Typed env validation with PAYMENT_MODE, SEPAY_ENV, SEPAY_MERCHANT_ID, 
 *   SEPAY_MERCHANT_SECRET, success/error/cancel URLs
 * - Payment repository with attempt creation, idempotency, and locking
 * - Order repository with owner authorization, state validation, and amount calculation
 * - Stock gate validation before payment creation
 * 
 * This route rejects all requests until Foundation delivers the prerequisites.
 */
export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
): Promise<Response> {
  const { orderId } = params;

  // Foundation prerequisite: typed env with PAYMENT_MODE check
  const paymentMode = process.env.PAYMENT_MODE ?? "off";
  if (paymentMode === "off") {
    return Response.json(
      { error: "payment_disabled", message: "Payment processing is not enabled" },
      { status: 503 }
    );
  }

  // Foundation prerequisite: SEPAY_* env validation
  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const merchantSecret = process.env.SEPAY_MERCHANT_SECRET;
  const successUrl = process.env.SEPAY_SUCCESS_URL;
  const errorUrl = process.env.SEPAY_ERROR_URL;
  const cancelUrl = process.env.SEPAY_CANCEL_URL;

  if (!merchantId || !merchantSecret || !successUrl || !errorUrl || !cancelUrl) {
    console.error("SePay environment not fully configured");
    return Response.json({ error: "configuration_error" }, { status: 500 });
  }

  // Foundation prerequisite: order repository and authorization
  // const order = await orderRepository.getOrderWithOwnerCheck(orderId, session);
  // if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  // if (order.kind !== "paid_order") return Response.json({ error: "not_eligible" }, { status: 409 });
  // if (order.paymentState === "paid") return Response.json({ error: "already_paid" }, { status: 409 });

  // Foundation prerequisite: stock validation
  // const stockValid = await validateStockGate(order);
  // if (!stockValid) return Response.json({ error: "insufficient_stock" }, { status: 409 });

  // Foundation prerequisite: payment repository
  // const attempt = await paymentRepository.createOrGetActiveAttempt({
  //   orderId: order.id,
  //   provider: "sepay",
  //   amount: order.grandTotal,
  //   currency: "VND",
  //   merchantReference: order.orderNumber,
  // });

  return Response.json(
    {
      error: "not_implemented",
      message: "Payment creation requires Foundation order and payment repositories"
    },
    { status: 501 }
  );

  // Complete flow after Foundation delivery:
  // 1. Authorize order owner
  // 2. Validate order is paid_order, not already paid
  // 3. Recalculate amount from order snapshot
  // 4. Validate fresh stock gate
  // 5. Create/get active payment attempt (idempotent)
  // 6. Build SePay checkout request with buildSePayCheckoutRequest(...)
  // 7. Store signed-field digest
  // 8. Return { actionUrl, fields } for auto-submit form
}
