import {
  createPaymentDisabledResult,
  type PaymentAttempt,
  type PaymentCreationResult,
  type PaymentMode,
} from "./contracts";

type PaymentCreationGateway = Readonly<{
  readonly createPayment: (attempt: PaymentAttempt) => Promise<PaymentCreationResult>;
}>;

export type PaymentService = Readonly<{
  readonly create: (attempt: PaymentAttempt) => Promise<PaymentCreationResult>;
}>;

export const createPaymentService = (input: Readonly<{
  readonly mode: PaymentMode;
  readonly gateway: PaymentCreationGateway;
}>): PaymentService => ({
  create: async (attempt) => {
    switch (input.mode) {
      case "off":
        return createPaymentDisabledResult(attempt.orderId);
      case "enabled":
        return input.gateway.createPayment(attempt);
    }
  },
});
