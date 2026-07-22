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
  it("retires the non-persistent Plan 02 scaffold", async () => {
    // Given: the customer cart still uses the established local + Fillout flow.
    // When: a caller reaches the old in-memory scaffold.
    const response = await POST(request({ owner: { kind: "guest", id: "browser" }, selections: [{ variantId: "variant-1", quantity: 1 }] }));

    // Then: it is explicitly unavailable instead of pretending to persist.
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "commerce_scaffold_retired" });
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
