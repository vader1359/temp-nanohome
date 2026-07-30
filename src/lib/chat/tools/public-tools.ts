import "server-only";

import { z } from "zod";
import { isCloudinaryUrl, isR2PublicMediaUrl } from "@/lib/image";

import { publicChatToolCallSchema, type PublicChatToolCall, type PublicChatLocale } from "../contracts";
import type { ShoppingCatalogSearchRequest } from "../shopping-intent";

const publicIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const publicAttributeKeySchema = z.enum([
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
const publicImageSourceSchema = z.string().min(2).max(2_000).refine(
  (value) => isCloudinaryUrl(value) || isR2PublicMediaUrl(value),
  "Catalog image is not an approved public media URL",
);
const publicCatalogPriceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fixed"), amount: z.number().finite().nonnegative(), currency: z.string().min(1).max(12) }).strict(),
  z.object({ mode: z.literal("contact") }).strict(),
  z.object({ mode: z.literal("unavailable") }).strict(),
]);
const publicCatalogRecordSchema = z
  .object({
    canonicalId: publicIdentifierSchema,
    variantId: publicIdentifierSchema,
    title: z.string().min(1).max(300),
    canonicalLink: z.string().min(2).max(2_000).regex(/^\/(?!\/)/),
    image: z.object({ id: publicIdentifierSchema, alt: z.string().min(1).max(300), src: publicImageSourceSchema.optional() }).strict(),
    price: publicCatalogPriceSchema,
    stock: z.object({ state: z.enum(["available", "unavailable", "unknown"]) }).strict(),
    attributes: z.record(z.string().max(100), z.string().max(300)).refine(
      (attributes) => Object.keys(attributes).every((key) => publicAttributeKeySchema.safeParse(key).success),
      "Catalog attributes are not allowlisted",
    ),
    eligible: z.boolean(),
    current: z.boolean(),
  })
  .strict();
const publicSitePageSchema = z
  .object({
    sectionKey: z.enum(["delivery", "warranty", "consultation", "contact", "returns"]),
    locale: z.enum(["vi", "en", "ko"]),
    title: z.string().min(1).max(1_000).refine(isRenderSafeText, "Public page text is not render-safe"),
    body: z.string().min(1).max(1_000).refine(isRenderSafeText, "Public page text is not render-safe"),
  })
  .strict();
const publicHandoffSchema = z.object({ id: publicIdentifierSchema, reasonCode: z.enum(["unsupported_request", "staff_confirmation_required"]) }).strict();

type PublicCatalogPrice =
  | { readonly mode: "fixed"; readonly amount: number; readonly currency: string }
  | { readonly mode: "contact" }
  | { readonly mode: "unavailable" };
type PublicCatalogStock = { readonly state: "available" | "unavailable" | "unknown" };
export type PublicCatalogRecord = {
  readonly canonicalId: string;
  readonly variantId: string;
  readonly title: string;
  readonly canonicalLink: string;
  readonly image: { readonly id: string; readonly alt: string; readonly src?: string };
  readonly price: PublicCatalogPrice;
  readonly stock: PublicCatalogStock;
  readonly attributes: Readonly<Record<string, string>>;
};

type PublicCatalogAdapterRecord = PublicCatalogRecord & { readonly eligible: boolean; readonly current: boolean };

export type PublicCatalogAdapters = {
  readonly search: (query: string, limit: number, signal?: AbortSignal) => Promise<readonly PublicCatalogAdapterRecord[]>;
  readonly searchStructured?: (
    request: ShoppingCatalogSearchRequest,
    signal?: AbortSignal,
  ) => Promise<readonly PublicCatalogAdapterRecord[]>;
  readonly details: (canonicalIds: readonly string[], signal?: AbortSignal) => Promise<readonly PublicCatalogAdapterRecord[]>;
  readonly compare: (
    variantIds: readonly string[],
    attributeKeys: readonly string[],
    signal?: AbortSignal,
  ) => Promise<readonly PublicCatalogAdapterRecord[]>;
};
export type PublicSitePage = { readonly sectionKey: string; readonly locale: PublicChatLocale; readonly title: string; readonly body: string };
export type PublicChatToolAdapters = {
  readonly catalog: PublicCatalogAdapters;
  readonly site: { readonly page: (sectionKey: string, locale: PublicChatLocale, signal?: AbortSignal) => Promise<PublicSitePage | null> };
  readonly handoff: {
    readonly create: (input: { readonly reasonCode: "unsupported_request" | "staff_confirmation_required" }, signal?: AbortSignal) => Promise<{ readonly id: string; readonly reasonCode: string }>;
  };
};

export type PublicChatToolResult =
  | { readonly kind: "catalog"; readonly records: readonly PublicCatalogRecord[] }
  | { readonly kind: "comparison"; readonly records: readonly PublicCatalogRecord[]; readonly attributeKeys: readonly string[] }
  | { readonly kind: "page"; readonly page: PublicSitePage }
  | { readonly kind: "handoff"; readonly id: string; readonly reasonCode: "unsupported_request" | "staff_confirmation_required" }
  | { readonly kind: "capability_unavailable"; readonly capability: "customer" | "order" | "vision" | "recommendation" }
  | { readonly kind: "not_found"; readonly resource: "catalog" | "page" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "adapter_error"; readonly operation: PublicChatToolCall["name"] };

export const publicChatCapabilities = {
  customer: false,
  order: false,
  vision: false,
  recommendation: false,
} as const;

function isRenderSafeText(value: string): boolean {
  return !/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\bhttps?:\/\/|\bftp:\/\/|\bjavascript:/i.test(value);
}

function parseCatalogRecords(records: readonly PublicCatalogAdapterRecord[]): readonly PublicCatalogAdapterRecord[] {
  return z.array(publicCatalogRecordSchema).parse(records);
}

function projectCatalogRecord(record: PublicCatalogAdapterRecord): PublicCatalogRecord {
  return {
    canonicalId: record.canonicalId,
    variantId: record.variantId,
    title: record.title,
    canonicalLink: record.canonicalLink,
    image: record.image,
    price: record.price,
    stock: record.stock,
    attributes: record.attributes,
  };
}

function eligible(records: readonly PublicCatalogAdapterRecord[]): readonly PublicCatalogRecord[] {
  return records.filter((record) => record.eligible && record.current).map(projectCatalogRecord);
}

function hasDistinctBoundedIds(ids: readonly string[], maximum: number): boolean {
  return ids.length <= maximum && new Set(ids).size === ids.length;
}

function hasOnlyRequestedRecords(
  records: readonly (PublicCatalogRecord | PublicCatalogAdapterRecord)[],
  ids: readonly string[],
  field: "canonicalId" | "variantId",
): boolean {
  const requested = new Set(ids);
  return records.length === ids.length && records.every((record) => requested.has(record[field]));
}

function hasUniqueRecordIds(records: readonly PublicCatalogAdapterRecord[], field: "canonicalId" | "variantId"): boolean {
  return new Set(records.map((record) => record[field])).size === records.length;
}

function hasDistinctValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export async function executePublicChatTool(input: unknown, adapters: PublicChatToolAdapters, signal?: AbortSignal): Promise<PublicChatToolResult> {
  const parsed = publicChatToolCallSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid_request" };
  try {
    if (signal?.aborted) return { kind: "adapter_error", operation: parsed.data.name };
     const result = await executeParsedTool(parsed.data, adapters, signal);
     return signal?.aborted ? { kind: "adapter_error", operation: parsed.data.name } : result;
  } catch (error) {
    if (error instanceof Error) return { kind: "adapter_error", operation: parsed.data.name };
    return { kind: "adapter_error", operation: parsed.data.name };
  }
}

async function executeParsedTool(tool: PublicChatToolCall, adapters: PublicChatToolAdapters, signal?: AbortSignal): Promise<PublicChatToolResult> {
  switch (tool.name) {
    case "search_catalog": {
      const parsedRecords = parseCatalogRecords(await adapters.catalog.search(tool.arguments.query, tool.arguments.limit, signal));
      if (!hasUniqueRecordIds(parsedRecords, "variantId")) return { kind: "adapter_error", operation: tool.name };
      const records = eligible(parsedRecords);
      return { kind: "catalog", records: records.slice(0, tool.arguments.limit) };
    }
    case "search_catalog_v2": {
      if (adapters.catalog.searchStructured === undefined) {
        return { kind: "adapter_error", operation: tool.name };
      }
      const parsedRecords = parseCatalogRecords(await adapters.catalog.searchStructured(tool.arguments, signal));
      if (!hasUniqueRecordIds(parsedRecords, "variantId")) return { kind: "adapter_error", operation: tool.name };
      const records = eligible(parsedRecords);
      return { kind: "catalog", records: records.slice(0, tool.arguments.limit) };
    }
    case "get_product_details": {
      if (!hasDistinctValues(tool.arguments.canonicalIds)) return { kind: "invalid_request" };
      const parsedRecords = parseCatalogRecords(await adapters.catalog.details(tool.arguments.canonicalIds, signal));
      if (!hasUniqueRecordIds(parsedRecords, "canonicalId") || !hasOnlyRequestedRecords(parsedRecords, tool.arguments.canonicalIds, "canonicalId")) {
        return { kind: "adapter_error", operation: tool.name };
      }
      const records = eligible(parsedRecords);
      return records.length === tool.arguments.canonicalIds.length
        ? { kind: "catalog", records }
        : { kind: "not_found", resource: "catalog" };
    }
    case "compare_products": {
      if (!hasDistinctBoundedIds(tool.arguments.variantIds, 3) || !hasDistinctValues(tool.arguments.attributeKeys)) return { kind: "invalid_request" };
      const parsedRecords = parseCatalogRecords(await adapters.catalog.compare(tool.arguments.variantIds, tool.arguments.attributeKeys, signal));
      if (!hasUniqueRecordIds(parsedRecords, "variantId") || !hasOnlyRequestedRecords(parsedRecords, tool.arguments.variantIds, "variantId")) {
        return { kind: "adapter_error", operation: tool.name };
      }
      const records = eligible(parsedRecords);
      return records.length === tool.arguments.variantIds.length
        ? { kind: "comparison", records, attributeKeys: tool.arguments.attributeKeys }
        : { kind: "not_found", resource: "catalog" };
    }
    case "get_public_page": {
      const rawPage = await adapters.site.page(tool.arguments.sectionKey, tool.arguments.locale, signal);
      const page = rawPage === null ? null : publicSitePageSchema.parse(rawPage);
      return page === null || page.sectionKey !== tool.arguments.sectionKey || page.locale !== tool.arguments.locale
        ? { kind: "not_found", resource: "page" }
        : { kind: "page", page };
    }
    case "create_staff_handoff": {
      const handoff = publicHandoffSchema.parse(await adapters.handoff.create(tool.arguments, signal));
      return handoff.reasonCode === tool.arguments.reasonCode
        ? { kind: "handoff", id: handoff.id, reasonCode: handoff.reasonCode }
        : { kind: "adapter_error", operation: tool.name };
    }
    case "get_recommendations":
      return { kind: "capability_unavailable", capability: "recommendation" };
  }
}
