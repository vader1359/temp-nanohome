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
  | "raw"
  | "product_id"
  | "brand_id"
  | "brand_cldr_logo"
  | "brand_name_denorm"
  | "category_id"
  | "media_lifestyle_1"
  | "media_lifestyle_2"
  | "cldr_media_lifestyle_1"
  | "cldr_media_lifestyle_2"
  | "media_long"
  | "media_closeup"
  | "filter_sub_category"
>;

const VARIANT_PRODUCT_LIST_COLUMNS =
  "id,name,name_vi,slug,slug_vi,price,compare_at_price,discount_percent,on_sale,in_stock,packshot_url,gallery_urls,finish,finish_vi,size,raw,product_id,brand_id,brand_cldr_logo,brand_name_denorm,category_id,media_lifestyle_1,media_lifestyle_2,cldr_media_lifestyle_1,cldr_media_lifestyle_2,media_long,media_closeup,filter_sub_category";

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

export type VariantProductQueryOptions = Pick<ProductListOptions, "page" | "pageSize" | "search" | "sort"> & {
  readonly category?: string | null;
  readonly excludeId?: string;
};

export async function getVariantProducts(options: VariantProductQueryOptions = {}): Promise<readonly VariantProductListItem[]> {
  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  let query = supabase
    .from("variants")
    .select(VARIANT_PRODUCT_LIST_COLUMNS)
    .eq("validated", true)
    .eq("approved", true);

  if (options.category !== undefined && options.category !== null) {
    query = query.eq("category_id", options.category);
  }

  if (options.excludeId !== undefined) {
    query = query.neq("id", options.excludeId);
  }

  if (options.search !== undefined && options.search.trim() !== "") {
    query = query.ilike("name", `%${options.search.trim()}%`);
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
