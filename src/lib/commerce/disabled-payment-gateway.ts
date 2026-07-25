import type {
  PaymentCancellationResult,
  PaymentGateway,
  PaymentNotification,
  PaymentNotificationVerificationResult,
  PaymentRequest,
  PaymentResponse,
  PaymentRetrieval,
  PaymentRetrievalResult,
} from "@/lib/contracts";

export class PaymentDisabledError extends Error {
  constructor() {
    super("Payments are disabled.");
    this.name = "PaymentDisabledError";
  }
}

export const createDisabledPaymentGateway = (): PaymentGateway => ({
  createPayment(_input: PaymentRequest): Promise<PaymentResponse> {
    return Promise.reject(new PaymentDisabledError());
  },
  retrievePayment(_input: PaymentRetrieval): Promise<PaymentRetrievalResult> {
    return Promise.resolve({ kind: "unpaid" });
  },
  cancelUnpaid(_input: PaymentRetrieval): Promise<PaymentCancellationResult> {
    return Promise.resolve({ kind: "cancelled" });
  },
  verifyNotification(_input: PaymentNotification): Promise<PaymentNotificationVerificationResult> {
    return Promise.resolve({ kind: "rejected" });
  },
});
