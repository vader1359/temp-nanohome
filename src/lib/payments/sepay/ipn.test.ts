import { describe, expect, it } from "vitest";

import { maximumSePayIpnBodyBytes, verifySePayIpn } from "./ipn";

const secret = "ipn-secret";
const timestamp = "2026-07-25T10:00:00.000Z";

const payload = JSON.stringify({
  timestamp,
  notification_type: "ORDER_PAID",
  order: {
    order_status: "CAPTURED",
    order_currency: "VND",
    order_amount: "125000",
    order_invoice_number: "order-42",
  },
  transaction: {
    id: "event-42",
    transaction_id: "transaction-42",
    payment_method: "BANK_TRANSFER",
    transaction_status: "APPROVED",
    amount: "125000",
    currency: "VND",
  },
  customer: { id: "customer-42" },
});

describe("verifySePayIpn", () => {
  it("accepts an authenticated captured payment matching its immutable order", () => {
    // Given
    const input = {
      rawBody: payload,
      secret,
      suppliedSecret: secret,
      receivedAt: new Date(timestamp),
      expected: { merchantReference: "order-42", amount: 125000, currency: "VND" as const },
    };

    // When
    const result = verifySePayIpn(input);

    // Then
    expect(result).toEqual({
      kind: "verified",
      evidence: expect.objectContaining({
        merchantReference: "order-42",
        providerTransactionId: "transaction-42",
        amount: 125000,
        currency: "VND",
      }),
      providerEventId: "event-42",
      delayed: false,
    });
  });

  it.each([
    ["wrong secret", { suppliedSecret: "forged" }],
    ["wrong amount", { expected: { merchantReference: "order-42", amount: 1, currency: "VND" as const } }],
    ["wrong reference", { expected: { merchantReference: "other-order", amount: 125000, currency: "VND" as const } }],
    ["unsupported notification", { rawBody: payload.replace("ORDER_PAID", "ORDER_CANCELLED") }],
  ])("rejects %s", (_name, patch) => {
    // Given
    const input = {
      rawBody: payload,
      secret,
      suppliedSecret: secret,
      receivedAt: new Date(timestamp),
      expected: { merchantReference: "order-42", amount: 125000, currency: "VND" as const },
      ...patch,
    };

    // When
    const result = verifySePayIpn(input);

    // Then
    expect(result).toEqual({ kind: "rejected" });
  });

  it("rejects a raw body exceeding the bounded IPN limit before parsing", () => {
    // Given
    const input = {
      rawBody: "x".repeat(maximumSePayIpnBodyBytes + 1),
      secret,
      suppliedSecret: secret,
      receivedAt: new Date(timestamp),
      expected: { merchantReference: "order-42", amount: 125000, currency: "VND" as const },
    };

    // When
    const result = verifySePayIpn(input);

    // Then
    expect(result).toEqual({ kind: "rejected" });
  });

  it.each([
    ["fractional VND", payload.replace('"125000"', '"125000.01"')],
    ["unsafe VND integer", payload.replace('"125000"', '"9007199254740993"')],
  ])("rejects %s amounts", (_name, rawBody) => {
    // Given
    const input = {
      rawBody,
      secret,
      suppliedSecret: secret,
      receivedAt: new Date(timestamp),
      expected: { merchantReference: "order-42", amount: 125000, currency: "VND" as const },
    };

    // When
    const result = verifySePayIpn(input);

    // Then
    expect(result).toEqual({ kind: "rejected" });
  });

  it("records delayed delivery without treating it as an invalid signature", () => {
    // Given
    const input = {
      rawBody: payload,
      secret,
      suppliedSecret: secret,
      receivedAt: new Date("2026-07-25T10:20:01.000Z"),
      expected: { merchantReference: "order-42", amount: 125000, currency: "VND" as const },
    };

    // When
    const result = verifySePayIpn(input);

    // Then
    expect(result).toMatchObject({ kind: "verified", delayed: true });
  });
});
