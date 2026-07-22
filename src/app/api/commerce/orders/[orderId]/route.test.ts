import { describe, expect, it } from "vitest";

import { createCommerceLocalServices, type CommerceCatalog } from "@/lib/commerce/commerce-local";
import { createServerOwnedCommerceRoutes } from "@/lib/commerce/server-owned-routes";
import { validCatalogEligibility } from "@/lib/commerce/catalog-test-support";
import { createGetHandler } from "./handler";
import { GET } from "./route";

const catalog: CommerceCatalog = {
  async findVariant(variantId) {
    return variantId === "variant-1"
      ? { variantId, sku: "SKU-SERVER", unitAmount: 125000, currency: "VND", warehouseId: "warehouse-hcm", eligibility: validCatalogEligibility }
      : null;
  },
};

const request = (ownerId?: string): Request => new Request("https://example.test/api/commerce/orders/WEB-1", {
  headers: ownerId === undefined ? undefined : { "x-commerce-owner-kind": "user", "x-commerce-owner-id": ownerId },
});

describe("GET /api/commerce/orders/[orderId]", () => {
  it("retires the process-local order read scaffold", async () => {
    // Given: the Plan 02 repository cannot survive a process restart.
    // When: a caller reaches the exported read route.
    const response = await GET(request("user-1"), { params: Promise.resolve({ orderId: "WEB-1" }) });

    // Then: it is explicitly unavailable instead of implying durable history.
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "commerce_scaffold_retired" });
  });

  it("hides another owner's order as not found", async () => {
    // Given: a locally-created order owned by user-1.
    const services = createCommerceLocalServices({ catalog });
    const routes = createServerOwnedCommerceRoutes({ services, resolveOwner: async () => ({ kind: "user", id: "user-2" }) });
    const order = await services.checkout.create({
      owner: { kind: "user", id: "user-1" },
      selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { fullName: "Buyer", email: "buyer@example.com", phone: "0123456789", address: "Hanoi" },
      idempotencyKey: "checkout-1",
    });
    if (order.kind !== "created") throw new Error("test fixture did not create an order");
    const get = createGetHandler(routes);

    // When: another authenticated owner requests the order.
    const response = await get(request("user-2"), { params: Promise.resolve({ orderId: order.order.orderId }) });

    // Then: ownership is not disclosed through a forbidden response.
    expect(response.status).toBe(404);
  });

  it("returns an order to its resolved owner", async () => {
    // Given: a locally-created order and the matching server owner.
    const services = createCommerceLocalServices({ catalog });
    const routes = createServerOwnedCommerceRoutes({ services, resolveOwner: async () => ({ kind: "user", id: "user-1" }) });
    const order = await services.checkout.create({
      owner: { kind: "user", id: "user-1" },
      selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { fullName: "Buyer", email: "buyer@example.com", phone: "0123456789", address: "Hanoi" },
      idempotencyKey: "checkout-1",
    });
    if (order.kind !== "created") throw new Error("test fixture did not create an order");
    const get = createGetHandler(routes);

    // When: the owner requests the order through the actual Web handler.
    const response = await get(request("user-1"), { params: Promise.resolve({ orderId: order.order.orderId }) });

    // Then: the server-owned order is returned.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ order: { orderId: order.order.orderId } });
  });
});
