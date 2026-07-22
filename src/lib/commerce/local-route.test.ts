import { describe, expect, it } from "vitest";

import { createCommerceLocalServices, type CommerceCatalog } from "./commerce-local";
import { createCheckoutRoute, createOrderReadRoute } from "./local-route";
import { validCatalogEligibility } from "./catalog-test-support";

const catalog: CommerceCatalog = {
  async findVariant(variantId) {
    return variantId === "variant-1" ? { variantId, sku: "SKU-SERVER", unitAmount: 125000, currency: "VND", warehouseId: "warehouse-hcm", eligibility: validCatalogEligibility } : null;
  },
};

const checkoutBody = {
  owner: { kind: "user", id: "user-1" },
  selections: [{ variantId: "variant-1", quantity: 1, browserSku: "FAKE", browserUnitAmount: 1 }],
  contact: { fullName: "Test Buyer", email: "buyer@example.com", phone: "+84123456789", address: "Hanoi" },
  idempotencyKey: "route-checkout-1",
};

describe("commerce-local route surfaces", () => {
  it("returns safe checkout JSON and never echoes browser pricing", async () => {
    const route = createCheckoutRoute(createCommerceLocalServices({ catalog }));
    const response = await route(new Request("https://app.test/api/commerce/checkout", { method: "POST", body: JSON.stringify(checkoutBody) }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.order.items[0].sku).toBe("SKU-SERVER");
    expect(body.order.items[0].unitAmount).toBe(125000);
    expect(JSON.stringify(body)).not.toContain("FAKE");
  });

  it("denies an order read without an owner identity", async () => {
    const services = createCommerceLocalServices({ catalog });
    const checkout = createCheckoutRoute(services);
    const created = await checkout(new Request("https://app.test/api/commerce/checkout", { method: "POST", body: JSON.stringify(checkoutBody) }));
    const body = await created.json();
    const route = createOrderReadRoute(services);

    const response = await route(new Request("https://app.test/api/commerce/orders/unknown"), body.order.orderId);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
