export type ZaloPayPolicyDecision =
  | { readonly kind: "manual_required"; readonly reason: "operation_not_allowlisted" | "evidence_required" };

export const evaluateZaloPayOperation = (_operation: string): ZaloPayPolicyDecision => ({ kind: "manual_required", reason: _operation === "refund_without_evidence" ? "evidence_required" : "operation_not_allowlisted" });

export type RedactedZaloPayDiagnostic = Readonly<{
  readonly appTransId: string;
  readonly fields: readonly string[];
}>;

export const redactZaloPayDiagnostic = (input: Readonly<Record<string, string>>): RedactedZaloPayDiagnostic => ({
  appTransId: input.appTransId ?? "redacted",
  fields: Object.keys(input).filter((key) => key !== "appTransId"),
});
