import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { firstProductImage } from "@/lib/image";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";

import type { PublicChatLocale } from "./contracts";
import type { ShoppingCatalogSearchRequest } from "./shopping-intent";
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
  filter_sub_category: nullableCatalogTextSchema.optional(),
  filter_brand: nullableCatalogTextSchema.optional(),
  filter_room: z.array(z.string()).optional(),
  filter_room_vi: z.array(z.string()).optional(),
  filter_room_ko: z.array(z.string()).optional(),
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
  searchVariantsStructured?: (
    request: ShoppingCatalogSearchRequest,
    signal?: AbortSignal,
  ) => Promise<readonly PublicChatCatalogVariant[]>;
}>;

const defaultDependencies: PublicCatalogAdapterDependencies = {
  searchVariants: searchPublicChatCatalogVariants,
  searchVariantsStructured: searchPublicChatCatalogVariantsV2,
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

  return fetchCatalogVariants(endpoint, signal);
}

function arrayQueryValue(values: readonly string[]): string {
  return `{${values.join(",")}}`;
}

export async function searchPublicChatCatalogVariantsV2(
  request: ShoppingCatalogSearchRequest,
  signal?: AbortSignal,
): Promise<readonly PublicChatCatalogVariant[]> {
  const endpoint = new URL(
    "/rest/v1/rpc/search_public_chat_catalog_v2",
    env.NEXT_PUBLIC_SUPABASE_URL,
  );
  endpoint.searchParams.set("search_text", request.searchText ?? "");
  endpoint.searchParams.set("product_family_keys", arrayQueryValue(request.productFamilies));
  endpoint.searchParams.set("subtype_keys", arrayQueryValue(request.subtypes));
  endpoint.searchParams.set("category_keys", arrayQueryValue(request.categoryKeys));
  endpoint.searchParams.set("collection_keys", arrayQueryValue(request.collectionKeys));
  endpoint.searchParams.set("room_keys", arrayQueryValue(request.roomKeys));
  endpoint.searchParams.set("brand_keys", arrayQueryValue(request.brandKeys));
  endpoint.searchParams.set("designer_keys", arrayQueryValue(request.designerKeys));
  endpoint.searchParams.set("material_keys", arrayQueryValue(request.materialKeys));
  endpoint.searchParams.set("color_keys", arrayQueryValue(request.colorKeys));
  if (request.minPrice !== undefined) endpoint.searchParams.set("min_price", String(request.minPrice));
  if (request.maxPrice !== undefined) endpoint.searchParams.set("max_price", String(request.maxPrice));
  endpoint.searchParams.set("availability_mode", request.availability);
  endpoint.searchParams.set("sort_mode", request.sort);
  endpoint.searchParams.set("result_limit", String(request.limit));

  return fetchCatalogVariants(endpoint, signal);
}

async function fetchCatalogVariants(
  endpoint: URL,
  signal?: AbortSignal,
): Promise<readonly PublicChatCatalogVariant[]> {

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

function normalizedFacetText(values: readonly (string | null | undefined)[]): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/đ/gu, "d")
    .replace(/[_-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsFacet(text: string, value: string): boolean {
  const normalized = normalizedFacetText([value]);
  if (normalized.length === 0) return false;
  if (normalized.includes(" ")) return text.includes(normalized);
  return new Set(text.split(" ")).has(normalized);
}

function hasAnyFacet(text: string, values: readonly string[]): boolean {
  return values.some((value) => containsFacet(text, value));
}

function variantFacetText(variant: PublicChatCatalogVariant): string {
  return normalizedFacetText([
    variant.name,
    variant.name_vi,
    variant.name_ko,
    variant.short_name,
    variant.short_name_vi,
    variant.short_name_ko,
    variant.product_name,
    variant.product_name_denorm,
    variant.localized_product_name,
    variant.filter_category,
    variant.filter_sub_category,
    variant.filter_product_line,
    variant.product_line,
    variant.finish,
    variant.finish_vi,
    variant.finish_ko,
    variant.description,
    variant.description_vi,
    variant.description_ko,
  ]);
}

function variantRoomText(variant: PublicChatCatalogVariant): string {
  return normalizedFacetText([
    ...(variant.filter_room ?? []),
    ...(variant.filter_room_vi ?? []),
    ...(variant.filter_room_ko ?? []),
  ]);
}

const familyAliases: Readonly<Record<string, readonly string[]>> = {
  table: ["table", "tables", "ban", "ban an", "coffee table", "side table", "console table"],
  desk: ["desk", "work desk", "ban lam viec"],
  lamp: ["lamp", "lamps", "light", "lights", "den", "den chieu sang"],
  chair: ["chair", "chairs", "ghe"],
  sofa: ["sofa", "sofas"],
  bed: ["bed", "beds", "giuong"],
  cabinet: ["cabinet", "cabinets", "storage", "tu", "tu do"],
  mirror: ["mirror", "mirrors", "guong"],
  vase: ["vase", "vases", "binh hoa"],
  rug: ["rug", "rugs", "tham"],
  cushion: ["cushion", "cushions", "goi"],
  accessory: ["accessory", "accessories", "phu kien", "nen"],
};

function matchesFamily(variant: PublicChatCatalogVariant, family: string): boolean {
  const text = variantFacetText(variant);
  const aliases = familyAliases[family] ?? [family];
  if (family === "table" && hasAnyFacet(text, ["lamp", "light", "den lamp", "table lamp"])) return false;
  if (family === "desk" && hasAnyFacet(text, ["table lamp", "dining table"])) return false;
  return hasAnyFacet(text, aliases);
}

const subtypeAliases: Readonly<Record<string, readonly string[]>> = {
  dining_table: ["dining table", "dining tables", "ban an", "dining"],
  coffee_table: ["coffee table", "ban cafe"],
  side_table: ["side table", "ban ben"],
  console_table: ["console table", "ban console"],
  work_desk: ["work desk", "desk", "ban lam viec"],
  table_lamp: ["table lamp", "den ban"],
  dining_chair: ["dining chair", "ghe ban an", "dining"],
  lounge_chair: ["lounge chair", "ghe lounge", "lounge"],
};

function matchesSubtype(variant: PublicChatCatalogVariant, subtype: string): boolean {
  return hasAnyFacet(variantFacetText(variant), subtypeAliases[subtype] ?? [subtype]);
}

const roomAliases: Readonly<Record<string, readonly string[]>> = {
  living: ["living", "living room", "living-room", "phong khach"],
  dining: ["dining", "dining room", "dining-room", "phong an"],
  bedroom: ["bedroom", "bed room", "phong ngu"],
  office: ["office", "workspace", "phong lam viec"],
  outdoor: ["outdoor", "balcony", "ban cong", "ngoai troi"],
};

const categoryAliases: Readonly<Record<string, readonly string[]>> = {
  table: ["table", "tables"],
  desk: ["desk", "desks"],
  lamp: ["lamp", "lamps", "lighting", "lights"],
  chair: ["chair", "chairs"],
  sofa: ["sofa", "sofas"],
  bed: ["bed", "beds"],
  cabinet: ["cabinet", "cabinets", "storage"],
  mirror: ["mirror", "mirrors"],
  vase: ["vase", "vases"],
  rug: ["rug", "rugs"],
  cushion: ["cushion", "cushions"],
  accessory: ["accessory", "accessories"],
};

function matchesKeyList(text: string, keys: readonly string[], aliases: Readonly<Record<string, readonly string[]>> = {}): boolean {
  return keys.length === 0 || keys.some((key) => hasAnyFacet(text, aliases[key] ?? [key]));
}

function matchesStructuredRequest(
  variant: PublicChatCatalogVariant,
  request: ShoppingCatalogSearchRequest,
): boolean {
  if (request.productFamilies.length > 0 && !request.productFamilies.some((family) => matchesFamily(variant, family))) return false;
  if (request.subtypes.length > 0 && !request.subtypes.some((subtype) => matchesSubtype(variant, subtype))) return false;
  const categoryText = normalizedFacetText([variant.filter_category, variant.filter_sub_category, variant.filter_product_line]);
  if (!matchesKeyList(categoryText, request.categoryKeys, categoryAliases)) return false;
  if (!matchesKeyList(variantFacetText(variant), request.collectionKeys, { lc: ["lc", "lc collection"] })) return false;
  if (!matchesKeyList(variantRoomText(variant), request.roomKeys, roomAliases)) return false;
  const brandText = normalizedFacetText([variant.filter_brand, variant.brand_name]);
  if (!matchesKeyList(brandText, request.brandKeys)) return false;
  const designerText = normalizedFacetText([variant.designer_name]);
  if (!matchesKeyList(designerText, request.designerKeys, { le_corbusier: ["le corbusier", "lecorbusier"] })) return false;
  const fullText = variantFacetText(variant);
  if (!matchesKeyList(fullText, request.materialKeys, { leather: ["leather", "da"], wood: ["wood", "go", "oak"] })) return false;
  if (!matchesKeyList(fullText, request.colorKeys, { black: ["black", "mau den"] })) return false;
  if (request.availability === "available_only" && variant.public_stock_state !== "available") return false;
  if (request.minPrice !== undefined || request.maxPrice !== undefined) {
    if (variant.public_price_mode !== "fixed" || variant.public_price === null) return false;
    if (request.minPrice !== undefined && variant.public_price < request.minPrice) return false;
    if (request.maxPrice !== undefined && variant.public_price > request.maxPrice) return false;
  }
  return true;
}

function sortStructuredRecords(
  records: readonly CatalogAdapterRecord[],
  request: ShoppingCatalogSearchRequest,
): readonly CatalogAdapterRecord[] {
  if (request.sort === "relevance" || request.sort === "priority") return records;
  const sortableRecords = records.filter((record) => record.price.mode === "fixed");
  const direction = request.sort === "price_asc" ? 1 : -1;
  return [...sortableRecords].sort((left, right) => {
    const leftPrice = left.price.mode === "fixed" ? left.price.amount : 0;
    const rightPrice = right.price.mode === "fixed" ? right.price.amount : 0;
    if (leftPrice !== rightPrice) return (leftPrice - rightPrice) * direction;
    return left.variantId.localeCompare(right.variantId);
  });
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
    searchStructured: async (request, signal) => {
      throwIfAborted(signal);
      const searchVariants = dependencies.searchVariantsStructured ?? searchPublicChatCatalogVariantsV2;
      const variants = await retryCatalogRead(
        () => searchVariants(request, signal),
        signal,
      );
      const seenVariantIds = new Set<string>();
      const records = variants.flatMap((variant) => {
        if (seenVariantIds.has(variant.id) || !matchesStructuredRequest(variant, request)) return [];
        seenVariantIds.add(variant.id);
        const record = toCatalogRecord(variant, locale);
        return record === undefined || !record.eligible || !record.current ? [] : [record];
      });
      return sortStructuredRecords(records, request).slice(0, request.limit);
    },
    details: (canonicalIds, signal) =>
      loadExactCatalogRecords(canonicalIds, "canonicalId", locale, dependencies, signal),
    compare: (variantIds, _attributeKeys, signal) =>
      loadExactCatalogRecords(variantIds, "variantId", locale, dependencies, signal),
  };
}
