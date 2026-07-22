import { describe, expect, it } from "vitest";

import { canCreateAmisSaleOrderDraft, canProcessManualRefund } from "./feature-gates";

describe("commerce feature gates", () => {
  it("denies AMIS Sale Order mutation by default", () => {
    expect(canCreateAmisSaleOrderDraft({})).toBe(false);
  });

  it("requires explicit enablement for AMIS Sale Order mutation", () => {
    expect(canCreateAmisSaleOrderDraft({ amisSaleOrderDraftEnabled: true })).toBe(true);
  });

  it("denies manual refunds without explicit evidence policy", () => {
    expect(canProcessManualRefund({ manualRefundEnabled: true })).toBe(false);
  });

  it("allows manual refunds only with explicit enablement and evidence", () => {
    expect(
      canProcessManualRefund({
        manualRefundEnabled: true,
        manualRefundEvidenceRequired: true,
      }),
    ).toBe(true);
  });
});
