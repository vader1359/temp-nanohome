import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseFake, resetCartTestState, seedCart, seedCartItem, state } from "./cart.test-support";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createSupabaseFake()),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createSupabaseFake()),
}));

import {
  addCartItem,
  createCart,
  getCart,
  getCartItems,
  mergeGuestCart,
  removeCartItem,
  updateCartItemQuantity,
} from "./cart";

describe("cart exports", () => {
  it("imports every cart query export", () => {
    expect(getCart).toBeTypeOf("function");
    expect(createCart).toBeTypeOf("function");
    expect(getCartItems).toBeTypeOf("function");
    expect(addCartItem).toBeTypeOf("function");
    expect(updateCartItemQuantity).toBeTypeOf("function");
    expect(removeCartItem).toBeTypeOf("function");
    expect(mergeGuestCart).toBeTypeOf("function");
  });
});

describe("cart quantity validation", () => {
  it("rejects invalid add quantities before building a backend mutation", async () => {
    // Given: an add-to-cart call with a malformed quantity.
    resetCartTestState();

    // When: the item is added through the backend query contract.
    const action = addCartItem("cart-1", "variant-1", 0);

    // Then: validation fails before any cart item insert/update is attempted.
    await expect(action).rejects.toThrow(RangeError);
    expect(state.insertedItems).toHaveLength(0);
    expect(state.updatedItems).toHaveLength(0);
  });

  it("rejects invalid merge quantities before mutating the authenticated cart", async () => {
    // Given: a guest cart payload with an invalid quantity.
    resetCartTestState();
    seedCart({ id: "cart-1", user_id: "user-1", merged_from_guest_id: null });

    // When: the guest cart is merged into the authenticated cart.
    const action = mergeGuestCart("user-1", [{ variantId: "variant-1", quantity: -1, guestId: "guest-1" }]);

    // Then: validation fails and the cart remains untouched.
    await expect(action).rejects.toThrow(RangeError);
    expect(state.insertedItems).toHaveLength(0);
    expect(state.updatedItems).toHaveLength(0);
  });
});

describe("cart item dedupe", () => {
  it("sums quantity when adding an existing variant to a cart", async () => {
    // Given: an authenticated cart already contains the target variant.
    resetCartTestState();
    seedCart({ id: "cart-1", user_id: "user-1", merged_from_guest_id: null });
    seedCartItem({ id: "item-1", cart_id: "cart-1", variant_id: "variant-1", quantity: 2 });

    // When: the same variant is added again.
    const item = await addCartItem("cart-1", "variant-1", 3);

    // Then: the existing row is updated to the summed quantity instead of inserting a duplicate.
    expect(item.quantity).toBe(5);
    expect(state.insertedItems).toHaveLength(0);
    expect(state.updatedItems).toEqual([{ quantity: 5 }]);
  });

  it("dedupes duplicate guest items by variant and sums quantities during merge", async () => {
    // Given: an authenticated cart with no item for the guest variant.
    resetCartTestState();
    seedCart({ id: "cart-1", user_id: "user-1", merged_from_guest_id: null });

    // When: the guest payload contains the same variant twice.
    await mergeGuestCart("user-1", [
      { variantId: "variant-1", quantity: 2, guestId: "guest-1" },
      { variantId: "variant-1", quantity: 4, guestId: "guest-1" },
    ]);

    // Then: one row is inserted and then summed, leaving one backend item at total quantity.
    expect(state.insertedItems).toEqual([{ cart_id: "cart-1", variant_id: "variant-1", quantity: 2 }]);
    expect(state.updatedItems).toEqual([{ quantity: 6 }]);
    expect([...state.cartItems.values()]).toHaveLength(1);
    expect([...state.cartItems.values()][0]?.quantity).toBe(6);
  });
});

describe("cart merge idempotency", () => {
  it("does not re-apply a guest cart after its guest id was marked merged", async () => {
    // Given: the authenticated cart already records the guest id as merged.
    resetCartTestState();
    seedCart({ id: "cart-1", user_id: "user-1", merged_from_guest_id: "guest-1" });
    seedCartItem({ id: "item-1", cart_id: "cart-1", variant_id: "variant-1", quantity: 2 });

    // When: the same guest payload is merged again.
    const cart = await mergeGuestCart("user-1", [{ variantId: "variant-1", quantity: 3, guestId: "guest-1" }]);

    // Then: the existing backend quantity is not incremented a second time.
    expect(cart.merged_from_guest_id).toBe("guest-1");
    expect(state.updatedItems).toHaveLength(0);
    expect(state.cartItems.get("item-1")?.quantity).toBe(2);
  });
});

describe("cart service-role exposure guard", () => {
  it("marks the cart query module as server-only when it imports the admin client", () => {
    // Given: the cart query module uses the admin client for mergeGuestCart.
    const source = readFileSync(new URL("./cart.ts", import.meta.url), "utf8");

    // When: the module source is inspected as an import-boundary contract.
    const firstStatement = source.split("\n")[0];

    // Then: server-only is the first import so client bundles cannot import the service-role path.
    expect(firstStatement).toBe('import "server-only";');
  });
});
