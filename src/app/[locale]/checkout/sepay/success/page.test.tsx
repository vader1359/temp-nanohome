import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => getSearchParams(),
}));

import SePaySuccessPage from "./page";

describe("SePaySuccessPage", () => {
  it("shows an error without an order ID", () => {
    // Given: a browser return URL without an order identifier.
    getSearchParams.mockReturnValue(new URLSearchParams());

    // When: the success page renders.
    render(<SePaySuccessPage />);

    // Then: it reports the missing server-checkable payment reference.
    expect(screen.getByRole("heading", { name: "Có lỗi xảy ra" })).toBeInTheDocument();
  });

  it("never trusts a browser success redirect to mark payment paid", async () => {
    getSearchParams.mockReturnValue(new URLSearchParams({
      orderId: "00000000-0000-4000-8000-000000000301",
      paymentState: "paid",
    }));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      orderId: "00000000-0000-4000-8000-000000000301",
      paymentState: "pending",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    render(<SePaySuccessPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Đang chờ xác nhận" })).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/orders/00000000-0000-4000-8000-000000000301/payment-status",
    );
    expect(screen.queryByRole("heading", { name: "Thanh toán thành công" })).not.toBeInTheDocument();
  });
});
