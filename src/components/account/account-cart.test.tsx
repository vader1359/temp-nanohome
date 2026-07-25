import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guest = vi.hoisted(() => ({ clearCart: vi.fn(), items: [{ id: "", quantity: 0 }].slice(0) }));
vi.mock("@/components/cart/cart-context", () => ({ useCart: () => guest }));
import { AccountCart } from "./account-cart";

const cart = { items: [{ href: "/vi/products/chair-oak", lineTotal: { amount: 1290000, currency: "VND" }, quantity: 1, title: "Ghế gỗ sồi", unitPrice: { amount: 1290000, currency: "VND" }, variantId: "chair-oak" }], total: { amount: 1290000, currency: "VND" }, version: 1 } as const;
describe("AccountCart", () => {
  beforeEach(() => { guest.clearCart.mockReset(); guest.items = []; });
  it("reconciles a conflict without automatically replaying the mutation", async () => {
    // Given: a mutation endpoint that reports a current conflict cart.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ cart: { ...cart, version: 2 } }), { status: 409 })); vi.stubGlobal("fetch", fetchMock);
    // When: the user changes quantity.
    render(<AccountCart initialCart={cart} />); fireEvent.change(screen.getByLabelText("Số lượng Ghế gỗ sồi"), { target: { value: "2" } });
    // Then: it reconciles once and asks for explicit retry.
    await waitFor(() => expect(screen.getByText("Giỏ hàng đã thay đổi. Vui lòng thử lại thao tác.")).toBeInTheDocument()); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("merges selection-only guest items and clears them only after success", async () => {
    // Given: an account cart and a local guest item with untrusted display data.
    guest.items = [{ id: "chair-oak", quantity: 1 }]; const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ cart }), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    // When: the user imports the guest cart.
    render(<AccountCart initialCart={cart} />); fireEvent.click(screen.getByRole("button", { name: "Nhập giỏ hàng khách" }));
    // Then: only id and quantity are submitted before local state is cleared.
    await waitFor(() => expect(guest.clearCart).toHaveBeenCalledOnce()); expect(fetchMock).toHaveBeenCalledWith("/api/account/cart/merge-guest", expect.objectContaining({ body: expect.stringContaining('"variantId":"chair-oak"'), method: "POST" }));
  });

  it("retains the same idempotency key across failed merge retries and generates a new key after success", async () => {
    // Given: a guest cart item to merge.
    guest.items = [{ id: "lamp-linen", quantity: 1 }];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Temporary error" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountCart initialCart={cart} />);

    // When: first merge click fails.
    fireEvent.click(screen.getByRole("button", { name: "Nhập giỏ hàng khách" }));
    await waitFor(() => expect(screen.getByText("Không thể nhập giỏ hàng khách.")).toBeInTheDocument());
    expect(guest.clearCart).not.toHaveBeenCalled();

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const firstKey = firstCallBody.idempotencyKey;

    // When: retrying the merge click.
    fireEvent.click(screen.getByRole("button", { name: "Nhập giỏ hàng khách" }));
    await waitFor(() => expect(guest.clearCart).toHaveBeenCalledOnce());

    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const secondKey = secondCallBody.idempotencyKey;

    // Then: the retry uses the EXACT same idempotency key.
    expect(firstKey).toBe(secondKey);

    // Given: guest items are set again for a subsequent merge after success.
    guest.items = [{ id: "table-side", quantity: 1 }];

    // When: another merge is initiated after previous success.
    fireEvent.click(screen.getByRole("button", { name: "Nhập giỏ hàng khách" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const thirdCallBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    const thirdKey = thirdCallBody.idempotencyKey;

    // Then: a new key is generated after previous success.
    expect(thirdKey).not.toBe(secondKey);
  });

  it("handles fetch rejections gracefully without throwing from event handlers", async () => {
    // Given: fetch throws a network failure.
    guest.items = [{ id: "chair-oak", quantity: 1 }];
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountCart initialCart={cart} />);

    // When: user clicks merge guest cart.
    fireEvent.click(screen.getByRole("button", { name: "Nhập giỏ hàng khách" }));

    // Then: UI displays error message instead of throwing.
    await waitFor(() => expect(screen.getByText("Không thể nhập giỏ hàng khách.")).toBeInTheDocument());
    expect(guest.clearCart).not.toHaveBeenCalled();
  });
});
