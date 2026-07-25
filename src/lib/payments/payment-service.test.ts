import { describe, expect, it, vi } from "vitest";

import { createPaymentService } from "./payment-service";

const attempt = {
  orderId: "order-1",
  merchantReference: "invoice-1",
  provider: "sepay" as const,
  amount: 125000,
  currency: "VND",
};

describe("createPaymentService", () => {
  it("returns a disabled result without invoking a gateway when payment mode is off", async () => {
    // Given
    const createPayment = vi.fn();
    const service = createPaymentService({ mode: "off", gateway: { createPayment } });

    // When
    const result = await service.create(attempt);

    // Then
    expect(result).toEqual({ kind: "payment_disabled", orderId: "order-1" });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("delegates payment creation only when explicitly enabled", async () => {
    // Given
    const created = { kind: "payment_created", attempt, redirectUrl: "https://pay.example/1" } as const;
    const createPayment = vi.fn().mockResolvedValue(created);
    const service = createPaymentService({ mode: "enabled", gateway: { createPayment } });

    // When
    const result = await service.create(attempt);

    // Then
    expect(result).toEqual(created);
    expect(createPayment).toHaveBeenCalledWith(attempt);
  });
});
