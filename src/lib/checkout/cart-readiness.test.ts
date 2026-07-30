import { describe, expect, it } from "vitest";

import { cartCheckoutReadiness } from "./cart-readiness";

const cart = {
  items: [
    {
      available: true,
      href: "/vi/products/chair-oak",
      lineTotal: { amount: 125000, currency: "VND" as const },
      quantity: 2,
      title: "Test Chair",
      unitPrice: { amount: 62500, currency: "VND" as const },
      variantId: "chair-oak",
    },
  ],
  total: { amount: 125000, currency: "VND" as const },
  version: 4,
} as const;

describe("cartCheckoutReadiness", () => {
  it("returns stock_changed with exact affected lines", () => {
    expect(cartCheckoutReadiness(cart, { stockChangedVariantIds: ["chair-oak"] })).toEqual({
      changedItems: [{ quantity: 2, title: "Test Chair", variantId: "chair-oak" }],
      kind: "stock_changed",
    });
  });

  it("does not silently treat unavailable lines as ready", () => {
    expect(cartCheckoutReadiness({
      ...cart,
      items: [{ ...cart.items[0], available: false }],
    })).toMatchObject({ kind: "unavailable_items" });
  });
});
