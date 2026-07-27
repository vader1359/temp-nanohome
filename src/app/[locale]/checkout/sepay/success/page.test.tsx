import { render, screen } from "@testing-library/react";
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
});
