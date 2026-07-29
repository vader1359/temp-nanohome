import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../../messages/vi.json";

function renderPage(page: ReactNode): void {
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      {page}
    </NextIntlClientProvider>,
  );
}

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  listOrders: vi.fn(),
}));
const redirect = vi.hoisted(() => vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountOrdersPort: () => ({ listOrders: ports.listOrders }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import AccountOrdersPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const order = { items: [], orderId: "order_01", orderNumber: "1001", paymentStatus: "paid", placedAt: "2026-01-01T00:00:00.000Z", refundStatus: "none", status: "paid", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.listOrders.mockReset();
  });

  it("redirects anonymous access without looking up orders", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    await expect(AccountOrdersPage({
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_REDIRECT:/vi/account/sign-in");
    expect(ports.listOrders).not.toHaveBeenCalled();
  });

  it("forwards locale and opaque after cursor for authenticated history", async () => {
    // Given: an authenticated account and a cursor page.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
    // When: the list page renders after a cursor.
    renderPage(await AccountOrdersPage({ params: Promise.resolve({ locale: "ko" }), searchParams: Promise.resolve({ after: "opaque_cursor" }) }));
    // Then: the cursor is forwarded unchanged and links use the locale.
    expect(ports.listOrders).toHaveBeenCalledWith(account, { cursor: "opaque_cursor", limit: 20 });
    expect(screen.getByRole("link", { name: /Đơn 1001/ })).toHaveAttribute("href", "/ko/account/orders/order_01");
  });
});
