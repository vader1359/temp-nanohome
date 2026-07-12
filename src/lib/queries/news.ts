import { createClient } from "@/lib/supabase/server";
import type { News } from "@/types/db";

import { productRange } from "./products";
import { postgrestFilterValue, type ProductSearchLocale } from "./search";

export async function getNewsList(page = 1, pageSize = 12): Promise<readonly News[]> {
  const supabase = await createClient();
  const [from, to] = productRange(page, pageSize);
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("validated", true)
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

const localeSearchColumns = {
  vi: ["title_vi", "title", "title_ko", "description"],
  en: ["title", "title_vi", "title_ko", "description"],
  ko: ["title_ko", "title", "title_vi", "description"],
} satisfies Record<ProductSearchLocale, readonly string[]>;

export async function searchNews(
  query: string,
  locale: ProductSearchLocale,
  options: Readonly<{ pageSize?: number }> = {},
): Promise<readonly News[]> {
  const searchTerm = query.trim();
  if (searchTerm === "") {
    return [];
  }

  const supabase = await createClient();
  const pageSize = options.pageSize ?? 6;
  const filterValue = postgrestFilterValue(searchTerm);
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("validated", true)
    .or(localeSearchColumns[locale].map((column) => `${column}.ilike.*${filterValue}*`).join(","))
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .range(0, pageSize - 1);

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getNewsByAirtableId(airtableId: string): Promise<News | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("airtable_id", airtableId)
    .eq("validated", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}
