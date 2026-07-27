import { describe, expect, it } from "vitest";

import { createPaymentDisabledResult, hasVerifiedPaymentEvidence } from "./contracts";

describe("payment contracts", () => {
  it("returns a provider-neutral disabled result without a payment attempt", () => {
    // Given
    const orderId = "order-1";

    // When
    const result = createPaymentDisabledResult(orderId);

    // Then
    expect(result).toEqual({ kind: "payment_disabled", orderId });
  });

  it("does not accept a structurally forged payment evidence object", () => {
    // Given
    const forgedEvidence = {
      provider: "sepay",
      merchantReference: "invoice-1",
      providerTransactionId: "transaction-1",
      amount: 150_000,
      currency: "VND",
    };

    // When
    const verified = hasVerifiedPaymentEvidence(forgedEvidence);

    // Then
    expect(verified).toBe(false);
  });
});
