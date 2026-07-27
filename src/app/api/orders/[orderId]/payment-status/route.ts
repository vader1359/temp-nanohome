/**
 * GET /api/orders/[orderId]/payment-status
 * 
 * Query payment state for an order. Owner-scoped, never trusts redirect params.
 * 
 * Foundation prerequisites:
 * - Order repository with owner authorization (auth or guest cookie)
 * - Payment repository with current state projection
 * - Guest owner validation through HTTP-only cookie
 * 
 * This route rejects all requests until Foundation delivers the prerequisites.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
): Promise<Response> {
  const { orderId } = await params;

  // Foundation prerequisite: session/owner resolution
  // Auth: customer_accounts.id from Firebase session cookie
  // Guest: owner ID from HTTP-only signed cookie
  // 
  // const ownerId = await resolveOwner(request);
  // if (!ownerId) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Foundation prerequisite: order repository with owner check
  // const order = await orderRepository.getByIdAndOwner(orderId, ownerId);
  // if (!order) return Response.json({ error: "not_found" }, { status: 404 });

  // Foundation prerequisite: payment state projection
  // const paymentState = await paymentRepository.getCurrentState(orderId);

  return Response.json(
    {
      error: "not_implemented",
      message: "Payment status requires Foundation order/payment repositories and owner validation"
    },
    { status: 501 }
  );

  // Complete flow after Foundation delivery:
  // 1. Resolve owner (auth customer_accounts.id or guest owner cookie)
  // 2. Load order with owner authorization
  // 3. Project current payment state
  // 4. Return { orderId, orderNumber, paymentState, lastUpdated }
  // 5. Redirect pages query this, never trust URL params to mark paid
}
