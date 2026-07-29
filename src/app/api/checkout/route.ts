import { getAccountAuthPort } from "@/lib/account/account-ports.server";
import {
  AccountCheckoutRepositoryError,
} from "@/lib/checkout/account-checkout-repository.server";
import { getAccountCheckoutRepository } from "@/lib/checkout/account-checkout-runtime.server";
import { accountCheckoutSchema } from "@/lib/checkout/delivery";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = accountCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "invalid_checkout_data" }, { status: 400 });
  }

  try {
    const order = await getAccountCheckoutRepository().captureOrder(
      account.accountId,
      parsed.data,
    );
    return Response.json({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      replayed: order.replayed,
    }, { status: order.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof AccountCheckoutRepositoryError) {
      if (error.code === "mutation_disabled") {
        return Response.json({ error: "checkout_disabled" }, { status: 503 });
      }
      if (error.code === "checkout_cart_not_found"
        || error.code === "checkout_empty_cart"
        || error.code === "checkout_invalid_cart"
        || error.code === "checkout_idempotency_conflict") {
        return Response.json({ error: error.code }, { status: 409 });
      }
      if (error.code === "checkout_invalid_request") {
        return Response.json({ error: "invalid_checkout_data" }, { status: 400 });
      }
      if (error.code === "checkout_unauthorized") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    return Response.json({ error: "checkout_failed" }, { status: 500 });
  }
}
