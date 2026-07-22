import { z } from "zod";

import type { RenderSafePublicChatAnswer } from "./resolution";

const identifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const textSchema = z.string().min(1).max(1_000).refine((value) => !/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\b(?:https?|ftp):\/\/|\bjavascript:/i.test(value));
const responseIdSchema = z.string().regex(/^chat_[a-f0-9]{32}$/);
const catalogPriceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fixed"), amount: z.number().finite().nonnegative(), currency: z.string().min(1).max(12) }).strict(),
  z.object({ mode: z.literal("contact") }).strict(),
  z.object({ mode: z.literal("unavailable") }).strict(),
]);
const catalogStockSchema = z.object({ state: z.enum(["available", "unavailable", "unknown"]) }).strict();
const attributeKeySchema = z.enum([
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
const imageSourceSchema = z.string().min(2).max(2_000).refine((value) => {
  if (value.startsWith("/images/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "res.cloudinary.com" && url.pathname.startsWith("/nanohome-web/")) return true;
    const publicMediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL;
    return publicMediaUrl !== undefined && url.origin === new URL(publicMediaUrl).origin;
  } catch {
    return false;
  }
});
const attributesSchema = z.record(z.string().max(100), textSchema).refine(
  (attributes) => Object.keys(attributes).every((key) => attributeKeySchema.safeParse(key).success),
  "Catalog attributes are not allowlisted",
);
const safeProductSchema = z.object({
  variantId: identifierSchema,
  title: textSchema,
  canonicalId: identifierSchema.optional(),
  canonicalLink: z.string().regex(/^\/(?!\/)/).optional(),
  image: z.object({ canonicalImageId: identifierSchema, alt: textSchema, src: imageSourceSchema.optional() }).strict().optional(),
  price: catalogPriceSchema.optional(),
  stock: catalogStockSchema.optional(),
  attributes: attributesSchema.optional(),
}).strict();
const safeBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product_cards"), products: z.array(safeProductSchema).min(1).max(8).readonly() }).strict(),
  z.object({ type: z.literal("comparison"), products: z.array(safeProductSchema).min(2).max(4).readonly(), attributeKeys: z.array(attributeKeySchema).min(1).max(6).readonly() }).strict(),
  z.object({ type: z.literal("image_gallery"), images: z.array(z.object({ canonicalImageId: identifierSchema, alt: textSchema, src: imageSourceSchema.optional() }).strict()).min(1).max(8).readonly() }).strict(),
  z.object({ type: z.literal("link_list"), sources: z.array(z.object({ sourceId: identifierSchema, label: textSchema }).strict()).min(1).max(8).readonly() }).strict(),
  z.object({ type: z.literal("staff_handoff"), reasonCode: z.enum(["unsupported_request", "staff_confirmation_required"]) }).strict(),
]);

export const publicChatRequestSchema = z
  .object({
    question: textSchema,
    locale: z.enum(["vi", "en", "ko"]),
    messageRef: identifierSchema,
  })
  .strict();

const startedEventSchema = z.object({ type: z.literal("message_started"), responseId: responseIdSchema }).strict();
const deltaEventSchema = z.object({ type: z.literal("text_delta"), responseId: responseIdSchema, text: textSchema }).strict();
const toolStartedEventSchema = z.object({ type: z.literal("tool_started"), responseId: responseIdSchema, tool: z.enum(["search_catalog", "get_product_details", "compare_products", "get_recommendations", "get_public_page", "create_staff_handoff"]) }).strict();
const blockEventSchema = z.object({ type: z.literal("block_ready"), responseId: responseIdSchema, block: safeBlockSchema }).strict();
const evidenceEventSchema = z.object({ type: z.literal("evidence_ready"), responseId: responseIdSchema, sourceId: identifierSchema, label: textSchema }).strict();
const completedEventSchema = z.object({ type: z.literal("message_completed"), responseId: responseIdSchema }).strict();
const failedEventSchema = z.object({ type: z.literal("message_failed"), responseId: responseIdSchema, status: z.literal("cancelled") }).strict();

export const publicChatEventSchema = z.discriminatedUnion("type", [
  startedEventSchema,
  deltaEventSchema,
  toolStartedEventSchema,
  blockEventSchema,
  evidenceEventSchema,
  completedEventSchema,
  failedEventSchema,
]);

export type PublicChatRequest = z.infer<typeof publicChatRequestSchema>;
export type PublicChatEvent = z.infer<typeof publicChatEventSchema>;

function assertNever(value: never): never {
  throw new TypeError(`Unexpected chat event: ${JSON.stringify(value)}`);
}

export function encodePublicChatEvent(event: PublicChatEvent): Uint8Array {
  switch (event.type) {
    case "message_started":
    case "text_delta":
    case "tool_started":
    case "block_ready":
    case "evidence_ready":
    case "message_completed":
    case "message_failed":
      return new TextEncoder().encode(`${JSON.stringify(publicChatEventSchema.parse(event))}\n`);
    default:
      return assertNever(event);
  }
}

export function answerEvents(responseId: string, answer: RenderSafePublicChatAnswer): readonly PublicChatEvent[] {
  const events: PublicChatEvent[] = [{ type: "text_delta", responseId, text: textSchema.parse(answer.text) }];
  for (const block of answer.blocks) {
    const parsed = safeBlockSchema.safeParse(block);
    if (parsed.success) events.push({ type: "block_ready", responseId, block: parsed.data });
  }
  for (const source of answer.evidence) {
    const parsed = evidenceEventSchema.safeParse({ type: "evidence_ready", responseId, sourceId: source.sourceId, label: source.label });
    if (parsed.success) events.push(parsed.data);
  }
  return events;
}
