import type { CommerceState, PaymentState } from "./domain";
import { hasVerifiedZaloPayEvidence, type ZaloPayPaymentEvidence } from "./zalopay-adapter";

export type PaymentEvidence = ZaloPayPaymentEvidence;

type StateAxis = keyof CommerceState;

const axes: readonly StateAxis[] = ["order", "inventory", "amisExport", "payment"];

const changedAxes = (before: CommerceState, after: CommerceState): readonly StateAxis[] =>
  axes.filter((axis) => before[axis] !== after[axis]);

const isPaidTransition = (before: PaymentState, after: PaymentState): boolean =>
  before !== "paid" && after === "paid";

export const canTransitionCommerceState = (
  before: CommerceState,
  after: CommerceState,
  evidence?: unknown,
): boolean => {
  const changed = changedAxes(before, after);
  if (changed.length !== 1) return false;
  if (!isPaidTransition(before.payment, after.payment)) return true;
  return hasVerifiedZaloPayEvidence(evidence);
};
