import { describe, expect, it } from "vitest";

import { evaluateZaloPayOperation, redactZaloPayDiagnostic } from "./zalopay-policy";

describe("ZaloPay operation policy", () => {
  it("defaults to deny and requires manual evidence", () => {
    expect(evaluateZaloPayOperation("unknown_operation")).toEqual({ kind: "manual_required", reason: "operation_not_allowlisted" });
    expect(evaluateZaloPayOperation("refund_without_evidence")).toEqual({ kind: "manual_required", reason: "evidence_required" });
  });

  it("redacts secrets and payloads from diagnostics", () => {
    expect(redactZaloPayDiagnostic({ appTransId: "260722-order-42", key1: "secret", rawData: "private" })).toEqual({ appTransId: "260722-order-42", fields: ["key1", "rawData"] });
  });
});
