import { describe, expect, it, vi } from "vitest";
import { parseFilters } from "@/lib/products/filter-utils";
import { getProductPage } from "@/lib/products/products-service";

vi.mock("@/lib/queries/products", () => ({
  getVariantProducts: vi.fn(() => Promise.resolve([])),
  getVariantProductCount: vi.fn(() => Promise.resolve(0)),
  getVariantProductFacets: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/queries/brands", () => ({
  getProductFilterBrands: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/queries/categories", () => ({
  getCategories: vi.fn(() => Promise.resolve([])),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  setRequestLocale: () => {},
}));

describe("getProductPage", () => {
  it("fetches correctly based on locale and filters", async () => {
    const filters = parseFilters({ brand: ["usm"], q: "desk" });
    const result = await getProductPage("vi", filters);

    expect(result.products).toBeDefined();
    expect(result.totalCount).toBe(0);
    expect(result.filters.brand).toEqual(["usm"]);
    expect(result.filters.q).toBe("desk");
  });
});
