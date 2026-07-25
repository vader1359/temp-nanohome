import { describe, expect, it } from "vitest";

import { createDisabledPaymentGateway, PaymentDisabledError } from "./disabled-payment-gateway";

describe("disabled payment gateway", () => {
  it("rejects payment creation without fabricating a provider checkout", async () => {
    // Given
    const gateway = createDisabledPaymentGateway();

    // When / Then
    await expect(gateway.createPayment({
      orderId: "order-123",
      amount: 100_000,
      currency: "VND",
      description: "Order order-123",
    })).rejects.toBeInstanceOf(PaymentDisabledError);
  });

  it("reports an unpaid payment without contacting a provider", async () => {
    // Given
    const gateway = createDisabledPaymentGateway();

    // When
    const result = await gateway.retrievePayment({ paymentId: "payment-123" });

    // Then
    expect(result).toEqual({ kind: "unpaid" });
  });

  it("cancels an unpaid local attempt without contacting a provider", async () => {
    // Given
    const gateway = createDisabledPaymentGateway();

    // When
    const result = await gateway.cancelUnpaid({ paymentId: "payment-123" });

    // Then
    expect(result).toEqual({ kind: "cancelled" });
  });

  it("rejects an opaque provider notification without parsing it", async () => {
    // Given
    const gateway = createDisabledPaymentGateway();

    // When
    const result = await gateway.verifyNotification({
      provider: "sepay",
      payload: { transaction: "untrusted" },
    });

    // Then
    expect(result).toEqual({ kind: "rejected" });
  });
});
