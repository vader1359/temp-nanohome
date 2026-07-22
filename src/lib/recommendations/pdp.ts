import { isRecommendationEligible } from "@/lib/catalog/eligibility";
import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import { createClient } from "@/lib/supabase/server";
import type { Variant } from "@/types/db";
import { getCatalogEligibility } from "./catalog";
import { recommendPdpProducts } from "./service";

type RecommendationVariant = Pick<Variant, "id">;

export type PdpRecommendationLoaderOptions = {
  readonly contextVariantId: string;
  readonly now?: () => string;
};

export type PdpRecommendationLoaderDependencies<TVariant extends RecommendationVariant> = {
  readonly loadCatalog: () => Promise<readonly CatalogEligibility[]>;
  readonly loadVariantsByIds: (ids: readonly string[]) => Promise<readonly TVariant[]>;
};

export async function loadPdpRecommendationsWithDependencies<TVariant extends RecommendationVariant>(
  options: PdpRecommendationLoaderOptions,
  dependencies: PdpRecommendationLoaderDependencies<TVariant>,
): Promise<readonly TVariant[]> {
  const { loadCatalog, loadVariantsByIds: loadVariants } = dependencies;
  const eligibilityRows = await loadCatalog();
  const context = eligibilityRows.find((row) => row.variant_id === options.contextVariantId);
  if (context === undefined || !isRecommendationEligible(context)) {
    return [];
  }

  const recommendation = recommendPdpProducts({
    context,
    candidates: eligibilityRows,
    limit: 4,
    generatedAt: (options.now ?? (() => new Date().toISOString()))(),
  });
  const recommendedIds = recommendation.items.map((item) => item.variantId);
  if (recommendedIds.length === 0) {
    return [];
  }

  const eligibleIds = new Set(
    eligibilityRows.filter(isRecommendationEligible).map((row) => row.variant_id),
  );
  const hydratedById = new Map(
    (await loadVariants(recommendedIds))
      .filter((variant) => eligibleIds.has(variant.id))
      .map((variant) => [variant.id, variant]),
  );

  return recommendedIds.flatMap((id) => {
    const variant = hydratedById.get(id);
    return variant === undefined ? [] : [variant];
  });
}

export async function loadPdpRecommendations(
  options: PdpRecommendationLoaderOptions,
): Promise<readonly Variant[]> {
  return loadPdpRecommendationsWithDependencies(options, {
    loadCatalog: getCatalogEligibility,
    loadVariantsByIds: async (ids) => {
      if (ids.length === 0) return [];
      const supabase = await createClient();
      const { data, error } = await supabase.from("variants").select("*").in("id", [...ids]).eq("validated", true);
      if (error !== null) throw error;
      return data ?? [];
    },
  });
}
