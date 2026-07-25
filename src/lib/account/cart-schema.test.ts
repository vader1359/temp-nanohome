import { describe, expect, it } from "vitest";

import { parseCartMutation, parseGuestCartMerge } from "./cart-schema";

describe("cart schemas", () => {
  it("rejects presentation and account fields in a cart mutation", () => {
    // Given: a browser payload with trusted-server fields.
    const body = { expectedVersion: 0, price: 1, quantity: 1, title: "forged", variantId: "chair-oak" };
    // When: it crosses the strict mutation boundary.
    const result = parseCartMutation(body);
    // Then: parsing rejects the whole payload.
    expect(result).toBeNull();
  });

  it("accepts only bounded guest id and quantity pairs", () => {
    // Given: a guest merge with canonical selection-only entries.
    const body = { idempotencyKey: "merge-001", items: [{ quantity: 2, variantId: "chair-oak" }] };
    // When: it crosses the guest merge boundary.
    const result = parseGuestCartMerge(body);
    // Then: parsed input retains no presentation fields.
    expect(result).toEqual(body);
  });
});
