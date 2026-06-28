import { createClient } from "@/lib/supabase/server";
import type { Variant } from "@/types/db";

export async function getVariantById(id: string): Promise<Variant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("id", id)
    .eq("validated", true)
    .eq("approved", true)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getVariantsByProductId(productId: string): Promise<readonly Variant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("product_id", productId)
    .eq("validated", true)
    .eq("approved", true)
    .order("priority", { ascending: false, nullsFirst: false });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
