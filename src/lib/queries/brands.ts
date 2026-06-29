import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Brand, Product } from "@/types/db";

import { productRange, type ProductListOptions } from "./products";

export async function getBrands(): Promise<readonly Brand[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("validated", true)
    .eq("approved", true)
    .order("name", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getProductFilterBrands(): Promise<readonly Brand[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .not("slug", "is", null)
    .order("name", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .eq("validated", true)
    .eq("approved", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getProductsByBrandSlug(
  slug: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const brand = await getBrandBySlug(slug);
  if (brand === null) {
    return [];
  }

  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("validated", true)
    .eq("approved", true)
    .order(options.sort === "newest" ? "source_created_at" : "priority", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
