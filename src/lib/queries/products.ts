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

export async function getVariantProducts(options: Pick<ProductListOptions, "page" | "pageSize" | "search" | "sort"> = {}): Promise<readonly Variant[]> {
  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  let query = supabase
    .from("variants")
    .select("*")
    .eq("validated", true)
    .eq("approved", true);

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
