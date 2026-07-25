import { describe, expect, it } from "vitest";

import { createFakeAccountCartPort } from "./cart-port";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;

describe("FakeAccountCartPort", () => {
  it("derives canonical prices and totals from the local catalog", async () => {
    // Given: an empty account cart.
    const port = createFakeAccountCartPort();
    // When: the account adds a canonical catalog variant.
    const result = await port.addItem(account, { expectedVersion: 0, quantity: 2, variantId: "chair-oak" });
    // Then: presentation and totals come from the server catalog.
    expect(result).toMatchObject({ status: "updated", cart: { items: [{ quantity: 2, title: "Ghế gỗ sồi", variantId: "chair-oak" }], total: { amount: 2580000, currency: "VND" }, version: 1 } });
  });

  it("returns the current cart for stale expected versions", async () => {
    // Given: a cart already changed by a previous mutation.
    const port = createFakeAccountCartPort();
    await port.addItem(account, { expectedVersion: 0, quantity: 1, variantId: "chair-oak" });
    // When: a stale browser mutation arrives.
    const result = await port.updateItem(account, { expectedVersion: 0, quantity: 2, variantId: "chair-oak" });
    // Then: it reports the canonical current cart without replaying.
    expect(result).toMatchObject({ status: "version_conflict", cart: { version: 1 } });
  });

  it("replays a guest merge idempotently for the same account key", async () => {
    // Given: a guest selection and one account-scoped idempotency key.
    const port = createFakeAccountCartPort();
    const input = { idempotencyKey: "merge-001", items: [{ quantity: 2, variantId: "chair-oak" }] };
    // When: the same merge is submitted twice.
    const first = await port.mergeGuestCart(account, input);
    const second = await port.mergeGuestCart(account, input);
    // Then: its quantity is applied once.
    expect(first).toEqual(second);
    expect(second.items[0]?.quantity).toBe(2);
  });

  it("increments version exactly once when merging multiple guest items into initial cart", async () => {
    // Given: a guest selection with multiple valid variants.
    const port = createFakeAccountCartPort();
    const input = {
      idempotencyKey: "merge-multi-001",
      items: [
        { quantity: 1, variantId: "chair-oak" },
        { quantity: 2, variantId: "lamp-linen" },
      ],
    };
    // When: guest cart is merged into an initial version 0 cart.
    const result = await port.mergeGuestCart(account, input);
    // Then: version is incremented exactly once (from 0 to 1).
    expect(result.version).toBe(1);
    expect(result.items).toHaveLength(2);
  });

  it("does not increment version when guest merge results in no item changes", async () => {
    // Given: an account cart that already has maximum quantity of an item.
    const port = createFakeAccountCartPort();
    await port.addItem(account, { expectedVersion: 0, quantity: 10, variantId: "chair-oak" });
    // When: merging the same item from guest cart.
    const result = await port.mergeGuestCart(account, {
      idempotencyKey: "merge-no-change-001",
      items: [{ quantity: 1, variantId: "chair-oak" }],
    });
    // Then: version remains 1 because no items changed.
    expect(result.version).toBe(1);
  });
});
