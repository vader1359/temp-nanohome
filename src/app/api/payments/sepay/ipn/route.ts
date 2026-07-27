import { verifySePayIpn, maximumSePayIpnBodyBytes } from "@/lib/payments/sepay/ipn";

/**
 * SePay IPN endpoint.
 * 
 * Foundation prerequisites:
 * - Typed env validation with PAYMENT_MODE, SEPAY_ENV, SEPAY_IPN_SECRET
 * - Transactional payment repository with event deduplication, conflict quarantine,
 *   monotonic state transitions, and ledger/outbox commit before HTTP 200
 * - Payment attempt lookup by merchant reference
 * 
 * This route rejects all requests until Foundation delivers the prerequisites.
 */
export async function POST(request: Request): Promise<Response> {
  // Foundation prerequisite: typed env with PAYMENT_MODE check
  const paymentMode = process.env.PAYMENT_MODE ?? "off";
  if (paymentMode === "off") {
    return Response.json(
      { error: "payment_disabled", message: "Payment processing is not enabled" },
      { status: 503 }
    );
  }

  // Foundation prerequisite: SEPAY_IPN_SECRET validation
  const ipnSecret = process.env.SEPAY_IPN_SECRET;
  if (!ipnSecret) {
    console.error("SEPAY_IPN_SECRET not configured");
    return Response.json({ error: "configuration_error" }, { status: 500 });
  }

  const suppliedSecret = request.headers.get("x-secret-key");
  const receivedAt = new Date();

  let rawBody: string;
  try {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > maximumSePayIpnBodyBytes) {
      return Response.json({ error: "body_too_large" }, { status: 413 });
    }
    rawBody = new TextDecoder("utf-8").decode(buffer);
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  // Foundation prerequisite: payment repository to resolve expected payment
  // const expectedPayment = await paymentRepository.getExpectedPaymentByInvoice(merchantReference);
  // 
  // For now, this route rejects all IPNs until Foundation provides the repository
  return Response.json(
    { 
      error: "not_implemented", 
      message: "IPN processing requires Foundation payment repository" 
    },
    { status: 501 }
  );

  // Complete flow after Foundation delivery:
  // 1. Parse IPN to extract merchant reference
  // 2. Load expected payment from repository
  // 3. Verify IPN with verifySePayIpn(...)
  // 4. If verified, apply event in transaction:
  //    - Dedupe by providerEventId
  //    - Lock payment attempt and order
  //    - Apply monotonic state transition
  //    - Append payment ledger event
  //    - Mark order paid
  //    - Commit fulfillment/AMIS export outbox
  //    - Commit transaction
  // 5. Return HTTP 200 JSON only after commit
  // 6. If conflict, quarantine and alert
}
