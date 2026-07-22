import { z } from "zod";

const localeSchema = z.union([z.literal("vi"), z.literal("en"), z.literal("ko")]);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const consentSchema = z.object({
  analytics: z.boolean(), personalization: z.boolean(), aiProcessing: z.boolean(),
  aiConversationStorage: z.boolean(), roomImageProcessing: z.boolean(), roomImageStorage: z.boolean(),
  version: z.string().min(1),
}).strict();

export const serverCustomerContextSchema = z.object({ visitorId: z.string().min(1), sessionId: z.string().min(1), userId: z.string().min(1).nullable(), locale: localeSchema, consent: consentSchema }).strict();
export const clientCustomerContextSchema = z.object({ locale: localeSchema, consent: consentSchema, capabilities: z.record(z.string(), z.boolean()) }).strict();

export const recommendationRequestSchema = z.discriminatedUnion("placement", [
  z.object({ placement: z.literal("pdp"), contextVariantIds: z.tuple([z.string().min(1)]), locale: z.string().min(1) }).strict(),
  z.object({ placement: z.literal("chat"), contextVariantIds: z.tuple([z.string().min(1)]), locale: z.string().min(1) }).strict(),
  z.object({ placement: z.literal("cart"), contextVariantIds: z.array(z.string().min(1)), locale: z.string().min(1) }).strict(),
  z.object({ placement: z.literal("home"), contextVariantIds: z.tuple([]), locale: z.string().min(1), preferenceKeys: z.array(z.string().min(1)).optional() }).strict(),
  z.object({ placement: z.literal("room"), contextVariantIds: z.tuple([]), locale: z.string().min(1), roomSceneId: z.string().min(1) }).strict(),
]);

export const recommendationResponseSchema = z.object({ requestId: z.string().min(1), algorithmVersion: z.string().min(1), placement: z.string().min(1), generatedAt: isoDateTimeSchema, fallbackTier: z.string().min(1), items: z.array(z.object({ variantId: z.string().min(1), reasonCode: z.string().min(1) }).strict()) }).strict();

export const customerMemorySchema = z.object({
  linkId: z.string().min(1), customerType: z.string().min(1).optional(), customerSinceBucket: z.string().min(1).optional(),
  preferredRoomIds: z.array(z.string().min(1)), preferredBrandIds: z.array(z.string().min(1)), discussedVariantIds: z.array(z.string().min(1)), purchasedVariantIds: z.array(z.string().min(1)),
  projectStage: z.string().min(1).optional(), customerVisibleSummary: z.string().min(1).optional(), lastInteractionAt: isoDateTimeSchema.optional(), sourceUpdatedAt: isoDateTimeSchema,
}).strict();

export const roomSceneSchema = z.object({
  analysisId: z.string().min(1), roomType: z.string().min(1).nullable(), styleTags: z.array(z.string().min(1)), palette: z.array(z.string().min(1)), materials: z.array(z.string().min(1)), detectedFurniture: z.array(z.string().min(1)), lightingTags: z.array(z.string().min(1)), userMeasurements: z.record(z.string(), z.number()), constraints: z.array(z.string().min(1)), uncertainties: z.array(z.string().min(1)), confidence: z.number().min(0).max(1), providerVersion: z.string().min(1),
}).strict();

export const visualSimilarityResponseSchema = z.object({ requestId: z.string().min(1), modelId: z.string().min(1), modelVersion: z.string().min(1), queryImageHash: z.string().min(1), neighbors: z.array(z.object({ variantId: z.string().min(1), imageId: z.string().min(1) }).strict()) }).strict();
export const commerceOrderSnapshotSchema = z.object({ orderId: z.string().min(1), status: z.string().min(1), itemReferences: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().positive() }).strict()), totalAmount: z.number().nonnegative(), currency: z.string().length(3) }).strict();
export const commerceReferencesSchema = z.object({ webOrderId: z.string().min(1), amisSaleOrderId: z.string().min(1).nullable(), zaloPayAppTransId: z.string().min(1).nullable(), zaloPayTransactionId: z.string().min(1).nullable() }).strict();
export const chatAnswerSchema = z.object({ answerId: z.string().min(1), messageReference: z.string().min(1), references: commerceReferencesSchema }).strict();

type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ServerCustomerContext = DeepReadonly<z.infer<typeof serverCustomerContextSchema>>;
export type ClientCustomerContext = DeepReadonly<z.infer<typeof clientCustomerContextSchema>>;
export type RecommendationRequest = DeepReadonly<z.infer<typeof recommendationRequestSchema>>;
export type RecommendationResponse = DeepReadonly<z.infer<typeof recommendationResponseSchema>>;
export type CustomerMemory = DeepReadonly<z.infer<typeof customerMemorySchema>>;
export type RoomScene = DeepReadonly<z.infer<typeof roomSceneSchema>>;
export type VisualSimilarityResponse = DeepReadonly<z.infer<typeof visualSimilarityResponseSchema>>;
export type CommerceOrderSnapshot = DeepReadonly<z.infer<typeof commerceOrderSnapshotSchema>>;
export type CommerceReferences = DeepReadonly<z.infer<typeof commerceReferencesSchema>>;
export type ChatAnswer = DeepReadonly<z.infer<typeof chatAnswerSchema>>;
