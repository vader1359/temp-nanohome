import { describe, expect, it } from "vitest";
import { mapAmisCustomerMemory } from "./mapper";

describe("AMIS customer memory mapper", () => {
  it("Given a customer and orders with internal fields, When mapped, Then only safe fields enter the DTO", () => {
    const result = mapAmisCustomerMemory({
      linkId: "link-1",
      customer: {
        id: "customer-1",
        type: "residential",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        roomIds: ["room-1"],
        brandIds: ["brand-1"],
        projectStage: "planning",
        customerVisibleSummary: "Prefers warm modern living rooms.",
        email: "private@example.test",
        internalScore: 99,
      },
      orders: [{
        id: "order-1",
        updatedAt: "2026-01-03T00:00:00.000Z",
        lines: [{ sku: "sku-1", canonicalVariantId: "variant-1", quantity: 1, unitPrice: 999 }],
        debt: 123,
      }],
    });

    expect(result).toEqual({
      linkId: "link-1",
      customerType: "residential",
      customerSinceBucket: "2024",
      preferredRoomIds: ["room-1"],
      preferredBrandIds: ["brand-1"],
      discussedVariantIds: [],
      purchasedVariantIds: ["variant-1"],
      projectStage: "planning",
      customerVisibleSummary: "Prefers warm modern living rooms.",
      sourceUpdatedAt: "2026-01-03T00:00:00.000Z",
    });
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("debt");
  });

  it("Given an order line without a canonical variant, When mapped, Then it is omitted", () => {
    const result = mapAmisCustomerMemory({
      linkId: "link-1",
      customer: { id: "customer-1", updatedAt: "2026-01-02T00:00:00.000Z" },
      orders: [{ id: "order-1", updatedAt: "2026-01-02T00:00:00.000Z", lines: [{ sku: "unknown" }] }],
    });

    expect(result.purchasedVariantIds).toEqual([]);
  });
});
