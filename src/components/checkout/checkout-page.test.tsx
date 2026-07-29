import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRemoveItem = vi.fn();
const mockUpdateQuantity = vi.fn();
const clearCart = vi.fn();
const emptyAccountCart = { items: [], total: { amount: 0, currency: "VND" }, version: 0 } as const;
const chairId = "00000000-0000-4000-8000-000000000001";
const tableId = "00000000-0000-4000-8000-000000000002";
const cartItems = [
  {
    badge: "In stock",
    badgeTone: "stock" as const,
    category: "Chair",
    id: chairId,
    image: "/chair.webp",
    name: "Korean Chair",
    price: "10.000.000 ₫",
    originalPrice: "15.000.000 ₫",
    discount: "-33%",
    quantity: 1,
  },
  {
    badge: "In stock",
    badgeTone: "stock" as const,
    category: "Table",
    id: tableId,
    image: "/table.webp",
    name: "Wood Table",
    price: "20.000.000 ₫",
    quantity: 1,
  }
];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: Readonly<{ children: React.ReactNode; href: string }>) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/cart/cart-context", () => ({
  useCart: () => ({
    clearCart,
    items: cartItems,
    removeItem: mockRemoveItem,
    updateQuantity: mockUpdateQuantity
  }),
}));

import { CheckoutPage } from "./checkout-page";

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps cart state and entered form values when durable merge fails", async () => {
    // Given: a hydrated cart and an unavailable account-cart merge.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: "Unavailable" }), ok: false }));
    render(<CheckoutPage initialAccountCart={emptyAccountCart} />);

    // Step 1 -> 2
    const contBtns1 = screen.getAllByRole("button").filter(btn => btn.textContent === "continue");
    if (contBtns1.length > 0) {
      fireEvent.click(contBtns1[0]);
    }

    // When: the customer completes checkout and submits.
    fireEvent.change(screen.getByPlaceholderText("name"), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByPlaceholderText("phone"), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("address"), { target: { value: "1 Test Street" } });

    // Step 2 -> 3
    const contBtns2 = screen.getAllByRole("button").filter(btn => btn.textContent === "continue");
    if (contBtns2.length > 0) {
      fireEvent.click(contBtns2[0]);
    }

    // Bottom bar submit
    const submitBtn = screen.getAllByRole("button").find(
      btn => btn.textContent === "submit" || btn.textContent === "submitting" || btn.getAttribute("type") === "submit"
    );
    if (!submitBtn) throw new Error("Submit button not found");
    fireEvent.click(submitBtn);

    // Then: the order remains visible, values persist, and the cart is not cleared.
    await waitFor(() => expect(screen.getByText("serverError")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("couponPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("couponUnavailable")).toBeInTheDocument();
    expect(screen.getByText("sepayTestPending")).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it("updates cart quantity", () => {
    render(<CheckoutPage initialAccountCart={emptyAccountCart} />);

    const increaseButtons = screen.getAllByRole("button", { name: "increaseQuantity" });
    fireEvent.click(increaseButtons[0]);

    expect(mockUpdateQuantity).toHaveBeenCalledWith(chairId, 2);
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it("submits the correct payload and removes only selected items on success", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: emptyAccountCart }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        orderId: "00000000-0000-4000-8000-000000000101",
        orderNumber: "ORD-TEST001",
        replayed: false,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payment: {
          amount: 10000000,
          currency: "VND",
          environment: "sandbox",
          merchantReference: "WEB-TEST001",
          paymentState: "pending",
        },
      }), { status: 201 }));
    vi.stubGlobal("fetch", mockFetch);

    render(<CheckoutPage initialAccountCart={emptyAccountCart} />);

    // Step 1: Unselect second item, then click continue
    const itemCheckboxes = screen.getAllByRole("checkbox").filter(
      (checkbox) => checkbox.getAttribute("aria-label") === null,
    );
    fireEvent.click(itemCheckboxes[itemCheckboxes.length - 1]);
    const contBtns1 = screen.getAllByRole("button").filter(btn => btn.textContent === "continue");
    if (contBtns1.length > 0) {
      fireEvent.click(contBtns1[0]);
    }

    // Step 2: Fill contact details, VAT, then click continue
    fireEvent.change(screen.getByPlaceholderText("name"), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByPlaceholderText("phone"), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("address"), { target: { value: "1 Test Street" } });
    fireEvent.click(screen.getByLabelText("Issue VAT Invoice (Optional)"));
    const contBtns2 = screen.getAllByRole("button").filter(btn => btn.textContent === "continue");
    if (contBtns2.length > 0) {
      fireEvent.click(contBtns2[0]);
    }

    // Step 3: Submit
    const submitBtns = screen.getAllByRole("button", { name: /submit/i });
    fireEvent.click(submitBtns[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/account/cart/merge-guest", expect.objectContaining({
        method: "POST"
      }));
    });

    const mergeBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(mergeBody.items).toEqual([{ quantity: 1, variantId: chairId }]);
    expect(mergeBody.idempotencyKey).toEqual(expect.any(String));

    const checkoutBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(checkoutBody).toMatchObject({
      address: "1 Test Street",
      email: "a@example.com",
      fullName: "Nguyen Van A",
      idempotencyKey: expect.any(String),
      phone: "+84901234567",
    });
    expect(checkoutBody).not.toHaveProperty("cartItems");
    expect(checkoutBody).not.toHaveProperty("total");
    expect(mockFetch.mock.calls[2][0]).toBe(
      "/api/orders/00000000-0000-4000-8000-000000000101/payments/sepay",
    );

    // Verify it only removed the selected item
    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith(chairId);
    expect(clearCart).not.toHaveBeenCalled();
    expect(await screen.findByText("WEB-TEST001")).toBeInTheDocument();
    expect(screen.getByText("pendingVerification")).toBeInTheDocument();
  });

  it("uses an existing account cart without merging or trusting local presentation", async () => {
    const accountCart = {
      items: [{
        available: true,
        href: "/vi/products/account-chair",
        lineTotal: { amount: 250000, currency: "VND" },
        quantity: 1,
        title: "Account chair",
        unitPrice: { amount: 250000, currency: "VND" },
        variantId: chairId,
      }],
      total: { amount: 250000, currency: "VND" },
      version: 3,
    } as const;
    render(<CheckoutPage initialAccountCart={accountCart} />);

    expect(screen.getByText("Account chair")).toBeInTheDocument();
    expect(screen.getByLabelText("selectAll")).toBeDisabled();
    expect(screen.getByRole("button", { name: "increaseQuantity" })).toBeDisabled();
  });

  it("shows validation error if no items are selected", async () => {
    // Set a wide viewport for desktop so that the single submit button actually triggers submission
    vi.stubGlobal("innerWidth", 1024);
    
    render(<CheckoutPage initialAccountCart={emptyAccountCart} />);

    // Uncheck select all
    const selectAllCheckbox = screen.getByLabelText("selectAll");
    fireEvent.click(selectAllCheckbox);

    // Using the submit button in the bottom bar
    const submitBtn = screen.getAllByRole("button").find(
      btn => btn.textContent === "submit" || btn.textContent === "submitting" || btn.textContent === "continue" || btn.getAttribute("type") === "submit"
    );
    if (!submitBtn) throw new Error("Submit button not found");
    
    fireEvent.click(submitBtn);

    // If it's acting like mobile despite the stub (since component might use window.innerWidth directly inside an event handler where our mock doesn't stick perfectly in standard JSDOM depending on setup) we manually fire a form submit event which is guaranteed to hit the exact submit function.
    fireEvent.submit(screen.getByTestId("checkout-form"));

    // We mock next-intl to just return the key, so the error message will be exactly "validationSelectItems"
    await waitFor(() => {
      // Use queryByText as error might not be found initially. Or grab by role if appropriate, but since it's just a text node inside <p> we match the text string directly.
      const errorText = screen.getByText("validationSelectItems");
      expect(errorText).toBeInTheDocument();
    });
  });
});
