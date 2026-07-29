import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/vi.json";
import { AccountOrderList } from "./account-order-list";

const order = { items: [], orderId: "o1", orderNumber: "1001", paymentStatus: "paid", placedAt: "2026-01-01T00:00:00.000Z", refundStatus: "none", status: "paid", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrderList", () => {
  it("renders history and only supplied cursor navigation", () => {
    // Given: one historical order and a next cursor.
    render(
      <NextIntlClientProvider locale="vi" messages={messages}>
        <AccountOrderList locale="vi" nextCursor="opaque" orders={[order]} />
      </NextIntlClientProvider>,
    );
    // When: the order history is displayed.
    // Then: the order link and cursor link are accessible.
    expect(screen.getByRole("link", { name: /Đơn 1001/ })).toHaveAttribute("href", "/vi/account/orders/o1");
    expect(screen.getByRole("link", { name: "Xem đơn cũ hơn" })).toHaveAttribute("href", "/vi/account/orders?after=opaque");
  });
});
