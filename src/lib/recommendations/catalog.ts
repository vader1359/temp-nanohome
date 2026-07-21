import { parseCatalogEligibilityRow } from "@/lib/catalog/eligibility";
import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";

export async function getCatalogEligibility(): Promise<readonly CatalogEligibility[]> {
  const response = await supabaseReadOnlyFetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/catalog_eligibility?select=*`,
    {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Catalog eligibility request failed: ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Catalog eligibility response was not an array");
  }
  return data.map((row) => parseCatalogEligibilityRow(row));
}
