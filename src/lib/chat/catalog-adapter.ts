import "server-only";

import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import { firstProductImage } from "@/lib/image";
import {
  getVariantProducts,
  getVariantProductsBySkus,
  type VariantProductListItem,
} from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { getCatalogEligibility } from "@/lib/recommendations/catalog";

import type { PublicChatLocale } from "./contracts";
import type {
  PublicCatalogAdapters,
  PublicCatalogRecord,
} from "./tools/public-tools";

type CatalogAdapterRecord = PublicCatalogRecord & {
  readonly eligible: boolean;
  readonly current: boolean;
};

export type PublicCatalogAdapterDependencies = Readonly<{
  loadEligibility: () => Promise<readonly CatalogEligibility[]>;
  searchVariants: (
    query: string,
    limit: number,
  ) => Promise<readonly VariantProductListItem[]>;
  loadVariantsBySkus: (
    skus: readonly string[],
  ) => Promise<readonly VariantProductListItem[]>;
}>;

const defaultDependencies: PublicCatalogAdapterDependencies = {
  loadEligibility: getCatalogEligibility,
  searchVariants: (query, limit) =>
    getVariantProducts({
      page: 1,
      pageSize: Math.min(Math.max(limit * 4, limit), 48),
      search: query,
      sort: "priority",
    }),
  loadVariantsBySkus: getVariantProductsBySkus,
};

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Catalog request aborted");
  error.name = "AbortError";
  throw error;
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
  variant: VariantProductListItem,
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

function priceFor(
  row: CatalogEligibility,
): PublicCatalogRecord["price"] {
  if (
    row.price_mode === "fixed" &&
    row.price !== null &&
    Number.isFinite(row.price) &&
    row.price >= 0
  ) {
    return { mode: "fixed", amount: row.price, currency: "VND" };
  }
  if (row.price_mode === "contact") return { mode: "contact" };
  return { mode: "unavailable" };
}

function stockFor(
  row: CatalogEligibility,
): PublicCatalogRecord["stock"] {
  return row.has_fresh_stock && row.stock !== null && row.stock > 0
    ? { state: "available" }
    : { state: "unknown" };
}

function attributesFor(
  variant: VariantProductListItem,
  row: CatalogEligibility,
  locale: PublicChatLocale,
): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  const dimensions = safeText(variant.size);
  const finish = localizedVariantText(variant, locale, "finish");
  const brand = safeText(row.brand_name);
  const product = safeText(
    locale === "vi"
      ? row.localized_product_name
      : locale === "ko"
        ? variant.product_name_denorm ?? row.product_name
        : row.product_name,
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
  row: CatalogEligibility,
  variant: VariantProductListItem,
  locale: PublicChatLocale,
): CatalogAdapterRecord | undefined {
  if (row.variant_id !== variant.id) return undefined;
  const title =
    localizedVariantText(variant, locale, "name") ||
    localizedVariantText(variant, locale, "short_name");
  if (title.length === 0) return undefined;
  const imageUrl = firstProductImage([
    row.image_url,
    variant.packshot_url,
    ...variant.gallery_urls,
    variant.cldr_media_lifestyle_1,
    variant.cldr_media_lifestyle_2,
    variant.media_long,
    variant.media_closeup,
  ]);
  const hasCanonicalImage =
    row.has_supported_media &&
    imageUrl !== "/images/placeholder.webp";
  return {
    canonicalId: row.product_id ?? row.variant_id,
    variantId: row.variant_id,
    title,
    canonicalLink: `/${locale}${variantDetailHref(variant, locale)}`,
    image: { id: row.variant_id, alt: title, src: imageUrl },
    price: priceFor(row),
    stock: stockFor(row),
    attributes: attributesFor(variant, row, locale),
    eligible: row.recommendation && hasCanonicalImage,
    current: row.catalog_approved_validated,
  };
}

function preferredRow(
  rows: readonly CatalogEligibility[],
  canonicalId: string,
): CatalogEligibility | undefined {
  return rows
    .filter((row) => (row.product_id ?? row.variant_id) === canonicalId && row.sku !== null)
    .sort(
      (left, right) =>
        Number(right.recommendation) - Number(left.recommendation) ||
        Number(right.has_fresh_stock) - Number(left.has_fresh_stock) ||
        left.variant_id.localeCompare(right.variant_id),
    )[0];
}

export function createPublicCatalogAdapters(
  locale: PublicChatLocale,
  dependencies: PublicCatalogAdapterDependencies = defaultDependencies,
): PublicCatalogAdapters {
  let eligibilityPromise: Promise<readonly CatalogEligibility[]> | undefined;
  const loadEligibility = (): Promise<readonly CatalogEligibility[]> => {
    eligibilityPromise ??= dependencies.loadEligibility();
    return eligibilityPromise;
  };

  return {
    search: async (query, limit, signal) => {
      throwIfAborted(signal);
      const [rows, variants] = await Promise.all([
        loadEligibility(),
        dependencies.searchVariants(query, limit),
      ]);
      throwIfAborted(signal);
      const eligibilityByVariant = new Map(rows.map((row) => [row.variant_id, row]));
      return variants.flatMap((variant) => {
        const row = eligibilityByVariant.get(variant.id);
        const record = row === undefined ? undefined : toCatalogRecord(row, variant, locale);
        return record === undefined ? [] : [record];
      });
    },
    details: async (canonicalIds, signal) => {
      throwIfAborted(signal);
      const rows = await loadEligibility();
      const requestedRows = canonicalIds.map((canonicalId) => preferredRow(rows, canonicalId));
      const skus = requestedRows.flatMap((row) => row?.sku === null || row?.sku === undefined ? [] : [row.sku]);
      const variants = skus.length === 0
        ? []
        : await dependencies.loadVariantsBySkus([...new Set(skus)]);
      throwIfAborted(signal);
      const variantsBySku = new Map(
        variants.flatMap((variant) => variant.sku === null ? [] : [[variant.sku, variant] as const]),
      );
      return requestedRows.flatMap((row) => {
        if (row?.sku === null || row?.sku === undefined) return [];
        const variant = variantsBySku.get(row.sku);
        const record = variant === undefined ? undefined : toCatalogRecord(row, variant, locale);
        return record === undefined ? [] : [record];
      });
    },
    compare: async (variantIds, _attributeKeys, signal) => {
      throwIfAborted(signal);
      const rows = await loadEligibility();
      const eligibilityByVariant = new Map(rows.map((row) => [row.variant_id, row]));
      const requestedRows = variantIds.map((variantId) => eligibilityByVariant.get(variantId));
      const skus = requestedRows.flatMap((row) => row?.sku === null || row?.sku === undefined ? [] : [row.sku]);
      const variants = skus.length === 0
        ? []
        : await dependencies.loadVariantsBySkus([...new Set(skus)]);
      throwIfAborted(signal);
      const variantsBySku = new Map(
        variants.flatMap((variant) => variant.sku === null ? [] : [[variant.sku, variant] as const]),
      );
      return requestedRows.flatMap((row) => {
        if (row?.sku === null || row?.sku === undefined) return [];
        const variant = variantsBySku.get(row.sku);
        const record = variant === undefined ? undefined : toCatalogRecord(row, variant, locale);
        return record === undefined ? [] : [record];
      });
    },
  };
}
