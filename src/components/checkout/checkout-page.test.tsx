import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    quantity: 1,
  },
];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: Readonly<{ children: React.ReactNode; href: string }>) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/cart/cart-context", () => ({
  useCart: () => ({ clearCart, items: cartItems }),
}));

import { CheckoutPage } from "./checkout-page";

describe("CheckoutPage", () => {
  it("keeps cart state and entered form values when the legacy submission fails", async () => {
    // Given: a hydrated cart and an unavailable legacy submission endpoint.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: "Unavailable" }), ok: false }));
    render(<CheckoutPage />);

    // When: the customer completes checkout, selects the agreement, and submits.
    fireEvent.change(screen.getByLabelText(/^name/), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByLabelText(/^phone/), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByLabelText(/^email/), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByLabelText(/^agreement/));
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    // Then: the order remains visible, values persist, and the cart is not cleared.
    await waitFor(() => expect(screen.getByText("serverError")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByLabelText("coupon")).toBeInTheDocument();
    expect(screen.getByText("couponNotice")).toBeInTheDocument();
    expect(screen.getByText("paymentNotice")).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
  });
});
