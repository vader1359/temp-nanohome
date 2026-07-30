import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), getCart: vi.fn() }));
const redirect = vi.hoisted(() => vi.fn((target: string) => { throw new Error(`NEXT_REDIRECT:${target}`); }));
vi.mock("@/lib/account/account-ports.server", () => ({ getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }), getAccountCartPort: () => ({ getCart: ports.getCart }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/account/account-cart", () => ({ AccountCart: () => <div>Cart UI</div> }));
import AccountCartPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
describe("AccountCartPage", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.getCart.mockReset(); });
  it("redirects anonymous access without fetching a cart", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    await expect(AccountCartPage({ params: Promise.resolve({ locale: "vi" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/vi/account/sign-in");
    expect(ports.getCart).not.toHaveBeenCalled();
  });
  it("renders the account cart client for an empty authenticated cart so guest items can be merged", async () => {
    // Given: an authenticated empty cart.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.getCart.mockResolvedValue({ items: [], total: { amount: 0, currency: "VND" }, version: 0 });
    // When: the page renders.
    render(await AccountCartPage({ params: Promise.resolve({ locale: "vi" }) }));
    // Then: the merge-capable client still renders instead of returning the empty fallback.
    expect(screen.getByText("Cart UI")).toBeInTheDocument();
  });
});
