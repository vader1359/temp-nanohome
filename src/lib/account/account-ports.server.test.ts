import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/firebase-session.server", () => ({
  getCurrentFirebaseSessionClaims: async () => null,
}));
vi.mock("@/lib/env", () => ({
  env: {
    ACCOUNT_CENTER_ENABLED: false,
    AUTH_CSRF_SECRET: "fixture-only-account-csrf-secret-32-bytes",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PROJECT_REF: "example",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-only-service-role",
  },
}));

import {
  getAccountAuthPort,
  getAccountCartPort,
  getAccountOffersPort,
  getAccountOrdersPort,
  getAccountPreferencesPort,
  getAccountProfilePort,
  getAccountSecurityPort,
  getAccountWishlistPort,
} from "./account-ports.server";

describe("Account runtime ports", () => {
  it("fails closed when there is no verified Firebase session", async () => {
    const authPort = getAccountAuthPort();

    // When: the current identity is resolved.
    const account = await authPort.getAuthenticatedAccount();

    // Then: no account is fabricated.
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

  it("exposes the durable order contract", () => {
    const ordersPort = getAccountOrdersPort();

    expect(ordersPort.getOrder).toBeTypeOf("function");
    expect(ordersPort.listOrders).toBeTypeOf("function");
  });

  it("exposes the durable wishlist contract", () => {
    const wishlistPort = getAccountWishlistPort();

    expect(wishlistPort.getItems).toBeTypeOf("function");
    expect(wishlistPort.removeItem).toBeTypeOf("function");
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

  it("returns the same account-scoped fake security port", () => {
    // Given: two Account-lane accessor calls.
    const first = getAccountSecurityPort();

    // When: the accessor is invoked again.
    const second = getAccountSecurityPort();

    // Then: session and deletion state remain account-local.
    expect(second).toBe(first);
  });
});
