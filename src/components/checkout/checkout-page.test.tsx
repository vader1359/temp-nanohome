import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: Readonly<{ children: React.ReactNode; href: string }>) => <a href={href}>{children}</a>,
}));

import { CheckoutPage } from "./checkout-page";

const identity = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  verifiedEmail: "customer@example.test",
  verifiedPhoneE164: "+84901234567",
} as const;

const readyCart = {
  items: [{
    available: true,
    href: "/vi/products/chair-oak",
    lineTotal: { amount: 125000, currency: "VND" as const },
    quantity: 1,
    title: "Test Chair",
    unitPrice: { amount: 125000, currency: "VND" as const },
    variantId: "chair-oak",
  }],
  total: { amount: 125000, currency: "VND" as const },
  version: 4,
} as const;

const unavailableCart = {
  items: [{
    available: false,
    href: "/vi/products/missing-chair",
    lineTotal: { amount: 0, currency: "VND" as const },
    quantity: 1,
    title: "Unavailable Chair",
    unitPrice: { amount: 0, currency: "VND" as const },
    variantId: "missing-chair",
  }],
  total: { amount: 0, currency: "VND" as const },
  version: 4,
} as const;

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn()
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000501")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000502"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("blocks checkout and links to the account cart when any line is unavailable", () => {
    render(<CheckoutPage checkoutIdentity={identity} initialAccountCart={unavailableCart} />);

    expect(screen.getByRole("alert")).toHaveTextContent("checkoutUnavailableCart");
    expect(screen.getByRole("link", { name: "checkoutGoToCart" })).toHaveAttribute("href", "/account/cart");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
  });

  it("renders verified contacts read-only and posts both normalized order contacts", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        orderId: "00000000-0000-4000-8000-000000000601",
        orderNumber: "WEB-TEST001",
        replayed: false,
        next: "initialize_payment",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payment: {
          amount: 125000,
          attemptId: "00000000-0000-4000-8000-000000000602",
          currency: "VND",
          environment: "sandbox",
          expiresAt: "2026-07-30T12:00:00.000Z",
          handoff: "vietqr",
          merchantReference: "WEB0123456789AB",
          paymentUrl: "https://vietqr.app/img?acc=SBSEPAYTESTVA000001&bank=VCB&amount=125000&des=WEB0123456789AB&template=compact&showinfo=true&fullacc=true",
          state: "pending",
        },
      }), { status: 201 }));
    vi.stubGlobal("fetch", mockFetch);

    render(
      <CheckoutPage
        checkoutIdentity={identity}
        initialAccountCart={readyCart}
        initialFullName="Nguyen Van A"
      />,
    );

    expect(screen.getByLabelText("email")).toHaveValue("customer@example.test");
    expect(screen.getByLabelText("email")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("phone")).toHaveValue("+84901234567");
    expect(screen.getByLabelText("phone")).toHaveAttribute("readonly");
    expect(screen.getByRole("link", { name: "changeVerifiedPhone" })).toHaveAttribute(
      "href",
      "/account/sign-in?returnTo=%2Fvi%2Fcheckout",
    );
    expect(screen.getByText("verifiedContactNotice")).toBeInTheDocument();

    fireEvent.change(document.getElementById("checkout-address") as HTMLTextAreaElement, { target: { value: "1 Test Street" } });
    fireEvent.submit(screen.getByTestId("checkout-form"));

    await waitFor(() => expect(screen.getByText("sepayQrTitle")).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toBe("/api/checkout");
    const checkoutBody = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(checkoutBody).toMatchObject({
      idempotencyKey: "00000000-0000-4000-8000-000000000501",
      delivery: {
        address: "1 Test Street",
        addressId: null,
        email: "customer@example.test",
        fullName: "Nguyen Van A",
        phone: "+84901234567",
      },
      vat: null,
    });
    expect(checkoutBody).not.toHaveProperty("email");
    expect(checkoutBody).not.toHaveProperty("phone");
    expect(checkoutBody).not.toHaveProperty("cartItems");
    expect(checkoutBody).not.toHaveProperty("total");

    expect(mockFetch.mock.calls[1]?.[0]).toBe(
      "/api/orders/00000000-0000-4000-8000-000000000601/payments/sepay",
    );
    const paymentBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(paymentBody).toEqual({
      idempotencyKey: "00000000-0000-4000-8000-000000000502",
      returnUrlsVersion: "v1",
    });

    expect(screen.getByRole("img", { name: "sepayQrAlt" })).toHaveAttribute(
      "src",
      expect.stringMatching(/^https:\/\/vietqr\.app\/img\?/u),
    );
    expect(screen.getByText("WEB0123456789AB")).toBeInTheDocument();
    expect(screen.getByText("sepayQrTestOnly")).toBeInTheDocument();
  });

  it("keeps the verified factor locked and requires the other order contact", () => {
    const { rerender } = render(
      <CheckoutPage
        checkoutIdentity={{ ...identity, verifiedPhoneE164: null }}
        initialAccountCart={readyCart}
      />,
    );

    expect(screen.getByLabelText("email")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("email")).toBeRequired();
    expect(screen.getByLabelText("phoneNumber")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("phoneNumber")).toBeRequired();
    expect(screen.getByLabelText("countryCodeLabel")).toHaveValue("VN");
    expect(screen.queryByRole("link", { name: "changeVerifiedPhone" })).not.toBeInTheDocument();

    rerender(
      <CheckoutPage
        checkoutIdentity={{ ...identity, verifiedEmail: null }}
        initialAccountCart={readyCart}
      />,
    );

    expect(screen.getByLabelText("email")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("email")).toBeRequired();
    expect(screen.getByLabelText("phone")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("phone")).toBeRequired();
  });
});
