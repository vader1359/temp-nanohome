import { describe, expect, it } from "vitest";

import { applyPaymentEvent, createPaymentRecord } from "./state";

describe("applyPaymentEvent", () => {
  it("marks an awaiting attempt paid once and retains duplicate event idempotency", () => {
    // Given
    const record = createPaymentRecord({ orderId: "order-1", merchantReference: "invoice-1" });

    // When
    const first = applyPaymentEvent({ record, providerEventId: "event-1", kind: "payment_verified" });
    const duplicate = applyPaymentEvent({ record: first.record, providerEventId: "event-1", kind: "payment_verified" });

    // Then
    expect(first).toEqual({ kind: "applied", record: expect.objectContaining({ state: "paid" }) });
    expect(duplicate).toEqual({ kind: "duplicate", record: first.record });
  });

  it("quarantines conflicting duplicate provider events", () => {
    // Given
    const record = createPaymentRecord({ orderId: "order-1", merchantReference: "invoice-1" });
    const applied = applyPaymentEvent({ record, providerEventId: "event-1", kind: "payment_verified" });

    // When
    const result = applyPaymentEvent({ record: applied.record, providerEventId: "event-1", kind: "payment_cancelled" });

    // Then
    expect(result).toEqual({ kind: "conflict", record: expect.objectContaining({ state: "manual_review" }) });
  });

  it("prevents a cancellation from regressing a paid payment", () => {
    // Given
    const record = createPaymentRecord({ orderId: "order-1", merchantReference: "invoice-1" });
    const paid = applyPaymentEvent({ record, providerEventId: "event-1", kind: "payment_verified" });

    // When
    const result = applyPaymentEvent({ record: paid.record, providerEventId: "event-2", kind: "payment_cancelled" });

    // Then
    expect(result).toEqual({ kind: "ignored", record: paid.record });
  });
});
