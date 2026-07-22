import { z } from "zod";

const publicChatIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const publicChatTextSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine(
    (value) => !/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\bhttps?:\/\//i.test(value),
    "Public chat text cannot contain HTML, Markdown images, or URLs",
  );
const publicChatAttributeKeySchema = z.enum([
  "dimensions",
  "material",
  "finish",
  "color",
  "brand",
  "category",
  "product",
  "designer",
  "collection",
  "description",
  "designer_description",
]);
const publicChatHandoffReasonSchema = z.enum([
  "unsupported_request",
  "staff_confirmation_required",
]);

export const publicChatLocaleSchema = z.enum(["vi", "en", "ko"]);

const publicChatBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product_cards"), variantIds: z.array(publicChatIdentifierSchema).min(1).max(8) }).strict(),
  z
    .object({
      type: z.literal("comparison"),
      variantIds: z.array(publicChatIdentifierSchema).min(2).max(4),
      attributeKeys: z.array(publicChatAttributeKeySchema).min(1).max(6),
    })
    .strict(),
  z.object({ type: z.literal("image_gallery"), canonicalImageIds: z.array(publicChatIdentifierSchema).min(1).max(8) }).strict(),
  z.object({ type: z.literal("recommendations"), requestId: publicChatIdentifierSchema }).strict(),
  z.object({ type: z.literal("link_list"), sourceIds: z.array(publicChatIdentifierSchema).min(1).max(8) }).strict(),
  z.object({ type: z.literal("staff_handoff"), reasonCode: publicChatHandoffReasonSchema }).strict(),
]);

export const publicChatAnswerSchema = z
  .object({
    text: publicChatTextSchema,
    blocks: z.array(publicChatBlockSchema).max(8),
    evidence: z.array(z.object({ sourceId: publicChatIdentifierSchema }).strict()).max(12),
    followUps: z.array(publicChatTextSchema).max(3),
  })
  .strict();

export const publicChatToolCallSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("search_catalog"),
      arguments: z
        .object({
          query: z
            .string()
            .min(1)
            .max(240)
            .refine(
              (value) => !/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\bhttps?:\/\//i.test(value),
              "Catalog queries cannot contain HTML, Markdown images, or URLs",
            ),
          limit: z.number().int().min(1).max(12),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal("get_product_details"),
      arguments: z.object({ canonicalIds: z.array(publicChatIdentifierSchema).min(1).max(8) }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal("compare_products"),
      arguments: z
        .object({
          variantIds: z.array(publicChatIdentifierSchema).min(2).max(4),
          attributeKeys: z.array(publicChatAttributeKeySchema).min(1).max(6),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal("get_recommendations"),
      arguments: z.object({ contextVariantIds: z.array(publicChatIdentifierSchema).max(4) }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal("get_public_page"),
      arguments: z.object({ sectionKey: z.enum(["delivery", "warranty", "consultation", "contact", "returns"]), locale: publicChatLocaleSchema }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal("create_staff_handoff"),
      arguments: z.object({ reasonCode: publicChatHandoffReasonSchema }).strict(),
    })
    .strict(),
]);

export type PublicChatAnswer = z.infer<typeof publicChatAnswerSchema>;
export type PublicChatLocale = z.infer<typeof publicChatLocaleSchema>;
export type PublicChatToolCall = z.infer<typeof publicChatToolCallSchema>;
export type PublicChatToolName = PublicChatToolCall["name"];
