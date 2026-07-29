import { describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "@/components/checkout/checkout-page";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getCart: vi.fn(),
}));
const redirect = vi.hoisted(() => vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountCartPort: () => ({ getCart: ports.getCart }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/checkout/checkout-page", () => ({
  CheckoutPage: () => <main data-testid="checkout-page" />,
}));

import CheckoutRoute from "./page";

const account = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  identities: [],
  locale: "vi",
} as const;

describe("localized checkout route", () => {
  it("requires a Firebase account before reading a checkout cart", async () => {
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    await expect(CheckoutRoute({ params: Promise.resolve({ locale: "vi" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/vi/account/sign-in");
    expect(ports.getCart).not.toHaveBeenCalled();
  });

  it("renders the account-owned cart inside the locale checkout", async () => {
    const cart = { items: [], total: { amount: 0, currency: "VND" }, version: 0 } as const;
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getCart.mockResolvedValue(cart);

    const route = await CheckoutRoute({ params: Promise.resolve({ locale: "vi" }) });

    expect(route.type).toBe(CheckoutPage);
    expect(route.props.initialAccountCart).toEqual(cart);
  });
});
