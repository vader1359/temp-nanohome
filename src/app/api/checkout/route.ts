import { captureOrderFromCart } from "@/lib/checkout/capture-order";
import { checkoutDeliverySchema } from "@/lib/checkout/delivery";
import { createCheckoutClient } from "@/lib/supabase/checkout";

function invalidRequestResponse(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  let input: unknown;

  try {
    input = JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return invalidRequestResponse("invalid_json");
    }
    throw error;
  }

  const delivery = checkoutDeliverySchema.safeParse(input);
  if (!delivery.success) {
    return invalidRequestResponse("invalid_checkout_data");
  }

  const supabase = await createCheckoutClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError !== null || auth.user === null) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await captureOrderFromCart(supabase.rpc.bind(supabase), delivery.data);
  switch (result.kind) {
    case "success":
      return Response.json({ orderId: result.orderId, orderNumber: result.orderNumber }, { status: 201 });
    case "invalid_cart":
      return Response.json({ error: "invalid_cart" }, { status: 409 });
    case "failed":
      return Response.json({ error: "checkout_failed" }, { status: 500 });
  }
}
