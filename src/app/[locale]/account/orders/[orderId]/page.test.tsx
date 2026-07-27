import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../../../messages/vi.json";

function renderPage(page: ReactNode): void {
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      {page}
    </NextIntlClientProvider>,
  );
}

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getOrder: vi.fn(),
}));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountOrdersPort: () => ({ getOrder: ports.getOrder }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import AccountOrderPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const order = { orderId: "order_01", orderNumber: "1001", placedAt: "2026-01-01T00:00:00.000Z", status: "paid", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrderPage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getOrder.mockReset();
    notFound.mockClear();
  });

  it("renders neutral unavailable state without looking up an order when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: the order detail page renders.
    renderPage(await AccountOrderPage({ params: Promise.resolve({ orderId: "order_01" }) }));
    // Then: it stays neutral and does not access the orders port.
    expect(screen.getByText("Đơn hàng hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.getOrder).not.toHaveBeenCalled();
  });

  it.each(["missing", "foreign"]) ("uses notFound for %s orders returned as null", async (kind) => {
    // Given: an authenticated account whose requested order is unavailable.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getOrder.mockResolvedValue(null);
    // When: the detail page renders.
    await expect(AccountOrderPage({ params: Promise.resolve({ orderId: kind }) })).rejects.toThrow("NEXT_NOT_FOUND");
    // Then: the identical notFound path is used without presenting detail data.
    expect(ports.getOrder).toHaveBeenCalledWith(account, kind);
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders the account-owned order detail", async () => {
    // Given: an authenticated account and an owned order.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getOrder.mockResolvedValue(order);
    // When: the detail page renders.
    renderPage(await AccountOrderPage({ params: Promise.resolve({ orderId: "order_01" }) }));
    // Then: the historical detail is presented.
    expect(screen.getByRole("heading", { name: "Đơn 1001" })).toBeInTheDocument();
  });
});
