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
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getBrandByAirtableId(airtableId: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("airtable_id", airtableId)
    .eq("validated", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

async function getProductsByBrandId(
  brandId: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("brand_id", brandId)
    .eq("validated", true)
    .order(options.sort === "newest" ? "source_created_at" : "priority", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getProductsByBrandSlug(
  slug: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const brand = await getBrandBySlug(slug);
  return brand === null ? [] : getProductsByBrandId(brand.id, options);
}

export async function getProductsByBrandAirtableId(
  airtableId: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const brand = await getBrandByAirtableId(airtableId);
  return brand === null ? [] : getProductsByBrandId(brand.id, options);
}
