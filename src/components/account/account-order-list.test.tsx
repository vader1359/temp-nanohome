import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountOrderList } from "./account-order-list";

const order = { orderId: "o1", orderNumber: "1001", placedAt: "2026-01-01T00:00:00.000Z", status: "paid", total: { amount: 120000, currency: "VND" } } as const;

describe("AccountOrderList", () => {
  it("renders history and only supplied cursor navigation", () => {
    // Given: one historical order and a next cursor.
    render(<AccountOrderList locale="vi" nextCursor="opaque" orders={[order]} />);
    // When: the order history is displayed.
    // Then: the order link and cursor link are accessible.
    expect(screen.getByRole("link", { name: /Đơn 1001/ })).toHaveAttribute("href", "/vi/account/orders/o1");
    expect(screen.getByRole("link", { name: "Xem đơn cũ hơn" })).toHaveAttribute("href", "/vi/account/orders?after=opaque");
  });
});
