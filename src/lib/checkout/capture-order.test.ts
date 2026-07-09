import { describe, expect, it, vi } from "vitest";

import { checkoutDeliverySchema } from "./delivery";
import { captureOrderFromCart, type CheckoutRpc } from "./capture-order";

describe("captureOrderFromCart", () => {
  it("sends only mapped delivery data to the checkout RPC", async () => {
    // Given: validated delivery details and a server-side RPC client.
    const rpc = vi.fn(async () => ({
      data: [{ order_id: "order-1", order_number: "ORD-opaque" }],
      error: null,
    }));
    const checkoutRpc: CheckoutRpc = rpc;
    const delivery = checkoutDeliverySchema.parse({
      fullName: "Nguyen Van A",
      email: "customer@example.com",
      phone: "0900000000",
      address: "1 Nguyen Hue",
      district: "District 1",
    });

    // When: checkout capture invokes the persisted-cart RPC.
    const result = await captureOrderFromCart(checkoutRpc, delivery);

    // Then: no user, cart, item, price, status, or order identifiers are forwarded.
    expect(rpc).toHaveBeenCalledWith("capture_order_from_cart", {
      p_full_name: "Nguyen Van A",
      p_email: "customer@example.com",
      p_phone: "0900000000",
      p_address: "1 Nguyen Hue",
      p_city: undefined,
      p_district: "District 1",
      p_ward: undefined,
      p_note: undefined,
    });
    expect(result).toEqual({ kind: "success", orderId: "order-1", orderNumber: "ORD-opaque" });
  });
});
