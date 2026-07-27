import type { PaymentAttempt, PaymentMode } from "./contracts";

export type CancellationResult =
  | Readonly<{ readonly kind: "cancellation_disabled" }>
  | Readonly<{ readonly kind: "already_paid" }>
  | Readonly<{ readonly kind: "cancellation_requested" }>;

type PaymentCancellationGateway = Readonly<{
  readonly cancelUnpaid: (attempt: PaymentAttempt) => Promise<unknown>;
}>;

export const cancelUnpaidPayment = async (input: Readonly<{
  readonly mode: PaymentMode;
  readonly gateway: PaymentCancellationGateway;
  readonly attempt: PaymentAttempt;
  readonly state?: "awaiting_customer" | "paid";
}>): Promise<CancellationResult> => {
  switch (input.mode) {
    case "off":
      return { kind: "cancellation_disabled" };
    case "enabled":
      if (input.state === "paid") return { kind: "already_paid" };
      await input.gateway.cancelUnpaid(input.attempt);
      return { kind: "cancellation_requested" };
  }
};
