import { describe, expect, it } from "vitest";

import {
  getAccountAuthPort,
  getAccountCartPort,
  getAccountOffersPort,
  getAccountOrdersPort,
  getAccountPreferencesPort,
  getAccountProfilePort,
  getAccountWishlistPort,
} from "./account-ports.server";

describe("Account development ports", () => {
  it("keeps the default auth fixture anonymous", async () => {
    // Given: Account-lane development port accessors.
    const authPort = getAccountAuthPort();

    // When: the current identity is resolved.
    const account = await authPort.getAuthenticatedAccount();

    // Then: no user is fabricated outside explicit test fixtures.
    expect(account).toBeNull();
  });

  it("exposes a profile port without browser persistence", () => {
    // Given: Account-lane development port accessors.

    // When: the profile port is resolved.
    const profilePort = getAccountProfilePort();

    // Then: it has the two account-scoped operations.
    expect(profilePort.getProfile).toBeTypeOf("function");
    expect(profilePort.patchProfile).toBeTypeOf("function");
  });

  it("exposes an empty local orders repository", async () => {
    // Given: Account-lane development port accessors.
    const ordersPort = getAccountOrdersPort();
    const account = {
      accountId: "account_01",
      firebaseUid: "firebase_01",
      locale: "vi",
      identities: [],
    } as const;

    // When: the account reads its initial order history.
    const page = await ordersPort.listOrders(account, { limit: 10 });

    // Then: the default fake does not invent an order history.
    expect(page).toEqual({ orders: [], nextCursor: null });
  });

  it("exposes an empty durable wishlist port", async () => {
    // Given: Account-lane development port accessors.
    const wishlistPort = getAccountWishlistPort();
    const account = {
      accountId: "account_01",
      firebaseUid: "firebase_01",
      locale: "vi",
      identities: [],
    } as const;

    // When: the account reads its initial wishlist.
    const items = await wishlistPort.getItems(account);

    // Then: the default fake does not invent saved items.
    expect(items).toEqual([]);
  });

  it("returns the same account-scoped fake cart port", () => {
    // Given: two Account-lane accessor calls.
    const first = getAccountCartPort();

    // When: the accessor is invoked again.
    const second = getAccountCartPort();

    // Then: mutations share the development fake repository.
    expect(second).toBe(first);
  });

  it("returns the same account-scoped fake offers port", () => {
    // Given: two Account-lane accessor calls.
    const first = getAccountOffersPort();

    // When: the accessor is invoked again.
    const second = getAccountOffersPort();

    // Then: reads share the development fake offer source.
    expect(second).toBe(first);
  });

  it("returns the same account-scoped fake preferences port", () => {
    // Given: two Account-lane accessor calls.
    const first = getAccountPreferencesPort();

    // When: the accessor is invoked again.
    const second = getAccountPreferencesPort();

    // Then: preference mutations share the development fake repository.
    expect(second).toBe(first);
  });
});
