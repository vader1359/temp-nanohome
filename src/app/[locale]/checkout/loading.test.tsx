import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CheckoutLoading from "./loading";

describe("CheckoutLoading", () => {
  it("renders loading indicator and description text", () => {
    render(<CheckoutLoading />);
    expect(screen.getByText(/Đang mở trang thanh toán.../)).toBeInTheDocument();
  });
});
