import { describe, expect, it } from "vitest";

import { createCommerceLocalServices, type CommerceCatalog } from "@/lib/commerce/commerce-local";
import { createServerOwnedCommerceRoutes } from "@/lib/commerce/server-owned-routes";
import { validCatalogEligibility } from "@/lib/commerce/catalog-test-support";
import { createPostHandler } from "./handler";
import { POST } from "./route";

const catalog: CommerceCatalog = {
  async findVariant(variantId) {
    return variantId === "variant-1"
      ? { variantId, sku: "SKU-SERVER", unitAmount: 125000, currency: "VND", warehouseId: "warehouse-hcm", eligibility: validCatalogEligibility }
      : null;
  },
};

const request = (body: unknown): Request => new Request("https://example.test/api/commerce/cart", {
  method: "POST",
  body: JSON.stringify(body),
});

describe("POST /api/commerce/cart", () => {
  it("returns unauthorized with the deny-default composition", async () => {
    // Given: no server identity or production persistence composition.
    // When: the actual exported handler receives a cart replacement.
    const response = await POST(request({ owner: { kind: "guest", id: "browser" }, selections: [{ variantId: "variant-1", quantity: 1 }] }));

    // Then: the route does not allow a browser to become an owner.
    expect(response.status).toBe(401);
  });

  it("uses server catalog values and ignores browser commercial fields", async () => {
    // Given: a local deterministic composition with a resolved server owner.
    const services = createCommerceLocalServices({ catalog });
    const routes = createServerOwnedCommerceRoutes({ services, resolveOwner: async () => ({ kind: "user", id: "user-1" }) });
    const post = createPostHandler(routes);

    // When: the browser submits fake owner, SKU, and amount data.
    const response = await post(request({
      owner: { kind: "user", id: "attacker" },
      selections: [{ variantId: "variant-1", quantity: 2, browserSku: "FAKE", browserUnitAmount: 1 }],
      totalAmount: 1,
      paymentMethod: "paid",
    }));

    // Then: the response contains only server-derived commercial values.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      cart: {
        owner: { kind: "user", id: "user-1" },
        items: [{ sku: "SKU-SERVER", quantity: 2, unitAmount: 125000 }],
        totalAmount: 250000,
      },
    });
  });
});
