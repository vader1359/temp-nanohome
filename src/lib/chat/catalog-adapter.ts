import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { firstProductImage } from "@/lib/image";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";

import type { PublicChatLocale } from "./contracts";
import type {
  PublicCatalogAdapters,
  PublicCatalogRecord,
} from "./tools/public-tools";

type CatalogAdapterRecord = PublicCatalogRecord & {
  readonly eligible: boolean;
  readonly current: boolean;
};

const nullableCatalogTextSchema = z.string().nullable();
const publicChatCatalogVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  name_vi: nullableCatalogTextSchema,
  name_ko: nullableCatalogTextSchema,
  description: nullableCatalogTextSchema,
  description_vi: nullableCatalogTextSchema,
  description_ko: nullableCatalogTextSchema,
  designer_description: nullableCatalogTextSchema,
  designer_description_vi: nullableCatalogTextSchema,
  designer_description_ko: nullableCatalogTextSchema,
  short_name: nullableCatalogTextSchema,
  short_name_vi: nullableCatalogTextSchema,
  short_name_ko: nullableCatalogTextSchema,
  slug: nullableCatalogTextSchema,
  slug_vi: nullableCatalogTextSchema,
  slug_ko: nullableCatalogTextSchema,
  packshot_url: nullableCatalogTextSchema,
  gallery_urls: z.array(z.string()),
  finish: nullableCatalogTextSchema,
  finish_vi: nullableCatalogTextSchema,
  finish_ko: nullableCatalogTextSchema,
  size: nullableCatalogTextSchema,
  product_name_denorm: nullableCatalogTextSchema,
  product_line: nullableCatalogTextSchema,
  designer_name: nullableCatalogTextSchema,
  filter_category: nullableCatalogTextSchema,
  filter_product_line: nullableCatalogTextSchema,
  cldr_media_lifestyle_1: nullableCatalogTextSchema,
  cldr_media_lifestyle_2: nullableCatalogTextSchema,
  media_long: nullableCatalogTextSchema,
  media_closeup: nullableCatalogTextSchema,
  product_id: nullableCatalogTextSchema,
  product_name: nullableCatalogTextSchema,
  localized_product_name: nullableCatalogTextSchema,
  brand_name: nullableCatalogTextSchema,
  public_price: z.number().finite().nonnegative().nullable(),
  public_price_mode: z.enum(["fixed", "contact", "unavailable"]),
  public_stock_state: z.enum(["available", "unknown"]),
  is_recommendable: z.boolean(),
  is_current: z.boolean(),
}).strict();

type PublicChatCatalogVariant = Readonly<z.infer<typeof publicChatCatalogVariantSchema>>;

export type PublicCatalogAdapterDependencies = Readonly<{
  searchVariants: (
    query: string,
    limit: number,
    signal?: AbortSignal,
  ) => Promise<readonly PublicChatCatalogVariant[]>;
}>;

const defaultDependencies: PublicCatalogAdapterDependencies = {
  searchVariants: searchPublicChatCatalogVariants,
};

const searchAliases: readonly Readonly<{ readonly pattern: RegExp; readonly query: string }>[] = [
  { pattern: /ghế/iu, query: "chair" },
  { pattern: /chairs?/iu, query: "chair" },
  { pattern: /bàn/iu, query: "table" },
  { pattern: /tables?/iu, query: "table" },
  { pattern: /đèn/iu, query: "lamp" },
  { pattern: /lamps?/iu, query: "lamp" },
  { pattern: /sofa/iu, query: "sofa" },
  { pattern: /giường/iu, query: "bed" },
  { pattern: /beds?/iu, query: "bed" },
  { pattern: /tủ/iu, query: "cabinet" },
  { pattern: /cabinets?/iu, query: "cabinet" },
  { pattern: /bình hoa/iu, query: "vase" },
  { pattern: /vases?/iu, query: "vase" },
  { pattern: /의자/iu, query: "chair" },
  { pattern: /테이블|탁자/iu, query: "table" },
  { pattern: /조명|램프/iu, query: "lamp" },
  { pattern: /소파/iu, query: "sofa" },
  { pattern: /침대/iu, query: "bed" },
  { pattern: /수납장|캐비닛/iu, query: "cabinet" },
  { pattern: /꽃병|화병/iu, query: "vase" },
];

export function catalogSearchQueries(query: string): readonly string[] {
  const normalized = query.trim();
  const aliases = searchAliases.flatMap(({ pattern, query: alias }) => pattern.test(normalized) ? [alias] : []);
  return [...new Set([normalized, ...aliases])].filter((item) => item.length > 0).slice(0, 3);
}

export async function searchPublicChatCatalogVariants(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<readonly PublicChatCatalogVariant[]> {
  const normalizedQuery = query.trim().slice(0, 240);
  if (normalizedQuery.length === 0) return [];

  const integerLimit = Number.isFinite(limit) ? Math.trunc(limit) : 5;
  const boundedLimit = Math.min(Math.max(integerLimit, 1), 12);
  const endpoint = new URL(
    "/rest/v1/rpc/search_public_chat_catalog",
    env.NEXT_PUBLIC_SUPABASE_URL,
  );
  endpoint.searchParams.set("search_query", normalizedQuery);
  endpoint.searchParams.set("result_limit", String(boundedLimit));

  const response = await supabaseReadOnlyFetch(endpoint, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Public chat catalog search failed: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Public chat catalog search response was not an array");
  }
  return data.flatMap((row) => {
    const parsed = publicChatCatalogVariantSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Catalog request aborted");
  error.name = "AbortError";
  throw error;
}

async function retryCatalogRead<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await operation();
    } catch (error) {
      throwIfAborted(signal);
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Public chat catalog read unavailable");
}

function safeText(value: unknown, maximum = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\bhttps?:\/\/[^\s)]+/giu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function localizedVariantText(
  variant: PublicChatCatalogVariant,
  locale: PublicChatLocale,
  field: "name" | "short_name" | "finish" | "description" | "designer_description",
): string {
  const localized =
    locale === "vi"
      ? variant[`${field}_vi`]
      : locale === "ko"
        ? variant[`${field}_ko`]
        : variant[field];
  const english = variant[field];
  const vietnamese = variant[`${field}_vi`];
  const korean = variant[`${field}_ko`];
  return safeText(localized) || safeText(english) || safeText(vietnamese) || safeText(korean);
}

function priceFor(variant: PublicChatCatalogVariant): PublicCatalogRecord["price"] {
  if (
    variant.public_price_mode === "fixed" &&
    variant.public_price !== null &&
    variant.public_price > 1
  ) {
    return { mode: "fixed", amount: variant.public_price, currency: "VND" };
  }
  if (
    variant.public_price_mode === "contact" ||
    (variant.public_price_mode === "fixed" &&
      variant.public_price !== null &&
      variant.public_price <= 1)
  ) {
    return { mode: "contact" };
  }
  return { mode: "unavailable" };
}

function stockFor(variant: PublicChatCatalogVariant): PublicCatalogRecord["stock"] {
  return variant.public_stock_state === "available"
    ? { state: "available" }
    : { state: "unknown" };
}

function attributesFor(
  variant: PublicChatCatalogVariant,
  locale: PublicChatLocale,
): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  const dimensions = safeText(variant.size);
  const finish = localizedVariantText(variant, locale, "finish");
  const brand = safeText(variant.brand_name);
  const product = safeText(
    locale === "vi"
      ? variant.localized_product_name
      : locale === "ko"
        ? variant.product_name_denorm ?? variant.product_name
        : variant.product_name,
  );
  const designer = safeText(variant.designer_name);
  const category = safeText(variant.filter_category);
  const collection = safeText(variant.filter_product_line) || safeText(variant.product_line);
  const description = localizedVariantText(variant, locale, "description");
  const designerDescription = localizedVariantText(
    variant,
    locale,
    "designer_description",
  );
  if (dimensions.length > 0) attributes.dimensions = dimensions;
  if (finish.length > 0) attributes.finish = finish;
  if (brand.length > 0) attributes.brand = brand;
  if (product.length > 0) attributes.product = product;
  if (designer.length > 0) attributes.designer = designer;
  if (category.length > 0) attributes.category = category;
  if (collection.length > 0) attributes.collection = collection;
  if (description.length > 0) attributes.description = description;
  if (designerDescription.length > 0) {
    attributes.designer_description = designerDescription;
  }
  return attributes;
}

function toCatalogRecord(
  variant: PublicChatCatalogVariant,
  locale: PublicChatLocale,
): CatalogAdapterRecord | undefined {
  const title =
    localizedVariantText(variant, locale, "name") ||
    localizedVariantText(variant, locale, "short_name");
  if (title.length === 0) return undefined;
  const galleryUrls = Array.isArray(variant.gallery_urls)
    ? variant.gallery_urls
    : [];
  const imageUrl = firstProductImage([
    variant.packshot_url,
    ...galleryUrls,
    variant.cldr_media_lifestyle_1,
    variant.cldr_media_lifestyle_2,
    variant.media_long,
    variant.media_closeup,
  ]);
  const hasCanonicalImage =
    variant.is_recommendable &&
    imageUrl !== "/images/placeholder.webp";
  return {
    canonicalId: variant.product_id ?? variant.id,
    variantId: variant.id,
    title,
    canonicalLink: `/${locale}${variantDetailHref(variant, locale)}`,
    // Public chat schemas accept only approved public media.  Do not let an
    // unsupported image from one non-eligible variant invalidate the whole
    // catalog result before eligible records can be filtered in.
    image: hasCanonicalImage
      ? { id: variant.id, alt: title, src: imageUrl }
      : { id: variant.id, alt: title },
    price: priceFor(variant),
    stock: stockFor(variant),
    attributes: attributesFor(variant, locale),
    eligible: variant.is_recommendable && hasCanonicalImage,
    current: variant.is_current,
  };
}

async function loadExactCatalogRecords(
  ids: readonly string[],
  field: "canonicalId" | "variantId",
  locale: PublicChatLocale,
  dependencies: PublicCatalogAdapterDependencies,
  signal?: AbortSignal,
): Promise<readonly CatalogAdapterRecord[]> {
  const recordsByRequestedId = await Promise.all(ids.map(async (id) => {
    const variants = await retryCatalogRead(
      () => dependencies.searchVariants(id, 12, signal),
      signal,
    );
    const records = variants.flatMap((variant) => {
      const record = toCatalogRecord(variant, locale);
      return record === undefined ? [] : [record];
    });
    return records.find((record) => record[field] === id);
  }));
  throwIfAborted(signal);
  return recordsByRequestedId.flatMap((record) => record === undefined ? [] : [record]);
}

export function createPublicCatalogAdapters(
  locale: PublicChatLocale,
  dependencies: PublicCatalogAdapterDependencies = defaultDependencies,
): PublicCatalogAdapters {
  return {
    search: async (query, limit, signal) => {
      throwIfAborted(signal);
      const queries = catalogSearchQueries(query);
      const variantSettlements = await Promise.allSettled(
        queries.map((candidate) =>
          retryCatalogRead(
            () => dependencies.searchVariants(candidate, limit, signal),
            signal,
          ),
        ),
      );
      throwIfAborted(signal);
      const variantLists = variantSettlements.flatMap((settlement) =>
        settlement.status === "fulfilled" ? [settlement.value] : []
      );
      if (variantLists.length === 0 && queries.length > 0) {
        const failure = variantSettlements.find(
          (settlement): settlement is PromiseRejectedResult =>
            settlement.status === "rejected",
        );
        throw failure?.reason instanceof Error
          ? failure.reason
          : new Error("Public chat catalog search unavailable");
      }
      const variants = variantLists.flat();
      const seenVariantIds = new Set<string>();
      const variantRecords = variants.flatMap((variant) => {
        if (seenVariantIds.has(variant.id)) return [];
        seenVariantIds.add(variant.id);
        const record = toCatalogRecord(variant, locale);
        return record === undefined ? [] : [record];
      });
      return variantRecords.slice(0, limit);
    },
    details: (canonicalIds, signal) =>
      loadExactCatalogRecords(canonicalIds, "canonicalId", locale, dependencies, signal),
    compare: (variantIds, _attributeKeys, signal) =>
      loadExactCatalogRecords(variantIds, "variantId", locale, dependencies, signal),
  };
}
