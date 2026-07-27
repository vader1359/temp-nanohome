export type RefundIntent = Readonly<{
  readonly orderId: string;
  readonly paymentTransactionId: string;
  readonly amount: number;
  readonly currency: "VND";
  readonly requestedBy: string;
  readonly approvedBy: string;
  readonly evidence: string;
  readonly state: "manual_review";
}>;

export type CreateRefundIntentResult =
  | Readonly<{ readonly kind: "created"; readonly intent: RefundIntent }>
  | Readonly<{ readonly kind: "rejected" }>;

export const createRefundIntent = (input: Omit<RefundIntent, "state">): CreateRefundIntentResult => {
  if (
    !Number.isFinite(input.amount)
    || input.amount <= 0
    || input.requestedBy === input.approvedBy
    || input.evidence.trim().length === 0
  ) {
    return { kind: "rejected" };
  }
  return { kind: "created", intent: { ...input, state: "manual_review" } };
};
