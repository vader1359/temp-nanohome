import type { AccountId } from "@/lib/account-session";
import type {
  CustomerMemory,
  CommerceOrderSnapshot,
  RecommendationRequest,
  RecommendationResponse,
  RoomScene,
  VisualSimilarityResponse,
} from "./schemas";

export type InventoryAvailability = {
  readonly sku: string;
  readonly available: boolean;
  readonly quantity: number;
};

export type PaymentRequest = {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
};

export type PaymentResponse = {
  readonly paymentId: string;
  readonly checkoutUrl: string;
};

export type PaymentNotification = {
  readonly provider: string;
  readonly payload: unknown;
};

export type VerifiedPaymentEvidence = {
  readonly provider: string;
  readonly paymentId: string;
  readonly orderId: string;
  readonly providerTransactionId: string;
  readonly amount: number;
  readonly currency: string;
};

export type PaymentRetrieval = {
  readonly paymentId: string;
};

export type PaymentRetrievalResult =
  | { readonly kind: "paid"; readonly evidence: VerifiedPaymentEvidence }
  | { readonly kind: "unpaid" }
  | { readonly kind: "processing" }
  | { readonly kind: "failed" }
  | { readonly kind: "ambiguous" };

export type PaymentCancellationResult =
  | { readonly kind: "cancelled" }
  | { readonly kind: "already_paid"; readonly evidence: VerifiedPaymentEvidence }
  | { readonly kind: "ambiguous" };

export type PaymentNotificationVerificationResult =
  | { readonly kind: "verified"; readonly evidence: VerifiedPaymentEvidence }
  | { readonly kind: "rejected" };

export type PaymentRefundIntent = {
  readonly evidence: VerifiedPaymentEvidence;
  readonly refundId: string;
  readonly amount: number;
  readonly reason: string;
};

export interface InventoryProvider {
  getAvailability(skus: readonly string[]): Promise<readonly InventoryAvailability[]>;
}

export interface OperationalOrderProvider {
  getOrderSnapshot(orderId: string): Promise<CommerceOrderSnapshot>;
}

export interface ZaloPayGateway {
  createPayment(input: PaymentRequest): Promise<PaymentResponse>;
}

export interface PaymentGateway {
  createPayment(input: PaymentRequest): Promise<PaymentResponse>;
  retrievePayment(input: PaymentRetrieval): Promise<PaymentRetrievalResult>;
  cancelUnpaid(input: PaymentRetrieval): Promise<PaymentCancellationResult>;
  verifyNotification(input: PaymentNotification): Promise<PaymentNotificationVerificationResult>;
}

export interface CustomerMemoryPort {
  getForAuthenticatedCustomer(input: {
    readonly accountId: AccountId;
    readonly purpose: "concierge" | "personalization";
  }): Promise<CustomerMemory | null>;
}

export interface NotificationPort {
  notify(message: {
    readonly subject: string;
    readonly body: string;
  }): Promise<{ readonly kind: "sent" | "skipped" }>;
}

export interface RecommendationPort {
  recommend(request: RecommendationRequest): Promise<RecommendationResponse>;
}

export interface VisionProvider {
  describeRoom(imageReference: string): Promise<RoomScene>;
}

export interface VisualSimilarityPort {
  findSimilar(imageReference: string): Promise<VisualSimilarityResponse>;
}
