import { describe, expect, it } from "vitest";
import { clientCustomerContextSchema, commerceReferencesSchema, customerMemorySchema, recommendationRequestSchema, roomSceneSchema, serverCustomerContextSchema, visualSimilarityResponseSchema } from "./index";
import type { PaymentGateway, PaymentRefundIntent, VerifiedPaymentEvidence } from "./index";

const consent = { analytics: true, personalization: true, aiProcessing: true, aiConversationStorage: false, roomImageProcessing: false, roomImageStorage: false, version: "1" };

describe("Plan 00 frozen contracts", () => {
  it("Given exact consent and capabilities, When parsed, Then contexts are accepted", () => {
    expect(serverCustomerContextSchema.safeParse({ visitorId: "v", sessionId: "s", userId: null, locale: "vi", consent }).success).toBe(true);
    expect(clientCustomerContextSchema.safeParse({ locale: "en", consent, capabilities: { recommendation: true } }).success).toBe(true);
  });

  it("Given identifiers, PII, or Plan 01 marketing consent in forbidden locations, When parsed, Then they are rejected", () => {
    expect(serverCustomerContextSchema.safeParse({ visitorId: "v", sessionId: "s", userId: null, locale: "vi", consent, email: "x" }).success).toBe(false);
    expect(clientCustomerContextSchema.safeParse({ locale: "vi", consent, capabilities: {}, visitorId: "v" }).success).toBe(false);
    expect(clientCustomerContextSchema.safeParse({ locale: "vi", consent: { ...consent, marketing: true }, capabilities: {} }).success).toBe(false);
  });

  it("Given placement-specific context cardinality, When parsed, Then only documented tuples pass", () => {
    expect(recommendationRequestSchema.safeParse({ placement: "pdp", contextVariantIds: ["v"], locale: "vi" }).success).toBe(true);
    expect(recommendationRequestSchema.safeParse({ placement: "cart", contextVariantIds: [], locale: "vi" }).success).toBe(true);
    expect(recommendationRequestSchema.safeParse({ placement: "home", contextVariantIds: ["v"], locale: "vi" }).success).toBe(false);
    expect(recommendationRequestSchema.safeParse({ placement: "room", contextVariantIds: [], locale: "vi", roomSceneId: "a" }).success).toBe(true);
  });

  it("Given exact safe DTO shapes, When parsed, Then memory scene similarity and commerce pass", () => {
    expect(customerMemorySchema.safeParse({ linkId: "l", preferredRoomIds: [], preferredBrandIds: [], discussedVariantIds: [], purchasedVariantIds: [], sourceUpdatedAt: "2026-01-01T00:00:00.000Z" }).success).toBe(true);
    expect(roomSceneSchema.safeParse({ analysisId: "a", roomType: null, styleTags: [], palette: [], materials: [], detectedFurniture: [], lightingTags: [], userMeasurements: {}, constraints: [], uncertainties: [], confidence: 1, providerVersion: "v1" }).success).toBe(true);
    expect(visualSimilarityResponseSchema.safeParse({ requestId: "r", modelId: "m", modelVersion: "v1", queryImageHash: "h", neighbors: [] }).success).toBe(true);
    expect(commerceReferencesSchema.safeParse({ webOrderId: "o", amisSaleOrderId: null, zaloPayAppTransId: null, zaloPayTransactionId: null }).success).toBe(true);
  });

  it("Given an unverified notification, When a gateway verifies it, Then paid evidence is required for a refund intent", async () => {
    // Given: a provider-neutral gateway with an opaque notification payload.
    const evidence: VerifiedPaymentEvidence = {
      provider: "fixture-pay",
      paymentId: "payment-1",
      orderId: "order-1",
      providerTransactionId: "transaction-1",
      amount: 250_000,
      currency: "VND",
    };
    const gateway: PaymentGateway = {
      createPayment: async () => ({ paymentId: "payment-1", checkoutUrl: "https://payments.example/checkout" }),
      retrievePayment: async () => ({ kind: "paid", evidence }),
      cancelUnpaid: async () => ({ kind: "cancelled" }),
      verifyNotification: async () => ({ kind: "verified", evidence }),
    } satisfies PaymentGateway;
    const refund: PaymentRefundIntent = {
      evidence,
      refundId: "refund-1",
      amount: 250_000,
      reason: "customer_request",
    };

    // When: the opaque notification is verified.
    const result = await gateway.verifyNotification({ provider: "fixture-pay", payload: { reference: "external" } });

    // Then: verification produces evidence that can safely anchor the intent.
    expect(result).toEqual({ kind: "verified", evidence });
    expect(refund.evidence.paymentId).toBe("payment-1");
  });
});
