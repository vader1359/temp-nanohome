import { describe, expect, it } from "vitest";

import { decideReconciliation } from "./reconciliation";

describe("decideReconciliation", () => {
  it("does not contact the provider while payment mode is off", () => {
    // Given
    const input = { mode: "off" as const, attemptState: "ambiguous" as const };

    // When
    const result = decideReconciliation(input);

    // Then
    expect(result).toEqual({ kind: "reconciliation_disabled" });
  });

  it("requests a status lookup only for an enabled ambiguous attempt", () => {
    // Given
    const input = { mode: "enabled" as const, attemptState: "ambiguous" as const };

    // When
    const result = decideReconciliation(input);

    // Then
    expect(result).toEqual({ kind: "retrieve_payment" });
  });

  it("does not reconcile a terminal payment", () => {
    // Given
    const input = { mode: "enabled" as const, attemptState: "paid" as const };

    // When
    const result = decideReconciliation(input);

    // Then
    expect(result).toEqual({ kind: "not_required" });
  });
});
