import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/db";

import { productRange, type ProductListOptions } from "./products";

export type ProductSearchLocale = "en" | "vi";

const searchSelect = "*, variants(name,sku,finish,finish_vi,validated,approved)";

const localeProductSearchColumns = {
  vi: ["name_vi", "description_vi", "name", "description"],
  en: ["name", "description", "name_vi", "description_vi"],
} satisfies Record<ProductSearchLocale, readonly string[]>;

const localeVariantSearchColumns = {
  vi: ["finish_vi", "name", "sku", "finish"],
  en: ["name", "sku", "finish", "finish_vi"],
} satisfies Record<ProductSearchLocale, readonly string[]>;

const localeOrderColumns = {
  vi: "name_vi",
  en: "name",
} satisfies Record<ProductSearchLocale, "name" | "name_vi">;

const postgrestReservedValueCharacters = /[",.:*()\\]/u;

function postgrestFilterValue(searchTerm: string): string {
  if (!postgrestReservedValueCharacters.test(searchTerm)) {
    return searchTerm;
  }

  return `"${searchTerm.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function pgroongaOrFilter(columns: readonly string[], searchTerm: string): string {
  const filterValue = postgrestFilterValue(searchTerm);
  return columns.map((column) => `${column}.&@~.${filterValue}`).join(",");
}

function productOrFilter(searchTerm: string, locale: ProductSearchLocale, variantProductIds: readonly string[]): string {
  const productFilter = pgroongaOrFilter(localeProductSearchColumns[locale], searchTerm);
  if (variantProductIds.length === 0) {
    return productFilter;
  }

  return `${productFilter},id.in.(${variantProductIds.join(",")})`;
}

export async function searchProducts(
  query: string,
  locale: ProductSearchLocale,
  options: Pick<ProductListOptions, "page" | "pageSize"> = {},
): Promise<readonly Product[]> {
  const searchTerm = query.trim();
  if (searchTerm === "") {
    return [];
  }

  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  const { data: variantMatches, error: variantError } = await supabase
    .from("variants")
    .select("product_id")
    .eq("validated", true)
    .eq("approved", true)
    .or(pgroongaOrFilter(localeVariantSearchColumns[locale], searchTerm))
    .not("product_id", "is", null);

  if (variantError !== null) {
    throw variantError;
  }

  const variantProductIds = Array.from(
    new Set((variantMatches ?? []).flatMap((variant) => (variant.product_id === null ? [] : [variant.product_id])))
  );

  const { data, error } = await supabase
    .from("products")
    .select(searchSelect)
    .eq("validated", true)
    .eq("approved", true)
    .eq("variants.validated", true)
    .eq("variants.approved", true)
    .or(productOrFilter(searchTerm, locale, variantProductIds))
    .order(localeOrderColumns[locale], { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
