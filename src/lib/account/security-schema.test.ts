import { describe, expect, it } from "vitest";

import { parseDeletionConfirmation, parseSecurityAuthAction } from "./security-schema";

describe("security schemas", () => {
  it("accepts only the declared placeholder auth actions", () => {
    // Given: known and forged client actions.
    // When: each crosses the API boundary.
    // Then: only an enum member is accepted.
    expect(parseSecurityAuthAction({ action: "unlink_email" })).toEqual({ action: "unlink_email" });
    expect(parseSecurityAuthAction({ action: "reset-password", email: "forged@example.com" })).toBeNull();
  });

  it("requires an exact DELETE deletion confirmation", () => {
    // Given: correctly and incorrectly cased confirmations.
    // When: they cross the deletion boundary.
    // Then: only the exact destructive phrase is accepted.
    expect(parseDeletionConfirmation({ confirmation: "DELETE" })).toEqual({ confirmation: "DELETE" });
    expect(parseDeletionConfirmation({ confirmation: "delete" })).toBeNull();
  });
});
