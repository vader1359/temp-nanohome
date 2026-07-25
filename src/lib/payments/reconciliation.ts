import type { PaymentMode } from "./contracts";

export type ReconciliationAttemptState = "ambiguous" | "paid" | "customer_left" | "expired";

export type ReconciliationDecision =
  | Readonly<{ readonly kind: "reconciliation_disabled" }>
  | Readonly<{ readonly kind: "retrieve_payment" }>
  | Readonly<{ readonly kind: "not_required" }>;

export const decideReconciliation = (input: Readonly<{
  readonly mode: PaymentMode;
  readonly attemptState: ReconciliationAttemptState;
}>): ReconciliationDecision => {
  switch (input.mode) {
    case "off":
      return { kind: "reconciliation_disabled" };
    case "enabled":
      switch (input.attemptState) {
        case "ambiguous":
          return { kind: "retrieve_payment" };
        case "paid":
        case "customer_left":
        case "expired":
          return { kind: "not_required" };
      }
  }
};
