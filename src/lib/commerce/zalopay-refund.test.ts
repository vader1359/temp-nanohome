import { describe, expect, it } from "vitest";

import { decideZaloPayRefund, type RefundEvidence } from "./zalopay-refund";

describe("ZaloPay refunds", () => {
  const evidence: RefundEvidence = { kind: "verified_paid", transactionId: "zp-1" };

  it("requires a full refund and verified payment evidence", () => {
    expect(decideZaloPayRefund({ paidAmount: 1000, requestedAmount: 999, evidence })).toEqual({ kind: "manual_required", reason: "full_refund_only" });
    expect(decideZaloPayRefund({ paidAmount: 1000, requestedAmount: 1000, evidence: { kind: "redirect_only" } })).toEqual({ kind: "manual_required", reason: "verified_payment_evidence_required" });
  });

  it("uses query results as final refund state", () => {
    expect(decideZaloPayRefund({ paidAmount: 1000, requestedAmount: 1000, evidence, queryResult: "refunded" })).toEqual({ kind: "refunded" });
    expect(decideZaloPayRefund({ paidAmount: 1000, requestedAmount: 1000, evidence, queryResult: "failed" })).toEqual({ kind: "manual_required", reason: "refund_query_failed" });
  });
});
