import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  addItem: vi.fn(),
  getAuthenticatedAccount: vi.fn(),
  getItems: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountWishlistPort: () => ({
    addItem: ports.addItem,
    getItems: ports.getItems,
    removeItem: ports.removeItem,
  }),
}));

import { DELETE, GET, POST } from "./route";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const items = [{ availability: "available", href: "/vi/products/variant-01", title: "Sản phẩm variant-01", variantId: "variant-01" }] as const;

describe("/api/account/wishlist", () => {
  beforeEach(() => {
    ports.addItem.mockReset();
    ports.getAuthenticatedAccount.mockReset();
    ports.getItems.mockReset();
    ports.removeItem.mockReset();
  });

  it("returns a private no-store response when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the wishlist is requested.
    const response = await GET();

    // Then: it fails closed without wishlist access.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(ports.getItems).not.toHaveBeenCalled();
  });

  it("hides a rejected wishlist port behind a generic private failure", async () => {
    // Given: an authenticated account whose wishlist port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getItems.mockRejectedValue(new Error("wishlist storage failure"));

    // When: the wishlist is requested.
    const response = await GET();

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("passes only a validated canonical variant id to the authenticated account port", async () => {
    // Given: an authenticated account and a current server presentation.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.addItem.mockResolvedValue(items);

    // When: a browser submits an id with an extraneous account id and presentation fields.
    const response = await POST(new Request("https://app.test/api/account/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: "account_other", price: 1, stock: 0, variantId: "  variant-01  " }),
    }));

    // Then: strict boundary validation rejects it before the port is called.
    expect(response.status).toBe(422);
    expect(ports.addItem).not.toHaveBeenCalled();
  });

  it("adds a trimmed canonical variant through the authenticated account only", async () => {
    // Given: an authenticated account and its current safe presentation.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.addItem.mockResolvedValue(items);

    // When: the browser submits a canonical variant identifier.
    const response = await POST(new Request("https://app.test/api/account/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantId: "  variant-01  " }),
    }));

    // Then: the account scope derives only from the authenticated session.
    expect(response.status).toBe(200);
    expect(ports.addItem).toHaveBeenCalledWith(account, "variant-01");
    await expect(response.json()).resolves.toEqual({ items });
  });

  it("removes a validated variant through the authenticated account only", async () => {
    // Given: an authenticated account and its updated safe presentation.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.removeItem.mockResolvedValue([]);

    // When: the browser removes a canonical variant id.
    const response = await DELETE(new Request("https://app.test/api/account/wishlist", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantId: "variant-01" }),
    }));

    // Then: it delegates account scope from the server-authenticated identity.
    expect(response.status).toBe(200);
    expect(ports.removeItem).toHaveBeenCalledWith(account, "variant-01");
    await expect(response.json()).resolves.toEqual({ items: [] });
  });
});
