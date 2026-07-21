import { describe, expect, it } from "vitest";
import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import { loadPdpRecommendationsWithDependencies } from "./pdp";
import { recommendPdpProducts, PdpRecommendationService } from "./service";

const row = (overrides: Partial<CatalogEligibility> = {}): CatalogEligibility => ({
  variant_id: "variant-1",
  product_id: "product-1",
  brand_id: "brand-1",
  sku: "sku-1",
  variant_slug: "variant-1",
  variant_name: "Variant 1",
  localized_name: "Variant 1",
  product_slug: "product-1",
  product_name: "Product 1",
  localized_product_name: "Product 1",
  brand_slug: "brand-1",
  brand_name: "Brand 1",
  image_url: "https://example.com/1.jpg",
  price: 100,
  stock: 1,
  price_mode: "fixed",
  has_fresh_stock: true,
  has_supported_media: true,
  catalog_approved_validated: true,
  hidden_brand_sku: false,
  reason_codes: [],
  storefront: true,
  recommendation: true,
  visual_match: true,
  cart: true,
  payment: true,
  ...overrides,
});

describe("PDP recommendation service", () => {
  it("Given eligible and ineligible candidates, When recommendations are generated, Then only eligible canonical variants are returned", () => {
    const result = recommendPdpProducts({
      context: row({ variant_id: "current" }),
      candidates: [
        row({ variant_id: "eligible", product_id: "product-eligible" }),
        row({ variant_id: "blocked", recommendation: false }),
      ],
      limit: 4,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(result.items).toEqual([{ variantId: "eligible", reasonCode: "similar_price_band" }]);
    expect(result.fallbackTier).toBe("tier_1_structured_catalog");
  });

  it("Given matching candidates, When recommendations are generated twice, Then ordering and reason metadata remain deterministic", () => {
    const input = {
      context: row({ variant_id: "current", price: 100 }),
      candidates: [
        row({ variant_id: "zeta", product_id: "product-z", price: 110 }),
        row({ variant_id: "alpha", product_id: "product-a", price: 90 }),
      ],
      limit: 2,
      generatedAt: "2026-07-22T00:00:00.000Z",
    } as const;

    expect(recommendPdpProducts(input)).toEqual(recommendPdpProducts(input));
    expect(recommendPdpProducts(input).items[0]?.variantId).toBe("alpha");
  });

  it("Given duplicate variants from one product family, When recommendations are generated, Then only one family member is returned", () => {
    const result = recommendPdpProducts({
      context: row({ variant_id: "current", product_id: "current-product" }),
      candidates: [
        row({ variant_id: "family-a", product_id: "family" }),
        row({ variant_id: "family-b", product_id: "family" }),
        row({ variant_id: "other", product_id: "other" }),
      ],
      limit: 4,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(result.items.map((item) => item.variantId)).toEqual(["family-a", "other"]);
  });

  it("Given variants from the current product family, When recommendations are generated, Then the family is excluded", () => {
    const result = recommendPdpProducts({
      context: row({ variant_id: "current", product_id: "current-product" }),
      candidates: [
        row({ variant_id: "current-size", product_id: "current-product" }),
        row({ variant_id: "other", product_id: "other" }),
      ],
      limit: 4,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(result.items.map((item) => item.variantId)).toEqual(["other"]);
  });

  it("Given a candidate outside the price band, When recommendations are generated, Then it is not labeled as similar price", () => {
    const result = recommendPdpProducts({
      context: row({ variant_id: "current", price: 100 }),
      candidates: [row({ variant_id: "different", product_id: "different", price: 500 })],
      limit: 4,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(result.items).toEqual([]);
  });

  it("Given a recommendation request and catalog loader, When the port is called, Then it returns a PDP response", async () => {
    const service = new PdpRecommendationService(async () => [
      row({ variant_id: "current" }),
      row({ variant_id: "candidate", product_id: "candidate", price: 110 }),
    ], () => "2026-07-22T00:00:00.000Z");

    const result = await service.recommend({ placement: "pdp", contextVariantIds: ["current"], locale: "en" });

    expect(result.items).toEqual([{ variantId: "candidate", reasonCode: "similar_price_band" }]);
  });

  it("Given an ineligible PDP context, When the port is called, Then it returns no recommendations", async () => {
    const service = new PdpRecommendationService(async () => [
      row({ variant_id: "current", recommendation: false }),
      row({ variant_id: "candidate", product_id: "candidate" }),
    ], () => "2026-07-22T00:00:00.000Z");

    const result = await service.recommend({ placement: "pdp", contextVariantIds: ["current"], locale: "en" });

    expect(result).toMatchObject({ fallbackTier: "tier_2_empty", items: [] });
  });

  it("Given no eligible candidates, When recommendations are generated, Then the response declares the empty fallback tier", () => {
    const result = recommendPdpProducts({
      context: row({ variant_id: "current" }),
      candidates: [row({ variant_id: "blocked", recommendation: false })],
      limit: 4,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(result.items).toEqual([]);
    expect(result.fallbackTier).toBe("tier_2_empty");
  });

  it("Given unordered hydrated records, When PDP recommendations load, Then eligible records keep ranked order", async () => {
    const result = await loadPdpRecommendationsWithDependencies({
      contextVariantId: "current",
      now: () => "2026-07-22T00:00:00.000Z",
    }, {
      loadCatalog: async () => [
         row({ variant_id: "current" }),
         row({ variant_id: "first", product_id: "first" }),
         row({ variant_id: "second", product_id: "second" }),
         row({ variant_id: "blocked", product_id: "blocked", recommendation: false }),
       ],
       loadVariantsByIds: async () => [{ id: "second" }, { id: "blocked" }, { id: "first" }],
    });

    expect(result.map((variant) => variant.id)).toEqual(["first", "second"]);
  });
});
