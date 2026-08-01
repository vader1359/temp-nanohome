import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => getSearchParams(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

import SePaySuccessPage from "./page";

describe("SePaySuccessPage", () => {
  it("shows an error without an order ID", () => {
    getSearchParams.mockReturnValue(new URLSearchParams());

    render(<SePaySuccessPage />);

    expect(screen.getByRole("heading", { name: "paymentErrorTitle" })).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: "pendingVerification" })).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/orders/00000000-0000-4000-8000-000000000301/payment-status",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
    expect(screen.queryByRole("heading", { name: "successTitle" })).not.toBeInTheDocument();
  });
});
