import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountOrdersPort: () => ({ listOrders: ports.listOrders }),
}));

import AccountOrdersPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const order = { orderId: "order_01", orderNumber: "1001", placedAt: "2026-01-01T00:00:00.000Z", status: "paid", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.listOrders.mockReset();
  });

  it("renders neutral unavailable state without looking up orders when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: the order list page renders.
    render(await AccountOrdersPage({ params: Promise.resolve({ locale: "vi" }), searchParams: Promise.resolve({}) }));
    // Then: it stays neutral and does not access the orders port.
    expect(screen.getByText("Thông tin đơn hàng hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.listOrders).not.toHaveBeenCalled();
  });

  it("forwards locale and opaque after cursor for authenticated history", async () => {
    // Given: an authenticated account and a cursor page.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
    // When: the list page renders after a cursor.
    render(await AccountOrdersPage({ params: Promise.resolve({ locale: "ko" }), searchParams: Promise.resolve({ after: "opaque_cursor" }) }));
    // Then: the cursor is forwarded unchanged and links use the locale.
    expect(ports.listOrders).toHaveBeenCalledWith(account, { cursor: "opaque_cursor", limit: 20 });
    expect(screen.getByRole("link", { name: /Đơn 1001/ })).toHaveAttribute("href", "/ko/account/orders/order_01");
  });
});
