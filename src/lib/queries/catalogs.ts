import { createClient } from "@/lib/supabase/server";
import type { Catalog } from "@/types/db";

export async function getCatalogs(): Promise<readonly Catalog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalogs").select("*").order("brand_name", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function getCatalogsByBrandId(brandId: string): Promise<readonly Catalog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogs")
    .select("*")
    .eq("brand_id", brandId)
    .order("brand_name", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
