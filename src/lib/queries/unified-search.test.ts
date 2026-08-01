import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getBrandsForVariants: vi.fn(async (): Promise<readonly unknown[]> => []),
  getCategories: vi.fn(async (): Promise<readonly unknown[]> => []),
  getDesignersForProducts: vi.fn(async (): Promise<readonly unknown[]> => []),
  getVariantProducts: vi.fn(async (): Promise<readonly unknown[]> => []),
  searchNews: vi.fn(async (): Promise<readonly unknown[]> => []),
}));

vi.mock("./brands", () => ({ getBrandsForVariants: state.getBrandsForVariants }));
vi.mock("./categories", () => ({ getCategories: state.getCategories }));
vi.mock("./designers", () => ({ getDesignersForProducts: state.getDesignersForProducts }));
vi.mock("./news", () => ({ searchNews: state.searchNews }));
vi.mock("./products", () => ({ getVariantProducts: state.getVariantProducts }));

import { normalizeSearchQuery, unifiedSearch } from "./unified-search";

describe("unifiedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes Unicode and collapses whitespace at the search boundary", () => {
    // Given: decomposed Unicode surrounded by repeated whitespace.
    // When: the query is parsed.
    const query = normalizeSearchQuery("  IKE\u0301BANA\t\n table  ");

    // Then: all sections receive the same canonical query.
    expect(query).toBe("IKÉBANA table");
  });

  it("limits normalized queries to 200 characters", () => {
    // Given: a query beyond the public search limit.
    // When: it is parsed at the input boundary.
    const query = normalizeSearchQuery("x".repeat(201));

    // Then: every downstream section receives the bounded input.
    expect(query).toHaveLength(200);
  });

  it("omits blank searches without querying a topic", async () => {
    // Given: a whitespace-only route query.
    // When: aggregate search runs.
    const result = await unifiedSearch(" \n ", "vi");

    // Then: no data boundary is called.
    expect(result.query).toBe("");
    expect(state.getVariantProducts).not.toHaveBeenCalled();
    expect(state.getBrandsForVariants).not.toHaveBeenCalled();
    expect(state.getCategories).not.toHaveBeenCalled();
    expect(state.getDesignersForProducts).not.toHaveBeenCalled();
    expect(state.searchNews).not.toHaveBeenCalled();
  });

  it("derives Ikebana's Fritz Hansen brand and Jaime Hayon designer from matching variants", async () => {
    // Given: a matching Ikebana variant with a parent product relationship.
    state.getVariantProducts.mockResolvedValue([{ brand_id: null, designer_id: "designer-jaime", id: "variant-ikebana", product_id: "product-ikebana" }]);
    state.getBrandsForVariants.mockResolvedValue([{ id: "brand-fritz", name: "Fritz Hansen" }]);
    state.getCategories.mockResolvedValue([{ id: "category-1", name: "Ikebana", name_vi: null, name_ko: null, slug: "ikebana" }]);
    state.getDesignersForProducts.mockResolvedValue([{ id: "designer-jaime", name: "Jaime Hayon" }]);

    // When: the Korean search route requests Ikebana.
    const result = await unifiedSearch(" Ikebana ", "ko");

    // Then: the catalog query and relationship sections share canonical product identifiers.
    expect(state.getVariantProducts).toHaveBeenCalledWith({ page: 1, pageSize: 6, search: "Ikebana", sort: "priority" });
    expect(state.getBrandsForVariants).toHaveBeenCalledWith({ productIds: ["product-ikebana"], variantBrandIds: [] });
    expect(state.getDesignersForProducts).toHaveBeenCalledWith({ productIds: ["product-ikebana"], variantDesignerIds: ["designer-jaime"] });
    expect(state.searchNews).toHaveBeenCalledWith("Ikebana", "ko", { pageSize: 6 });
    expect(result.products.items).toEqual([{ brand_id: null, designer_id: "designer-jaime", id: "variant-ikebana", product_id: "product-ikebana" }]);
    expect(result.brands.items).toEqual([{ id: "brand-fritz", name: "Fritz Hansen" }]);
    expect(result.designers.items).toEqual([{ id: "designer-jaime", name: "Jaime Hayon" }]);
  });

  it("prioritizes product-name matches over other matching fields", async () => {
    state.getVariantProducts.mockResolvedValue([
      { id: "variant-sku-match", name: "Chair", sku: "BALCONY-01" },
      { id: "variant-name-match", name: "Balcony Chair", sku: "CHAIR-01" },
    ]);

    const result = await unifiedSearch("balcony", "en");

    expect(result.products.items.map((variant) => variant.id)).toEqual(["variant-name-match", "variant-sku-match"]);
  });

  it("bounds the aggregate product preview to six results", async () => {
    state.getVariantProducts.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      id: `variant-${index + 1}`,
      name: `Chair ${index + 1}`,
    })));

    const result = await unifiedSearch("chair", "en");

    expect(state.getVariantProducts).toHaveBeenCalledWith({ page: 1, pageSize: 6, search: "chair", sort: "priority" });
    expect(result.products.items).toHaveLength(6);
  });

  it("isolates each independent source failure while retaining successful sections", async () => {
    // Given: a matching variant and each related source failing in turn.
    const cases = [
      ["products", state.getVariantProducts],
      ["brands", state.getBrandsForVariants],
      ["categories", state.getCategories],
      ["designers", state.getDesignersForProducts],
      ["news", state.searchNews],
    ] as const;

    // When: each source becomes unavailable during an aggregate search.
    for (const [sectionName, rejectedSource] of cases) {
      vi.resetAllMocks();
      state.getVariantProducts.mockResolvedValue([{ brand_id: "brand-1", id: "variant-1", product_id: "product-1" }]);
      state.getBrandsForVariants.mockResolvedValue([]);
      state.getCategories.mockResolvedValue([]);
      state.getDesignersForProducts.mockResolvedValue([]);
      state.searchNews.mockResolvedValue([]);
      rejectedSource.mockRejectedValue(new Error("source unavailable"));
      const result = await unifiedSearch("Ikebana", "en");

      // Then: the rejected source alone exposes its unavailable state.
      expect(result[sectionName].hasError).toBe(true);
      expect([
        result.products,
        result.brands,
        result.categories,
        result.designers,
        result.news,
      ].filter((section) => section.hasError)).toHaveLength(1);
      if (sectionName !== "products") {
        expect(result.products.items).toEqual([{ brand_id: "brand-1", id: "variant-1", product_id: "product-1" }]);
      }
    }
  });
});
