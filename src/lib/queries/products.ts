import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Product, Variant } from "@/types/db";

export type ProductSort = "priority" | "price_asc" | "price_desc" | "newest";

export type ProductListOptions = {
  readonly category?: string;
  readonly brand?: string;
  readonly designer?: string;
  readonly onSale?: boolean;
  readonly search?: string;
  readonly sort?: ProductSort;
  readonly page?: number;
  readonly pageSize?: number;
};

export type VariantProductListItem = Pick<
  Variant,
  | "id"
  | "name"
  | "name_vi"
  | "slug"
  | "slug_vi"
  | "price"
  | "compare_at_price"
  | "discount_percent"
  | "on_sale"
  | "in_stock"
  | "packshot_url"
  | "gallery_urls"
  | "finish"
  | "finish_vi"
  | "size"
  | "product_id"
  | "brand_id"
  | "brand_cldr_logo"
  | "brand_name_denorm"
  | "category_id"
  | "filter_brand"
  | "filter_category"
  | "filter_room"
  | "filter_room_vi"
  | "media_lifestyle_1"
  | "media_lifestyle_2"
  | "cldr_media_lifestyle_1"
  | "cldr_media_lifestyle_2"
  | "media_long"
  | "media_closeup"
  | "filter_sub_category"
>;

export type VariantProductFacetItem = Pick<Variant, "filter_brand" | "filter_category" | "filter_room_vi" | "filter_sub_category">;

const VARIANT_PRODUCT_LIST_COLUMNS =
  "id,name,name_vi,slug,slug_vi,price,compare_at_price,discount_percent,on_sale,in_stock,packshot_url,gallery_urls,finish,finish_vi,size,product_id,brand_id,brand_cldr_logo,brand_name_denorm,category_id,filter_brand,filter_category,filter_room,filter_room_vi,media_lifestyle_1,media_lifestyle_2,cldr_media_lifestyle_1,cldr_media_lifestyle_2,media_long,media_closeup,filter_sub_category";

export function productRange(page = 1, pageSize = 24): readonly [number, number] {
  if (!Number.isInteger(page) || !Number.isInteger(pageSize) || page < 1 || pageSize < 1) {
    throw new RangeError("page and pageSize must be positive integers");
  }

  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export async function getProducts(options: ProductListOptions = {}): Promise<readonly Product[]> {
  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  let query = supabase
    .from("products")
    .select("*, variants(price,on_sale)")
    .eq("validated", true)
    .eq("approved", true);

  if (options.category !== undefined) {
    query = query.eq("category_id", options.category);
  }

  if (options.brand !== undefined) {
    query = query.eq("brand_id", options.brand);
  }

  if (options.designer !== undefined) {
    query = query.eq("designer_id", options.designer);
  }

  if (options.onSale !== undefined) {
    query = query.eq("variants.on_sale", options.onSale);
  }

  if (options.search !== undefined && options.search.trim() !== "") {
    query = query.ilike("name", `%${options.search.trim()}%`);
  }

  switch (options.sort ?? "priority") {
    case "price_asc":
      query = query.order("price", { foreignTable: "variants", ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { foreignTable: "variants", ascending: false, nullsFirst: false });
      break;
    case "newest":
      query = query.order("source_created_at", { ascending: false, nullsFirst: false });
      break;
    case "priority":
      query = query.order("priority", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query.range(from, to);
  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export type VariantProductStatus = "in_stock" | "sale" | "out_of_stock";

export type VariantProductQueryOptions = Pick<ProductListOptions, "page" | "pageSize" | "search" | "sort"> & {
  readonly brand?: readonly string[];
  readonly category?: readonly string[];
  readonly categoryId?: string | null;
  readonly excludeId?: string;
  readonly room?: readonly string[];
  readonly status?: VariantProductStatus | null;
  readonly subCategory?: readonly string[];
};

function hasValues(values: readonly string[] | undefined): values is readonly [string, ...string[]] {
  return values !== undefined && values.length > 0;
}

const POSTGREST_RESERVED_VALUE_CHARACTERS = /[",.:*()\\]/u;
const VARIANT_SEARCH_COLUMNS = ["name_vi", "name", "sku", "finish_vi", "finish", "brand_name_denorm"] as const;

function postgrestFilterValue(searchTerm: string): string {
  if (!POSTGREST_RESERVED_VALUE_CHARACTERS.test(searchTerm)) {
    return searchTerm;
  }

  return `"${searchTerm.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function pgroongaVariantSearchFilter(searchTerm: string): string {
  const filterValue = postgrestFilterValue(searchTerm);
  return VARIANT_SEARCH_COLUMNS.map((column) => `${column}.&@~.${filterValue}`).join(",");
}

export async function getVariantProducts(options: VariantProductQueryOptions = {}): Promise<readonly VariantProductListItem[]> {
  const supabase = createAdminClient();
  const [from, to] = productRange(options.page, options.pageSize);
  let query = supabase
    .from("variants")
    .select(VARIANT_PRODUCT_LIST_COLUMNS)
    .eq("validated", true)
    .eq("approved", true);

  if (hasValues(options.category)) {
    query = query.in("filter_category", options.category);
  }

  if (options.categoryId !== undefined && options.categoryId !== null) {
    query = query.eq("category_id", options.categoryId);
  }

  if (hasValues(options.subCategory)) {
    query = query.in("filter_sub_category", options.subCategory);
  }

  if (hasValues(options.brand)) {
    query = query.in("filter_brand", options.brand);
  }

  if (hasValues(options.room)) {
    query = query.overlaps("filter_room", options.room);
  }

  if (options.excludeId !== undefined) {
    query = query.neq("id", options.excludeId);
  }

  if (options.search !== undefined && options.search.trim() !== "") {
    query = query.or(pgroongaVariantSearchFilter(options.search.trim()));
  }

  switch (options.status) {
    case "in_stock":
      query = query.eq("in_stock", true);
      break;
    case "sale":
      query = query.eq("on_sale", true);
      break;
    case "out_of_stock":
      query = query.eq("in_stock", false);
      break;
    case null:
    case undefined:
      break;
  }

  switch (options.sort ?? "priority") {
    case "price_asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      query = query.order("source_created_at", { ascending: false, nullsFirst: false });
      break;
    case "priority":
      query = query.order("priority", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query.range(from, to);
  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getVariantProductCount(options: Omit<VariantProductQueryOptions, "page" | "pageSize" | "sort"> = {}): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("variants")
    .select("id", { count: "exact", head: true })
    .eq("validated", true)
    .eq("approved", true);

  if (hasValues(options.category)) {
    query = query.in("filter_category", options.category);
  }

  if (options.categoryId !== undefined && options.categoryId !== null) {
    query = query.eq("category_id", options.categoryId);
  }

  if (hasValues(options.subCategory)) {
    query = query.in("filter_sub_category", options.subCategory);
  }

  if (hasValues(options.brand)) {
    query = query.in("filter_brand", options.brand);
  }

  if (hasValues(options.room)) {
    query = query.overlaps("filter_room", options.room);
  }

  if (options.excludeId !== undefined) {
    query = query.neq("id", options.excludeId);
  }

  if (options.search !== undefined && options.search.trim() !== "") {
    query = query.or(pgroongaVariantSearchFilter(options.search.trim()));
  }

  switch (options.status) {
    case "in_stock":
      query = query.eq("in_stock", true);
      break;
    case "sale":
      query = query.eq("on_sale", true);
      break;
    case "out_of_stock":
      query = query.eq("in_stock", false);
      break;
    case null:
    case undefined:
      break;
  }

  const { count, error } = await query;
  if (error !== null) {
    throw error;
  }

  return count ?? 0;
}

const FACET_TTL_MS = 60_000;
let facetCache: { readonly at: number; readonly data: readonly VariantProductFacetItem[] } | null = null;

export async function getVariantProductFacets(): Promise<readonly VariantProductFacetItem[]> {
  if (facetCache !== null && Date.now() - facetCache.at < FACET_TTL_MS) {
    return facetCache.data;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("variants")
    .select("filter_brand,filter_category,filter_room_vi,filter_sub_category")
    .eq("validated", true)
    .eq("approved", true)
    .limit(500);

  if (error !== null) {
    throw error;
  }

  const rows = data ?? [];
  facetCache = { at: Date.now(), data: rows };
  return rows;
}
