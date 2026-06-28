import { createClient } from "@/lib/supabase/server";
import type { Brand, Category, Designer, News, Product, Variant } from "@/types/db";

export type ProductDetail = Product & {
  readonly variants: readonly Variant[];
  readonly brand: Brand | null;
  readonly designer: Designer | null;
  readonly category: Category | null;
  readonly related: readonly Product[];
  readonly news: readonly News[];
};

type ProductRow = Product & {
  readonly variants: readonly Variant[] | null;
  readonly brands: Brand | null;
  readonly designers: Designer | null;
  readonly categories: Category | null;
};

export async function getProductByAirtableId(airtableId: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, variants(*), brands(*), designers(*), categories(*)")
    .eq("airtable_id", airtableId)
    .eq("validated", true)
    .eq("approved", true)
    .maybeSingle<ProductRow>();

  if (error !== null) {
    throw error;
  }

  if (product === null) {
    return null;
  }

  const related = await getRelatedProducts(product);
  const news = await getLinkedNews(product.id);

  return {
    ...product,
    variants: product.variants ?? [],
    brand: product.brands,
    designer: product.designers,
    category: product.categories,
    related,
    news,
  };
}

async function getRelatedProducts(product: Product): Promise<readonly Product[]> {
  if (product.category_id === null) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category_id", product.category_id)
    .eq("validated", true)
    .eq("approved", true)
    .neq("id", product.id)
    .order("priority", { ascending: false, nullsFirst: false })
    .limit(4);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

async function getLinkedNews(productId: string): Promise<readonly News[]> {
  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase.from("news_products").select("news_id").eq("product_id", productId);

  if (linksError !== null) {
    throw linksError;
  }

  const newsIds = (links ?? []).map((row) => row.news_id);
  if (newsIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("news")
    .select("*")
    .in("id", newsIds)
    .eq("validated", true)
    .eq("approved", true)
    .order("source_created_at", { ascending: false, nullsFirst: false });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
