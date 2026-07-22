import type {
  ChatAnswer,
  ClientCustomerContext,
  CommerceOrderSnapshot,
  CommerceReferences,
  CustomerMemory,
  RecommendationRequest,
  RecommendationResponse,
  RoomScene,
  ServerCustomerContext,
  VisualSimilarityResponse,
} from "./schemas";

export const serverCustomerContextFixture = {
  visitorId: "visitor-1",
  sessionId: "session-1",
  userId: null,
  locale: "vi",
  consent: { analytics: true, personalization: true, aiProcessing: true, aiConversationStorage: false, roomImageProcessing: false, roomImageStorage: false, version: "1" },
} satisfies ServerCustomerContext;

export const clientCustomerContextFixture = {
  locale: "vi",
  consent: { analytics: true, personalization: true, aiProcessing: true, aiConversationStorage: false, roomImageProcessing: false, roomImageStorage: false, version: "1" },
  capabilities: { recommendations: true, "visual-search": true },
} satisfies ClientCustomerContext;

export const customerMemoryFixture = {
  linkId: "link-1", preferredRoomIds: ["room-1"], preferredBrandIds: ["brand-1"], discussedVariantIds: ["variant-1"], purchasedVariantIds: [], sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
} satisfies CustomerMemory;

export const recommendationRequestFixture = {
  placement: "home",
  contextVariantIds: [], locale: "vi",
  preferenceKeys: ["style"],
} satisfies RecommendationRequest;

export const recommendationResponseFixture = {
  requestId: "request-1",
  algorithmVersion: "v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  fallbackTier: "personalized",
  placement: "home",
  items: [{ variantId: "variant-1", reasonCode: "style_match" }],
} satisfies RecommendationResponse;

export const commerceOrderSnapshotFixture = {
  orderId: "order-1",
  status: "processing",
  itemReferences: [{ variantId: "variant-1", quantity: 1 }],
  totalAmount: 600,
  currency: "VND",
} satisfies CommerceOrderSnapshot;

export const commerceReferencesFixture = {
  webOrderId: "order-1", amisSaleOrderId: null, zaloPayAppTransId: null, zaloPayTransactionId: null,
} satisfies CommerceReferences;

export const roomSceneFixture = {
  analysisId: "analysis-1", roomType: "living-room", styleTags: ["modern"], palette: ["warm"], materials: ["wood"], detectedFurniture: ["sofa"], lightingTags: ["natural"], userMeasurements: { width: 4 }, constraints: [], uncertainties: [], confidence: 0.9, providerVersion: "v1",
} satisfies RoomScene;

export const visualSimilarityResponseFixture = {
  requestId: "request-1", modelId: "model-1", modelVersion: "v1", queryImageHash: "hash-1", neighbors: [{ variantId: "variant-1", imageId: "image-1" }],
} satisfies VisualSimilarityResponse;

export const chatAnswerFixture = {
  answerId: "answer-1",
  messageReference: "message-1",
  references: commerceReferencesFixture,
} satisfies ChatAnswer;
