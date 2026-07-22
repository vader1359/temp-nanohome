export type RefundEvidence =
  | { readonly kind: "verified_paid"; readonly transactionId: string }
  | { readonly kind: "redirect_only" };

export type ZaloPayRefundDecision =
  | { readonly kind: "refunded" }
  | { readonly kind: "manual_required"; readonly reason: "full_refund_only" | "verified_payment_evidence_required" | "refund_query_failed" };

export const decideZaloPayRefund = (input: Readonly<{ readonly paidAmount: number; readonly requestedAmount: number; readonly evidence: RefundEvidence; readonly queryResult?: "refunded" | "failed" }>): ZaloPayRefundDecision => {
  if (input.requestedAmount !== input.paidAmount) return { kind: "manual_required", reason: "full_refund_only" };
  if (input.evidence.kind !== "verified_paid") return { kind: "manual_required", reason: "verified_payment_evidence_required" };
  if (input.queryResult === "refunded") return { kind: "refunded" };
  return { kind: "manual_required", reason: "refund_query_failed" };
};
