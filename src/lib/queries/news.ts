import { createClient } from "@/lib/supabase/server";
import type { News } from "@/types/db";

import { productRange } from "./products";

export async function getNewsList(page = 1, pageSize = 12): Promise<readonly News[]> {
  const supabase = await createClient();
  const [from, to] = productRange(page, pageSize);
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("validated", true)
    .eq("approved", true)
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .range(from, to);

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
    .eq("approved", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}
