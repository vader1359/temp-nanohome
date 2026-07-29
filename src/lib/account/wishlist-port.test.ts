import { describe, expect, it, vi } from "vitest";

import { createAccountWishlistPort, createFakeAccountWishlistPort } from "./wishlist-port";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const otherAccount = {
  accountId: "account_02",
  firebaseUid: "firebase_02",
  locale: "vi",
  identities: [],
} as const;

describe("createFakeAccountWishlistPort", () => {
  it("persists only canonical variant ids for the authenticated account", async () => {
    // Given: an empty Account-local wishlist.
    const port = createFakeAccountWishlistPort();

    // When: the same variant is saved with another distinct variant.
    const items = await port.addItem(account, "variant-b");
    const canonicalItems = await port.addItem(account, "variant-a");
    await port.addItem(account, "variant-b");

    // Then: the set is canonical and another account cannot read it.
    expect(items.map((item) => item.variantId)).toEqual(["variant-b"]);
    expect(canonicalItems.map((item) => item.variantId)).toEqual(["variant-a", "variant-b"]);
    await expect(port.getItems(otherAccount)).resolves.toEqual([]);
  });

  it("replays a guest merge receipt without applying later payload changes", async () => {
    // Given: a saved item and a merge key for one account.
    const port = createFakeAccountWishlistPort();
    await port.addItem(account, "variant-existing");

    // When: the guest state is merged twice with the same key.
    const first = await port.mergeGuestItems(account, {
      idempotencyKey: "merge-01",
      variantIds: ["variant-b", "variant-a", "variant-a"],
    });
    const replay = await port.mergeGuestItems(account, {
      idempotencyKey: "merge-01",
      variantIds: ["variant-later"],
    });

    // Then: both responses are the original canonical receipt.
    expect(first.map((item) => item.variantId)).toEqual(["variant-a", "variant-b", "variant-existing"]);
    expect(replay).toEqual(first);
  });

  it("merges a concurrent guest receipt exactly once", async () => {
    // Given: two simultaneous deliveries for the same guest merge receipt.
    const port = createFakeAccountWishlistPort();

    // When: both deliveries arrive before either caller receives a result.
    const [first, replay] = await Promise.all([
      port.mergeGuestItems(account, { idempotencyKey: "merge-concurrent", variantIds: ["variant-first"] }),
      port.mergeGuestItems(account, { idempotencyKey: "merge-concurrent", variantIds: ["variant-later"] }),
    ]);

    // Then: the replay receives the original receipt without a second merge effect.
    expect(replay).toEqual(first);
    expect((await port.getItems(account)).map((item) => item.variantId)).toEqual(["variant-first"]);
  });

  it("identifies unavailable presentation without storing browser presentation fields", async () => {
    // Given: a server-owned unavailable variant identifier.
    const port = createFakeAccountWishlistPort();

    // When: the variant is saved.
    const items = await port.addItem(account, "unavailable-variant");

    // Then: the current presentation identifies availability while retaining only its canonical id.
    expect(items).toEqual([
      {
        availability: "unavailable",
        href: "/vi/products/unavailable-variant",
        title: "Sản phẩm unavailable-variant",
        variantId: "unavailable-variant",
      },
    ]);
  });
});

describe("createAccountWishlistPort", () => {
  it("uses only the server-resolved account ID and catalog-safe presentation", async () => {
    const listWishlistItems = vi.fn(async () => [{
      available: true,
      productSlug: "chair",
      title: "Ghế",
      variantId: "00000000-0000-4000-8000-000000000001",
    }]);
    const removeWishlistItem = vi.fn(async () => undefined);
    const port = createAccountWishlistPort({
      addWishlistItem: vi.fn(async () => undefined),
      listWishlistItems,
      mergeWishlistItems: vi.fn(async () => undefined),
      removeWishlistItem,
    });

    await expect(port.removeItem(
      account,
      "00000000-0000-4000-8000-000000000001",
    )).resolves.toEqual([{
      availability: "available",
      href: "/vi/products/chair",
      title: "Ghế",
      variantId: "00000000-0000-4000-8000-000000000001",
    }]);
    expect(removeWishlistItem).toHaveBeenCalledWith(
      "account_01",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(listWishlistItems).toHaveBeenCalledWith("account_01");
  });
});
