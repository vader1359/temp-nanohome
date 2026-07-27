import { hasVerifiedPaymentEvidence, type VerifiedPaymentEvidence } from "../payments/contracts";
import type { CommerceState, PaymentState } from "./domain";

export type PaymentEvidence = VerifiedPaymentEvidence;

export type ExpectedPaymentEvidence = Readonly<{
  readonly provider: PaymentEvidence["provider"];
  readonly merchantReference: string;
  readonly amount: number;
  readonly currency: string;
}>;

type StateAxis = keyof CommerceState;

const axes: readonly StateAxis[] = ["order", "inventory", "amisExport", "payment"];

const changedAxes = (before: CommerceState, after: CommerceState): readonly StateAxis[] =>
  axes.filter((axis) => before[axis] !== after[axis]);

const isPaidTransition = (before: PaymentState, after: PaymentState): boolean =>
  before !== "paid" && after === "paid";

const matchesExpectedPayment = (
  evidence: PaymentEvidence,
  expected: ExpectedPaymentEvidence,
): boolean =>
  evidence.provider === expected.provider
  && evidence.merchantReference === expected.merchantReference
  && evidence.amount === expected.amount
  && evidence.currency === expected.currency;

export const canTransitionCommerceState = (
  before: CommerceState,
  after: CommerceState,
  expectedPayment?: ExpectedPaymentEvidence,
  evidence?: unknown,
): boolean => {
  const changed = changedAxes(before, after);
  if (changed.length !== 1) return false;
  if (!isPaidTransition(before.payment, after.payment)) return true;
  return expectedPayment !== undefined
    && hasVerifiedPaymentEvidence(evidence)
    && matchesExpectedPayment(evidence, expectedPayment);
};
