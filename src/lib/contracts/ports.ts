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

export interface InventoryProvider {
  getAvailability(skus: readonly string[]): Promise<readonly InventoryAvailability[]>;
}

export interface OperationalOrderProvider {
  getOrderSnapshot(orderId: string): Promise<CommerceOrderSnapshot>;
}

export interface ZaloPayGateway {
  createPayment(input: PaymentRequest): Promise<PaymentResponse>;
}

export interface CustomerMemoryPort {
  getForAuthenticatedCustomer(input: {
    readonly userId: string;
    readonly purpose: "concierge" | "personalization";
  }): Promise<CustomerMemory | null>;
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
