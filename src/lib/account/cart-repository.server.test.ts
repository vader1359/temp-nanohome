import { describe, expect, it } from "vitest";

import { createFakeAccountCartRepository } from "./cart-repository.server";

describe("FakeAccountCartRepository", () => {
  it("copies persisted carts and account-scoped merge receipts", async () => {
    // Given: a saved cart and account idempotency receipt.
    const repository = createFakeAccountCartRepository();
    const cart = { items: [{ quantity: 1, variantId: "chair-oak" }], version: 1 };
    await repository.saveCart("account_01", cart); await repository.saveMergeReceipt("account_01", "merge-01", cart);
    // When: the original mutable fixture changes after persistence.
    cart.items[0] = { quantity: 9, variantId: "chair-oak" };
    // Then: persisted cart and same-account receipt stay isolated.
    expect(await repository.getCart("account_01")).toEqual({ items: [{ quantity: 1, variantId: "chair-oak" }], version: 1 }); expect(await repository.getMergeReceipt("account_01", "merge-01")).toEqual({ items: [{ quantity: 1, variantId: "chair-oak" }], version: 1 }); expect(await repository.getMergeReceipt("account_02", "merge-01")).toBeNull();
  });
});
