import type {
  PaymentCancellationResult,
  PaymentGateway,
  PaymentNotificationVerificationResult,
  PaymentResponse,
  PaymentRetrievalResult,
} from "@/lib/contracts";

export class PaymentDisabledError extends Error {
  constructor() {
    super("Payments are disabled.");
    this.name = "PaymentDisabledError";
  }
}

export const createDisabledPaymentGateway = (): PaymentGateway => ({
  createPayment(): Promise<PaymentResponse> {
    return Promise.reject(new PaymentDisabledError());
  },
  retrievePayment(): Promise<PaymentRetrievalResult> {
    return Promise.resolve({ kind: "unpaid" });
  },
  cancelUnpaid(): Promise<PaymentCancellationResult> {
    return Promise.resolve({ kind: "cancelled" });
  },
  verifyNotification(): Promise<PaymentNotificationVerificationResult> {
    return Promise.resolve({ kind: "rejected" });
  },
});
