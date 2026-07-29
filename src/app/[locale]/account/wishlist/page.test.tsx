import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getItems: vi.fn(),
}));
const redirect = vi.hoisted(() => vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountWishlistPort: () => ({ getItems: ports.getItems }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import AccountWishlistPage from "./page";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

describe("AccountWishlistPage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getItems.mockReset();
  });

  it("redirects anonymous access without reading saved items", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    await expect(AccountWishlistPage({ params: Promise.resolve({ locale: "vi" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/vi/account/sign-in");
    expect(ports.getItems).not.toHaveBeenCalled();
  });

  it("links an authenticated empty wishlist to products", async () => {
    // Given: an authenticated account with no saved variants.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getItems.mockResolvedValue([]);

    // When: the wishlist page renders.
    render(await AccountWishlistPage({ params: Promise.resolve({ locale: "vi" }) }));

    // Then: the empty state provides a product discovery route.
    expect(screen.getByRole("link", { name: "Khám phá sản phẩm" })).toHaveAttribute("href", "/vi/products");
    expect(ports.getItems).toHaveBeenCalledWith(account);
  });
});
