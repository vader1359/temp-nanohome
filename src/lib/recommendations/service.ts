import { isRecommendationEligible } from "@/lib/catalog/eligibility";
import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import { recommendationResponseSchema } from "@/lib/contracts";
import type { RecommendationPort, RecommendationRequest, RecommendationResponse } from "@/lib/contracts";

const ALGORITHM_VERSION = "pdp-deterministic-v1";

export type RecommendationCandidate = CatalogEligibility;

export type PdpRecommendationInput = {
  readonly context: CatalogEligibility;
  readonly candidates: readonly RecommendationCandidate[];
  readonly limit: number;
  readonly generatedAt: string;
};

type RecommendationReasonCode = "eligible_catalog" | "similar_price_band";

type ScoredCandidate = {
  readonly candidate: RecommendationCandidate;
  readonly score: number;
  readonly reasonCode: RecommendationReasonCode;
};

export type CatalogEligibilityLoader = () => Promise<readonly CatalogEligibility[]>;
export type Clock = () => string;

function isSamePriceBand(left: number | null, right: number | null): boolean {
  if (left === null || right === null || left <= 0 || right <= 0) return false;
  return Math.abs(left - right) / Math.max(left, right) <= 0.25;
}

function scoreCandidate(context: CatalogEligibility, candidate: RecommendationCandidate): ScoredCandidate {
  const samePriceBand = isSamePriceBand(context.price, candidate.price);
  return {
    candidate,
    score: samePriceBand ? 10 : 0,
    reasonCode: "similar_price_band",
  };
}

function uniqueCandidates(candidates: readonly ScoredCandidate[]): readonly ScoredCandidate[] {
  const productIds = new Set<string>();
  const variantsWithoutProduct = new Set<string>();
  return candidates.filter(({ candidate }) => {
    if (candidate.product_id === null) {
      if (variantsWithoutProduct.has(candidate.variant_id)) return false;
      variantsWithoutProduct.add(candidate.variant_id);
      return true;
    }
    if (productIds.has(candidate.product_id)) return false;
    productIds.add(candidate.product_id);
    return true;
  });
}

export function recommendPdpProducts(input: PdpRecommendationInput): RecommendationResponse {
  const eligible = input.candidates
    .filter((candidate) => candidate.variant_id !== input.context.variant_id)
    .filter((candidate) => candidate.product_id !== input.context.product_id)
    .filter(isRecommendationEligible)
    .map((candidate) => scoreCandidate(input.context, candidate))
    .filter(({ score }) => score > 0);
  const ranked = uniqueCandidates(
    [...eligible].sort((left, right) => right.score - left.score || left.candidate.variant_id.localeCompare(right.candidate.variant_id)),
  );
  const items = ranked.slice(0, input.limit).map(({ candidate, reasonCode }) => ({ variantId: candidate.variant_id, reasonCode }));
  const fallbackTier = items.length > 0 ? "tier_1_structured_catalog" : "tier_2_empty";

  return recommendationResponseSchema.parse({
    requestId: `pdp:${input.context.variant_id}:${input.generatedAt}`,
    algorithmVersion: ALGORITHM_VERSION,
    placement: "pdp",
    generatedAt: input.generatedAt,
    fallbackTier,
    items,
  });
}

function emptyResponse(request: RecommendationRequest, generatedAt: string): RecommendationResponse {
  return response(request, generatedAt, []);
}

function response(
  request: RecommendationRequest,
  generatedAt: string,
  items: readonly { readonly variantId: string; readonly reasonCode: string }[],
): RecommendationResponse {
  return recommendationResponseSchema.parse({
    requestId: `${request.placement}:${request.contextVariantIds.join(",") || "catalog"}:${generatedAt}`,
    algorithmVersion: ALGORITHM_VERSION,
    placement: request.placement,
    generatedAt,
    fallbackTier: items.length > 0 ? "tier_1_structured_catalog" : "tier_2_empty",
    items,
  });
}

function recommendCatalog(request: RecommendationRequest, catalog: readonly CatalogEligibility[], generatedAt: string): RecommendationResponse {
  const contextVariantIds: readonly string[] = request.contextVariantIds;
  const contexts = contextVariantIds
    .map((variantId) => catalog.find((candidate) => candidate.variant_id === variantId))
    .filter((candidate): candidate is CatalogEligibility => candidate !== undefined && isRecommendationEligible(candidate));
  if (request.placement !== "home" && contexts.length === 0) return emptyResponse(request, generatedAt);

  const contextProductIds = new Set<string>(contexts.flatMap<string>((context) => (
    context.product_id === null ? [] : [context.product_id]
  )));
  const eligible = catalog
    .filter(isRecommendationEligible)
    .filter((candidate) => !contextVariantIds.includes(candidate.variant_id))
    .filter((candidate) => candidate.product_id === null || !contextProductIds.has(candidate.product_id));
  const items = uniqueCandidates(
    eligible
      .map((candidate): ScoredCandidate => ({
        candidate,
        score: contexts.some((context) => isSamePriceBand(context.price, candidate.price)) ? 10 : request.placement === "home" ? 1 : 0,
        reasonCode: contexts.length > 0 ? "similar_price_band" : "eligible_catalog",
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.candidate.variant_id.localeCompare(right.candidate.variant_id)),
  ).slice(0, 4).map(({ candidate, reasonCode }) => ({ variantId: candidate.variant_id, reasonCode }));
  return response(request, generatedAt, items);
}

export class PdpRecommendationService implements RecommendationPort {
  public constructor(
    private readonly loadCatalog: CatalogEligibilityLoader,
    private readonly now: Clock = () => new Date().toISOString(),
  ) {}

  public async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    const generatedAt = this.now();
    const catalog = await this.loadCatalog();
    switch (request.placement) {
      case "pdp": {
        const context = catalog.find((row) => row.variant_id === request.contextVariantIds[0]);
        if (context === undefined || !isRecommendationEligible(context)) return emptyResponse(request, generatedAt);
        return recommendPdpProducts({ context, candidates: catalog, limit: 4, generatedAt });
      }
      case "chat":
      case "cart":
      case "home":
        return recommendCatalog(request, catalog, generatedAt);
      case "room":
        return emptyResponse(request, generatedAt);
    }
  }
}
