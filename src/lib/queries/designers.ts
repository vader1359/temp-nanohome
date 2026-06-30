import { createClient } from "@/lib/supabase/server";
import type { Designer, Product } from "@/types/db";

import { productRange, type ProductListOptions } from "./products";

export async function getDesigners(): Promise<readonly Designer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("validated", true)
    .order("priority", { ascending: false, nullsFirst: false });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getDesignerBySlug(slug: string): Promise<Designer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("slug", slug)
    .eq("validated", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getDesignerByAirtableId(airtableId: string): Promise<Designer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("airtable_id", airtableId)
    .eq("validated", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

async function getProductsByDesignerId(
  designerId: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("designer_id", designerId)
    .eq("validated", true)
    .order(options.sort === "newest" ? "source_created_at" : "priority", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getProductsByDesignerSlug(
  slug: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const designer = await getDesignerBySlug(slug);
  return designer === null ? [] : getProductsByDesignerId(designer.id, options);
}

export async function getProductsByDesignerAirtableId(
  airtableId: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const designer = await getDesignerByAirtableId(airtableId);
  return designer === null ? [] : getProductsByDesignerId(designer.id, options);
}
