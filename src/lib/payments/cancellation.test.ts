import { describe, expect, it, vi } from "vitest";

import { cancelUnpaidPayment } from "./cancellation";

const attempt = {
  orderId: "order-1",
  merchantReference: "invoice-1",
  provider: "sepay" as const,
  amount: 125000,
  currency: "VND",
};

describe("cancelUnpaidPayment", () => {
  it("never calls a provider while payment mode is off", async () => {
    // Given
    const cancelUnpaid = vi.fn();

    // When
    const result = await cancelUnpaidPayment({ mode: "off", gateway: { cancelUnpaid }, attempt });

    // Then
    expect(result).toEqual({ kind: "cancellation_disabled" });
    expect(cancelUnpaid).not.toHaveBeenCalled();
  });

  it("asks the provider to cancel an awaiting payment when enabled", async () => {
    // Given
    const cancelUnpaid = vi.fn().mockResolvedValue(undefined);

    // When
    const result = await cancelUnpaidPayment({
      mode: "enabled",
      gateway: { cancelUnpaid },
      attempt,
      state: "awaiting_customer",
    });

    // Then
    expect(result).toEqual({ kind: "cancellation_requested" });
    expect(cancelUnpaid).toHaveBeenCalledWith(attempt);
  });

  it("does not cancel a paid attempt when enabled", async () => {
    // Given
    const cancelUnpaid = vi.fn();

    // When
    const result = await cancelUnpaidPayment({
      mode: "enabled",
      gateway: { cancelUnpaid },
      attempt,
      state: "paid",
    });

    // Then
    expect(result).toEqual({ kind: "already_paid" });
    expect(cancelUnpaid).not.toHaveBeenCalled();
  });
});
