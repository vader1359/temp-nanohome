import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cartContext = vi.hoisted(() => ({ reconcileAccountCart: vi.fn() }));
vi.mock("@/components/cart/cart-context", () => ({ useCart: () => cartContext }));
import { AccountCart } from "./account-cart";

const variantId = "00000000-0000-4000-8000-000000000001";
const cart = {
  items: [{
    available: true,
    href: "/vi/products/chair-oak",
    lineTotal: { amount: 1290000, currency: "VND" },
    quantity: 1,
    title: "Ghế gỗ sồi",
    unitPrice: { amount: 1290000, currency: "VND" },
    variantId,
  }],
  total: { amount: 1290000, currency: "VND" },
  version: 1,
} as const;

describe("AccountCart", () => {
  beforeEach(() => {
    cartContext.reconcileAccountCart.mockReset();
  });

  it("reconciles its server-rendered cart with the shared header cart", async () => {
    render(<AccountCart checkoutHref="/vi/checkout" initialCart={cart} />);
    await waitFor(() => expect(cartContext.reconcileAccountCart).toHaveBeenCalledWith(cart));
  });

  it("reconciles a conflict without automatically replaying the mutation", async () => {
    const conflictCart = { ...cart, version: 2 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cart: conflictCart }), { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountCart checkoutHref="/vi/checkout" initialCart={cart} />);
    fireEvent.change(screen.getByLabelText("Số lượng Ghế gỗ sồi"), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(screen.getByText("Giỏ hàng đã thay đổi. Vui lòng thử lại thao tác.")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cartContext.reconcileAccountCart).toHaveBeenCalledWith(conflictCart);
  });

  it("sends the current version and blocks checkout while a mutation is pending", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountCart checkoutHref="/vi/checkout" initialCart={cart} />);
    fireEvent.change(screen.getByLabelText("Số lượng Ghế gỗ sồi"), {
      target: { value: "2" },
    });

    expect(screen.queryByRole("link", { name: "Tiếp tục thanh toán" })).not.toBeInTheDocument();
    expect(screen.getByText("Đang đồng bộ giỏ hàng...")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      expectedVersion: 1,
      quantity: 2,
      variantId,
    });

    const updatedCart = {
      ...cart,
      items: [{ ...cart.items[0], quantity: 2 }],
      version: 2,
    };
    resolveResponse?.(new Response(JSON.stringify({ cart: updatedCart }), { status: 200 }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Tiếp tục thanh toán" })).toBeInTheDocument();
    });
    expect(cartContext.reconcileAccountCart).toHaveBeenCalledWith(updatedCart);
  });

  it("restores the previous cart after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    render(<AccountCart checkoutHref="/vi/checkout" initialCart={cart} />);

    fireEvent.change(screen.getByLabelText("Số lượng Ghế gỗ sồi"), {
      target: { value: "2" },
    });

    await waitFor(() => expect(screen.getByText("Không thể cập nhật giỏ hàng.")).toBeInTheDocument());
    expect(screen.getByLabelText("Số lượng Ghế gỗ sồi")).toHaveValue(1);
  });
});
