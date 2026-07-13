import { createClient } from "@/lib/supabase/server";
import type { Designer, Product } from "@/types/db";

import { productRange, type ProductListOptions } from "./products";
import { postgrestFilterValue } from "./search-input";

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

export async function searchDesigners(
  query: string,
  options: Readonly<{ pageSize?: number }> = {},
): Promise<readonly Designer[]> {
  const searchTerm = query.trim();
  if (searchTerm === "") {
    return [];
  }

  const supabase = await createClient();
  const pageSize = options.pageSize ?? 6;
  const filterValue = postgrestFilterValue(searchTerm);
  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("validated", true)
    .or(`name.ilike.*${filterValue}*,description.ilike.*${filterValue}*`)
    .order("priority", { ascending: false, nullsFirst: false })
    .range(0, pageSize - 1);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export type ProductDesignerRelations = Readonly<{
  productIds: readonly string[];
  variantDesignerIds: readonly string[];
}>;

export async function getDesignersForProducts({ productIds, variantDesignerIds }: ProductDesignerRelations): Promise<readonly Designer[]> {
  const uniqueProductIds = [...new Set(productIds)];
  const uniqueVariantDesignerIds = [...new Set(variantDesignerIds)];
  if (uniqueProductIds.length === 0 && uniqueVariantDesignerIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const products = uniqueProductIds.length === 0
    ? []
    : await supabase
      .from("products")
      .select("id,designer_id")
      .eq("validated", true)
      .in("id", uniqueProductIds)
      .then(({ data, error }) => {
        if (error !== null) {
          throw error;
        }
        return data ?? [];
      });
  const validatedProductIds = products.map((product) => product.id);
  const productDesigners = validatedProductIds.length === 0
    ? []
    : await supabase
      .from("product_designers")
      .select("designer_id")
      .in("product_id", validatedProductIds)
      .then(({ data, error }) => {
        if (error !== null) {
          throw error;
        }
        return data ?? [];
      });
  const designerIds = [...new Set([
    ...uniqueVariantDesignerIds,
    ...products.flatMap((product) => product.designer_id === null ? [] : [product.designer_id]),
    ...productDesigners.map((productDesigner) => productDesigner.designer_id),
  ])];
  if (designerIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("designers")
    .select("*")
    .eq("validated", true)
    .in("id", designerIds)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(0, 5);

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
