import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/vi.json";
import { AccountOrderDetail } from "./account-order-detail";

function renderOrderDetail() {
  return render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <AccountOrderDetail order={order} />
    </NextIntlClientProvider>,
  );
}

const order = { items: [], orderId: "o1", orderNumber: "1001", paymentStatus: "paid", placedAt: "2026-01-01T00:00:00.000Z", refundStatus: "none", status: "fulfilled", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrderDetail", () => {
  it("renders historical order fields without operational data", () => {
    // Given: an account-owned historical order.
    renderOrderDetail();
    // When: its detail presentation is displayed.
    // Then: only customer-safe history fields are exposed.
    expect(screen.getByRole("heading", { name: "Đơn 1001" })).toBeInTheDocument();
    expect(screen.getByText("Đã hoàn tất")).toBeInTheDocument();
    expect(screen.queryByText(/địa chỉ|kho|thanh toán/i)).not.toBeInTheDocument();
  });
});
