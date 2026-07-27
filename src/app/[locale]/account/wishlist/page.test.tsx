import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getItems: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountWishlistPort: () => ({ getItems: ports.getItems }),
}));

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

  it("renders a neutral unavailable state without reading saved items when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the wishlist page renders.
    render(await AccountWishlistPage({ params: Promise.resolve({ locale: "vi" }) }));

    // Then: it does not expose or access a wishlist.
    expect(screen.getByText("Danh sách yêu thích hiện chưa khả dụng.")).toBeInTheDocument();
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
