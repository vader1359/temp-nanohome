import { describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "@/components/checkout/checkout-page";

vi.mock("@/components/checkout/checkout-page", () => ({
  CheckoutPage: () => <main data-testid="checkout-page" />,
}));

import CheckoutRoute from "./page";

describe("localized checkout route", () => {
  it("renders the client checkout page inside the locale segment", () => {
    // Given: the locale route is requested.
    // When: the route component renders.
    const route = CheckoutRoute();

    // Then: the checkout client UI is present.
    expect(route.type).toBe(CheckoutPage);
  });
});
