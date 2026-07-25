import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), getCart: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({ getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }), getAccountCartPort: () => ({ getCart: ports.getCart }) }));
vi.mock("@/components/account/account-cart", () => ({ AccountCart: () => <div>Cart UI</div> }));
import AccountCartPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
describe("AccountCartPage", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.getCart.mockReset(); });
  it("does not fetch a cart for anonymous access", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: the account cart page renders.
    render(await AccountCartPage({ params: Promise.resolve({ locale: "vi" }) }));
    // Then: it remains neutral without a cart read.
    expect(screen.getByText("Giỏ hàng hiện chưa khả dụng.")).toBeInTheDocument(); expect(ports.getCart).not.toHaveBeenCalled();
  });
  it("links an empty authenticated cart to product discovery", async () => {
    // Given: an authenticated empty cart.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.getCart.mockResolvedValue({ items: [], total: { amount: 0, currency: "VND" }, version: 0 });
    // When: the page renders.
    render(await AccountCartPage({ params: Promise.resolve({ locale: "vi" }) }));
    // Then: it provides the locale product link.
    expect(screen.getByRole("link", { name: "Khám phá sản phẩm" })).toHaveAttribute("href", "/vi/products");
  });
});
