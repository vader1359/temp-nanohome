import { describe, expect, it } from "vitest";

import { createVerifiedPaymentEvidence } from "../payments/contracts";
import type { CommerceState } from "./domain";
import { canTransitionCommerceState } from "./transition-policy";

const initial: CommerceState = {
  order: "created",
  inventory: "unchecked",
  amisExport: "not_started",
  payment: "requires_method",
};

const expectedPayment = {
  merchantReference: "invoice-1",
  amount: 1000,
  currency: "VND",
  provider: "sepay",
} as const;

describe("commerce transition policy", () => {
  it("allows an order transition without changing inventory", () => {
    // Given
    const next = { ...initial, order: "processing" } satisfies CommerceState;

    // When
    const result = canTransitionCommerceState(initial, next);

    // Then
    expect(result).toBe(true);
  });

  it("allows an inventory transition without changing order", () => {
    // Given
    const next = { ...initial, inventory: "checking" } satisfies CommerceState;

    // When
    const result = canTransitionCommerceState(initial, next);

    // Then
    expect(result).toBe(true);
  });

  it("requires provider-neutral verified evidence before payment becomes paid", () => {
    // Given
    const paid = { ...initial, payment: "paid" } satisfies CommerceState;
    const evidence = createVerifiedPaymentEvidence({
      provider: "sepay",
      merchantReference: "invoice-1",
      providerTransactionId: "transaction-1",
      amount: 1000,
      currency: "VND",
    });

    // When
    const withoutEvidence = canTransitionCommerceState(initial, paid, expectedPayment);
    const withEvidence = canTransitionCommerceState(initial, paid, expectedPayment, evidence);

    // Then
    expect(withoutEvidence).toBe(false);
    expect(withEvidence).toBe(true);
  });

  it.each([
    ["merchant reference", { ...expectedPayment, merchantReference: "invoice-2" }],
    ["amount", { ...expectedPayment, amount: 1001 }],
    ["currency", { ...expectedPayment, currency: "USD" }],
  ])("rejects verified evidence with a different %s", (_name, evidenceInput) => {
    // Given
    const paid = { ...initial, payment: "paid" } satisfies CommerceState;
    const evidence = createVerifiedPaymentEvidence({
      ...evidenceInput,
      provider: "sepay",
      providerTransactionId: "transaction-1",
    });

    // When
    const result = canTransitionCommerceState(initial, paid, expectedPayment, evidence);

    // Then
    expect(result).toBe(false);
  });

  it("rejects structurally forged payment evidence", () => {
    // Given
    const paid = { ...initial, payment: "paid" } satisfies CommerceState;
    const forgedEvidence = {
      provider: "sepay",
      merchantReference: "invoice-1",
      providerTransactionId: "transaction-1",
      amount: 1000,
      currency: "VND",
    };

    // When
    const result = canTransitionCommerceState(initial, paid, expectedPayment, forgedEvidence);

    // Then
    expect(result).toBe(false);
  });
});
