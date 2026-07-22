import { describe, expect, it } from "vitest";

import { createCommerceLocalServices, type CommerceCatalog } from "@/lib/commerce/commerce-local";
import { createServerOwnedCommerceRoutes } from "@/lib/commerce/server-owned-routes";
import { validCatalogEligibility } from "@/lib/commerce/catalog-test-support";
import { POST, createPostHandler } from "./route";

const catalog: CommerceCatalog = {
  async findVariant(variantId) {
    return variantId === "variant-1"
      ? { variantId, sku: "SKU-SERVER", unitAmount: 125000, currency: "VND", warehouseId: "warehouse-hcm", eligibility: validCatalogEligibility }
      : null;
  },
};

const request = (body: unknown): Request => new Request("https://example.test/api/commerce/checkout", {
  method: "POST",
  body: JSON.stringify(body),
});

const checkoutBody = {
  selections: [{ variantId: "variant-1", quantity: 1, browserSku: "FAKE", browserUnitAmount: 1 }],
  contact: { fullName: "Buyer", email: "buyer@example.com", phone: "0123456789", address: "Hanoi" },
  idempotencyKey: "checkout-1",
};

describe("POST /api/commerce/checkout", () => {
  it("returns unauthorized with the deny-default composition", async () => {
    // Given: no server identity or production persistence composition.
    // When: the actual exported handler receives checkout data.
    const response = await POST(request(checkoutBody));

    // Then: the route denies checkout before any browser identity is trusted.
    expect(response.status).toBe(401);
  });

  it("creates an order from server-owned catalog data", async () => {
    // Given: a local deterministic composition with a resolved server owner.
    const services = createCommerceLocalServices({ catalog });
    const routes = createServerOwnedCommerceRoutes({ services, resolveOwner: async () => ({ kind: "guest", id: "guest-1" }) });
    const post = createPostHandler(routes);

    // When: the browser submits checkout data with a fake amount and payment flag.
    const response = await post(request({ ...checkoutBody, totalAmount: 1, paymentCaptured: true }));

    // Then: the order is created with a server-derived total and WEB channel.
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      order: {
        channel: "WEB",
        owner: { kind: "guest", id: "guest-1" },
        items: [{ sku: "SKU-SERVER", unitAmount: 125000, quantity: 1 }],
        totalAmount: 125000,
      },
    });
  });

  it("maps an idempotency payload conflict to 409", async () => {
    // Given: an order already exists for the same owner and idempotency key.
    const services = createCommerceLocalServices({ catalog });
    const routes = createServerOwnedCommerceRoutes({ services, resolveOwner: async () => ({ kind: "guest", id: "guest-1" }) });
    const post = createPostHandler(routes);
    await post(request(checkoutBody));

    // When: the same key is reused for a different contact payload.
    const response = await post(request({ ...checkoutBody, contact: { ...checkoutBody.contact, address: "Hue" } }));

    // Then: the route reports a conflict without creating another order.
    expect(response.status).toBe(409);
  });
});
