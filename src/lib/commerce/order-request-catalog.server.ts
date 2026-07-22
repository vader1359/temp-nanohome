import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import { resolveOrderRequestCatalog } from "./order-request-catalog";

export async function resolveOrderRequestCatalogFromSupabase(input: unknown) {
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: supabaseReadOnlyFetch },
    },
  );

  return resolveOrderRequestCatalog(async (variantIds) => {
    const { data, error } = await client
      .from("catalog_eligibility")
      .select("*")
      .in("variant_id", [...variantIds]);

    if (error !== null) throw error;
    return data ?? [];
  }, input);
}
