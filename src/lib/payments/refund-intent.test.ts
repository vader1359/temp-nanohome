import { describe, expect, it } from "vitest";

import { createRefundIntent } from "./refund-intent";

describe("createRefundIntent", () => {
  it("creates an auditable manual refund intent with two distinct actors", () => {
    // Given
    const input = {
      orderId: "order-1",
      paymentTransactionId: "transaction-1",
      amount: 125000,
      currency: "VND" as const,
      requestedBy: "operator-1",
      approvedBy: "operator-2",
      evidence: "bank transfer receipt #42",
    };

    // When
    const result = createRefundIntent(input);

    // Then
    expect(result).toEqual({ kind: "created", intent: expect.objectContaining({ state: "manual_review", ...input }) });
  });

  it("rejects a self-approved or unsupported refund request", () => {
    // Given
    const input = {
      orderId: "order-1",
      paymentTransactionId: "transaction-1",
      amount: 0,
      currency: "VND" as const,
      requestedBy: "operator-1",
      approvedBy: "operator-1",
      evidence: "",
    };

    // When
    const result = createRefundIntent(input);

    // Then
    expect(result).toEqual({ kind: "rejected" });
  });
});
