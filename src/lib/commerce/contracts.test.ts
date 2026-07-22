import { describe, expect, it } from "vitest";

import {
  createCommerceOrderSnapshot,
  parseRawSku,
  parseWarehouseId,
  type CommerceOrderSnapshot,
} from "./domain";
import type { CommerceState } from "./domain";

describe("commerce domain contracts", () => {
  it("preserves a raw SKU exactly", () => {
    const rawSku = "  Sky-Grey / 42  ";

    const sku = parseRawSku(rawSku);

    expect(sku).toBe(rawSku);
  });

  it("rejects empty and whitespace-only SKUs without normalizing valid bytes", () => {
    expect(() => parseRawSku("")).toThrow();
    expect(() => parseRawSku(" \t\n")).toThrow();
    expect(parseRawSku(" SKU- 42 ")).toBe(" SKU- 42 ");
  });

  it("creates an immutable order snapshot with a typed warehouse ID", () => {
    const warehouseId = parseWarehouseId("warehouse-hcm");
    const snapshot: CommerceOrderSnapshot = createCommerceOrderSnapshot({
      orderId: "WEB-checkout-1",
      warehouseId,
      items: [{ sku: parseRawSku(" SKU-42 "), quantity: 1 }],
      totalAmount: 120000,
      currency: "VND",
      state: {
        order: "created",
        inventory: "unchecked",
        amisExport: "not_started",
        payment: "requires_method",
      },
    });

    expect(snapshot.warehouseId).toBe(warehouseId);
    expect(snapshot.items[0]?.sku).toBe(" SKU-42 ");
  });

  it("keeps order, inventory, AMIS, and payment axes independent", () => {
    const state: CommerceState = {
      order: "awaiting_staff_confirmation",
      inventory: "staff_confirmation_required",
      amisExport: "manual_required",
      payment: "manual_review",
    };

    expect(state).toEqual({
      order: "awaiting_staff_confirmation",
      inventory: "staff_confirmation_required",
      amisExport: "manual_required",
      payment: "manual_review",
    });
  });
});
