import { describe, expect, it } from "vitest";

import { createCustomerAdvisorContext } from "./advisor-context";

describe("Customer Advisor context", () => {
  it("Given validated safe customer memory, When context is created, Then it projects only advisor-safe fields", () => {
    const result = createCustomerAdvisorContext({
      linkId: "link-1",
      preferredRoomIds: ["living-room"],
      preferredBrandIds: ["brand-1"],
      discussedVariantIds: ["variant-interested"],
      purchasedVariantIds: ["variant-purchased"],
      projectStage: "planning",
      sourceUpdatedAt: "2026-07-25T00:00:00.000Z",
    });

    expect(result).toEqual({
      preferredRoomIds: ["living-room"],
      preferredBrandIds: ["brand-1"],
      discussedVariantIds: ["variant-interested"],
      purchasedVariantIds: ["variant-purchased"],
      projectStage: "planning",
      sourceUpdatedAt: "2026-07-25T00:00:00.000Z",
    });
  });

  it("Given malformed, absent, or CRM-shaped memory, When context is created, Then it returns no advisor context", () => {
    expect(createCustomerAdvisorContext(null)).toBeNull();
    expect(createCustomerAdvisorContext({ linkId: "link-1" })).toBeNull();
    expect(createCustomerAdvisorContext({
      linkId: "link-1",
      preferredRoomIds: [],
      preferredBrandIds: [],
      discussedVariantIds: [],
      purchasedVariantIds: [],
      sourceUpdatedAt: "2026-07-25T00:00:00.000Z",
      email: "private@example.test",
    })).toBeNull();
  });
});
