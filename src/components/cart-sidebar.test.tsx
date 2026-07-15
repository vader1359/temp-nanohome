import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartSidebar } from "./cart-sidebar";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { readonly alt: string; readonly src: string }) => <div aria-label={alt} data-src={src} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("CartSidebar mobile checkout flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    activeTab: "cart" as const,
    onClose: vi.fn(),
    onTabChange: vi.fn(),
    items: [
      {
        id: "item-1",
        name: "Test Product",
        category: "Test Category",
        quantity: 1,
        price: "100.000 ₫",
        badge: "In stock",
        badgeTone: "stock" as const,
        image: "/test.jpg",
      },
    ],
    onAddCartItem: vi.fn(),
    onClear: vi.fn(),
    onRemove: vi.fn(),
    onUpdateQuantity: vi.fn(),
    locale: "vi",
    wishlistItems: [],
    onClearWishlist: vi.fn(),
    onRemoveWishlist: vi.fn(),
  };

  it("shows initial total, has enabled order button, and submits payload with current items", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });

    render(<CartSidebar {...defaultProps} />);

    // The redundant mobile order-summary card is removed; the fixed bottom bar retains order costs.
    expect(screen.queryByText("Tổng tạm tính")).not.toBeInTheDocument();
    expect(screen.queryByText("Ưu đãi sẽ được áp dụng khi xác nhận đơn")).not.toBeInTheDocument();
    expect(screen.getByText("Phí vận chuyển")).toBeInTheDocument();
    expect(screen.getByText("Miễn phí")).toBeInTheDocument();
    expect(screen.getByText("Tổng cộng")).toBeInTheDocument();
    expect(screen.getAllByText("100.000 ₫")).toHaveLength(3);

    // Verify the order CTA uses the accessible label and shopping-bag icon.
    const nextBtn1 = screen.getByRole("button", { name: "Đặt hàng" });
    expect(nextBtn1.querySelector("svg")).toBeInTheDocument();
    expect(nextBtn1).not.toBeDisabled();

    // Click continue to go to Step 2
    fireEvent.click(nextBtn1);

    // Step 2 should now be visible
    const nameInput = screen.getByPlaceholderText("Nhập họ và tên");
    const phoneInput = screen.getByPlaceholderText("Nhập số điện thoại");
    const emailInput = screen.getByPlaceholderText("Nhập địa chỉ email");

    // Verify continue button is disabled initially
    const nextBtn2 = screen.getByRole("button", { name: "Tiếp tục" });
    expect(nextBtn2).toBeDisabled();

    // Fill valid details
    fireEvent.change(nameInput, { target: { value: "Nguyen Van A" } });
    fireEvent.change(phoneInput, { target: { value: "0987654321" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    expect(nextBtn2).not.toBeDisabled();

    fireEvent.click(nextBtn2);

    // Step 3: Verify confirmation
    expect(screen.getByText("Xác nhận thông tin")).toBeInTheDocument();
    expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByText("0987654321")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const lastCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(lastCallBody.cartItems).toHaveLength(1);
    expect(lastCallBody.cartItems[0].id).toBe("item-1");
  });
});