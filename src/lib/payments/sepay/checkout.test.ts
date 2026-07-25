import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildSePayCheckoutRequest } from "./checkout";

describe("SePay checkout request", () => {
  it.each([125000.01, Number.MAX_SAFE_INTEGER + 1])("rejects non-canonical VND amount %d", (orderAmount) => {
    // Given
    const input = {
      merchant: "merchant-1",
      secret: "merchant-secret",
      orderAmount,
      currency: "VND" as const,
      description: "Order NH-001",
      invoiceNumber: "NH-001",
      successUrl: "https://example.test/success",
      errorUrl: "https://example.test/error",
      cancelUrl: "https://example.test/cancel",
    };

    // When / Then
    expect(() => buildSePayCheckoutRequest(input)).toThrow("SePay VND amounts must be positive safe integers");
  });

  it("signs the documented canonical field order with base64 HMAC", () => {
    // Given
    const input = {
      merchant: "merchant-1",
      secret: "merchant-secret",
      orderAmount: 150_000,
      currency: "VND" as const,
      description: "Order NH-001",
      invoiceNumber: "NH-001",
      customerId: "customer-1",
      paymentMethod: "BANK_TRANSFER",
      successUrl: "https://example.test/success",
      errorUrl: "https://example.test/error",
      cancelUrl: "https://example.test/cancel",
    };
    const canonical = "order_amount=150000,merchant=merchant-1,currency=VND,operation=PURCHASE,order_description=Order NH-001,order_invoice_number=NH-001,customer_id=customer-1,payment_method=BANK_TRANSFER,success_url=https://example.test/success,error_url=https://example.test/error,cancel_url=https://example.test/cancel";

    // When
    const request = buildSePayCheckoutRequest(input);

    // Then
    expect(request.actionUrl).toBe("https://pgapi.sepay.vn/v1/checkout/init");
    expect(request.signature).toBe(createHmac("sha256", input.secret).update(canonical).digest("base64"));
    expect(request.fields).toEqual({
      order_amount: "150000",
      merchant: input.merchant,
      currency: input.currency,
      operation: "PURCHASE",
      order_description: input.description,
      order_invoice_number: input.invoiceNumber,
      customer_id: input.customerId,
      payment_method: input.paymentMethod,
      success_url: input.successUrl,
      error_url: input.errorUrl,
      cancel_url: input.cancelUrl,
      signature: request.signature,
    });
  });
});
