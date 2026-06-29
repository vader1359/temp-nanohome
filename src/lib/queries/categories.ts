import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/db";

export async function getCategories(): Promise<readonly Category[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("validated", true)
    .eq("approved", true)
    .order("name", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
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
