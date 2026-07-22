import { describe, expect, it } from "vitest";

import type { CommerceOrderRepository } from "./repository";
import { createCommerceOrderSnapshot, parseWarehouseId } from "./domain";

describe("commerce order repository port", () => {
  it("accepts durable save and lookup composition without transport details", async () => {
    const repository: CommerceOrderRepository = {
      async getById(orderId) {
        return orderId === "WEB-checkout-1" ? null : null;
      },
      async save(snapshot) {
        return snapshot;
      },
    };

    const saved = await repository.save(createCommerceOrderSnapshot({
      orderId: "WEB-checkout-1",
      warehouseId: parseWarehouseId("warehouse-hcm"),
      items: [],
      totalAmount: 0,
      currency: "VND",
      state: {
        order: "created",
        inventory: "unchecked",
        amisExport: "not_started",
        payment: "not_required",
      },
    }));

    expect(saved.orderId).toBe("WEB-checkout-1");
  });
});
