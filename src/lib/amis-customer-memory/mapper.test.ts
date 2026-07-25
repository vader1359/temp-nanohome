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
        approvedStatus: "Đã duyệt",
        status: "approved",
        isDeleted: false,
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
    // Given: an approved order has a line that cannot map to a storefront variant.
    const result = mapAmisCustomerMemory({
      linkId: "link-1",
      customer: { id: "customer-1", updatedAt: "2026-01-02T00:00:00.000Z" },
      orders: [{
        id: "order-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
        approvedStatus: "Đã duyệt",
        status: "approved",
        isDeleted: false,
        lines: [{ sku: "unknown" }],
      }],
    });

    // When: the safe projection is derived.
    // Then: no unmapped line is exposed as purchase history.
    expect(result.purchasedVariantIds).toEqual([]);
  });

  it("Given active approved and interested orders, When mapped, Then it separates purchased and discussed variants", () => {
    // Given: synthetic approved, open quote, cancelled, and deleted orders.
    const result = mapAmisCustomerMemory({
      linkId: "link-1",
      customer: { id: "customer-1", updatedAt: "2026-01-02T00:00:00.000Z" },
      orders: [
        {
          id: "approved-order",
          updatedAt: "2026-01-03T00:00:00.000Z",
          approvedStatus: "Đã duyệt",
          status: "approved",
          isDeleted: false,
          lines: [{ sku: "sku-approved", canonicalVariantId: "variant-purchased" }],
        },
        {
          id: "quote-order",
          updatedAt: "2026-01-04T00:00:00.000Z",
          approvedStatus: null,
          status: "quoted",
          isDeleted: false,
          lines: [{ sku: "sku-quote", canonicalVariantId: "variant-interested" }],
        },
        {
          id: "cancelled-order",
          updatedAt: "2026-01-05T00:00:00.000Z",
          approvedStatus: null,
          status: "cancelled",
          isDeleted: false,
          lines: [{ sku: "sku-cancelled", canonicalVariantId: "variant-cancelled" }],
        },
        {
          id: "deleted-order",
          updatedAt: "2026-01-06T00:00:00.000Z",
          approvedStatus: "Đã duyệt",
          status: "approved",
          isDeleted: true,
          lines: [{ sku: "sku-deleted", canonicalVariantId: "variant-deleted" }],
        },
      ],
    });

    // When: restricted memory is projected.
    // Then: only active approved orders are purchases; active unapproved orders are interests.
    expect(result.purchasedVariantIds).toEqual(["variant-purchased"]);
    expect(result.discussedVariantIds).toEqual(["variant-interested"]);
    expect(result.sourceUpdatedAt).toBe("2026-01-06T00:00:00.000Z");
  });
});
