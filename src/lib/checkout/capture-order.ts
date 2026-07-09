import "server-only";

import type { Database } from "@/types/db";

import type { CheckoutDelivery } from "./delivery";

export type CaptureOrderResult =
  | { readonly kind: "success"; readonly orderId: string; readonly orderNumber: string }
  | { readonly kind: "invalid_cart" }
  | { readonly kind: "failed" };

type CaptureOrderArgs = Database["public"]["Functions"]["capture_order_from_cart"]["Args"];
type CaptureOrderRow = Database["public"]["Functions"]["capture_order_from_cart"]["Returns"][number];

export type CheckoutRpc = (
  functionName: "capture_order_from_cart",
  args: CaptureOrderArgs,
) => PromiseLike<{ readonly data: readonly CaptureOrderRow[] | null; readonly error: { readonly message: string } | null }>;

const INVALID_CART_FAILURES = new Set([
  "checkout_cart_not_found",
  "checkout_empty_cart",
  "checkout_invalid_cart",
]);

export async function captureOrderFromCart(
  rpc: CheckoutRpc,
  delivery: CheckoutDelivery,
): Promise<CaptureOrderResult> {
  const { data, error } = await rpc("capture_order_from_cart", {
    p_full_name: delivery.fullName,
    p_email: delivery.email,
    p_phone: delivery.phone,
    p_address: delivery.address,
    p_city: delivery.city,
    p_district: delivery.district,
    p_ward: delivery.ward,
    p_note: delivery.note,
  });

  if (error !== null) {
    return INVALID_CART_FAILURES.has(error.message) ? { kind: "invalid_cart" } : { kind: "failed" };
  }

  const order = data?.[0];
  if (order === undefined) {
    return { kind: "failed" };
  }

  return { kind: "success", orderId: order.order_id, orderNumber: order.order_number };
}
