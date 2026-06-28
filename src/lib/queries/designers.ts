import { createClient } from "@/lib/supabase/server";
import type { Designer, Product } from "@/types/db";

import { productRange, type ProductListOptions } from "./products";

export async function getDesigners(): Promise<readonly Designer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("validated", true)
    .eq("approved", true)
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
    .eq("approved", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getProductsByDesignerSlug(
  slug: string,
  options: Pick<ProductListOptions, "page" | "pageSize" | "sort"> = {},
): Promise<readonly Product[]> {
  const designer = await getDesignerBySlug(slug);
  if (designer === null) {
    return [];
  }

  const supabase = await createClient();
  const [from, to] = productRange(options.page, options.pageSize);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("designer_id", designer.id)
    .eq("validated", true)
    .eq("approved", true)
    .order(options.sort === "newest" ? "source_created_at" : "priority", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
