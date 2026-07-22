import { describe, expect, it } from "vitest";

import { createServerOwnedCommerceRoutes } from "./server-owned-routes";
import type { CommerceLocalServices } from "./commerce-local";
import { parseWarehouseId } from "./domain";

const owner = { kind: "guest" as const, id: "visitor-1" };

const services = {
    cart: {
    replace: async (input) => ({ kind: "success" as const, cart: { ...input, owner, items: [], totalAmount: 0, currency: "VND", warehouseId: parseWarehouseId("warehouse-hcm") } }),
  },
  checkout: {
    create: async (input) => ({ kind: "variant_not_found" as const, input }),
  },
  orders: {
    get: async () => ({ kind: "not_found" as const }),
  },
} satisfies CommerceLocalServices;

describe("server-owned commerce routes", () => {
  it("uses resolved server identity instead of client-supplied owner data", async () => {
    const routes = createServerOwnedCommerceRoutes({
      services,
      resolveOwner: async () => owner,
    });

    const result = await routes.replaceCart({
      owner: { kind: "guest", id: "attacker" },
      selections: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(result.kind).toBe("success");
    if (result.kind === "success") expect(result.cart.owner).toEqual(owner);
  });

  it("denies checkout and order reads when server identity is absent", async () => {
    const routes = createServerOwnedCommerceRoutes({
      services,
      resolveOwner: async () => null,
    });

    expect(await routes.checkout({
      selections: [],
      contact: { fullName: "Visitor", email: "visitor@example.com", phone: "0123456789", address: "HCM" },
      idempotencyKey: "key-1",
    })).toEqual({ kind: "unauthorized" });
    expect(await routes.getOrder("WEB-1")).toEqual({ kind: "unauthorized" });
  });
});
