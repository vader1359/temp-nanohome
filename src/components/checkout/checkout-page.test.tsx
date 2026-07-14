import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRemoveItem = vi.fn();
const mockUpdateQuantity = vi.fn();
const clearCart = vi.fn();
const cartItems = [
  {
    badge: "In stock",
    badgeTone: "stock" as const,
    category: "Chair",
    id: "chair-1",
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
    id: "table-1",
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

  it("keeps cart state and entered form values when the legacy submission fails", async () => {
    // Given: a hydrated cart and an unavailable legacy submission endpoint.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: "Unavailable" }), ok: false }));
    render(<CheckoutPage />);

    // When: the customer completes checkout and submits.
    fireEvent.change(screen.getByPlaceholderText("name"), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByPlaceholderText("phone"), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "a@example.com" } });

    // Using the submit button in the bottom bar
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    // Then: the order remains visible, values persist, and the cart is not cleared.
    await waitFor(() => expect(screen.getByText("serverError")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("couponPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("couponUnavailable")).toBeInTheDocument();
    expect(screen.getByText("paymentUnavailable")).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it("updates cart quantity", () => {
    render(<CheckoutPage />);

    const increaseButtons = screen.getAllByRole("button", { name: "increaseQuantity" });
    fireEvent.click(increaseButtons[0]);

    expect(mockUpdateQuantity).toHaveBeenCalledWith("chair-1", 2);
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it("submits the correct payload and removes only selected items on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }), ok: true });
    vi.stubGlobal("fetch", mockFetch);

    render(<CheckoutPage />);

    // Fill contact details
    fireEvent.change(screen.getByPlaceholderText("name"), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByPlaceholderText("phone"), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByPlaceholderText("email"), { target: { value: "a@example.com" } });

    // Check VAT
    fireEvent.click(screen.getByLabelText("Issue VAT Invoice (Optional)"));

    // Unselect the second cart item. VAT and select-all controls have aria-labels;
    // product-row checkboxes do not.
    const itemCheckboxes = screen.getAllByRole("checkbox").filter(
      (checkbox) => checkbox.getAttribute("aria-label") === null,
    );
    fireEvent.click(itemCheckboxes[itemCheckboxes.length - 1]);

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/cart/submit", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"vatRequested":true'),
      }));
    });

    const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(calledBody.cartItems).toHaveLength(1);
    expect(calledBody.cartItems[0].id).toBe("chair-1");
    expect(calledBody.cartItems[0].lineTotal).toBe(10000000);
    expect(calledBody.zaloPayRequested).toBe(false);
    expect(calledBody.vnPayRequested).toBe(false);

    // Expected total for selected items only
    expect(calledBody.total).toBe(10000000);

    // Verify it only removed the selected item
    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith("chair-1");
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("shows validation error if no items are selected", async () => {
    render(<CheckoutPage />);

    // The "select all" checkbox is form-associated with label "selectAll"
    // For specific checkboxes, we uncheck them.
    const selectAllCheckbox = screen.getByLabelText("selectAll");
    fireEvent.click(selectAllCheckbox);

    // Call submit directly on the form
    const form = document.querySelector("#checkout-form");
    if (form) {
      fireEvent.submit(form);
    } else {
      const submitBtn = screen.getByRole("button", { name: "submit" });
      fireEvent.click(submitBtn);
    }

    // We mock next-intl to just return the key, so the error message will be exactly "validationSelectItems"
    await waitFor(() => {
      const errorEl = screen.getByText("validationSelectItems");
      expect(errorEl).toBeInTheDocument();
    });
  });
});
