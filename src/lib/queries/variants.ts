import { createClient } from "@/lib/supabase/server";
import type { Variant } from "@/types/db";

export async function getVariantById(id: string): Promise<Variant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("id", id)
    .eq("validated", true)
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
    .order("priority", { ascending: false, nullsFirst: false });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getVariantBySlug(slug: string): Promise<Variant | null> {
  const supabase = await createClient();
  const slugFilter = isUuid(slug) ? `id.eq.${slug},slug.eq.${slug},slug_vi.eq.${slug}` : `slug.eq.${slug},slug_vi.eq.${slug}`;
  // Variants intentionally share slug/slug_vi across size/material combos (see
  // 202606280003_add_slug_unique_indexes.sql), so .maybeSingle() would throw
  // PGRST116 on duplicate slugs. Order + limit(1) picks a canonical row.
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .or(slugFilter)
    .eq("validated", true)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}
