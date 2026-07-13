import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: readonly Record<string, unknown>[] | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly range: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const calls: Array<readonly [string, string]> = [];
  const brandQuery: QueryMock = {
    eq: vi.fn(() => brandQuery),
    in: vi.fn(() => brandQuery),
    order: vi.fn(() => brandQuery),
    range: vi.fn(() => brandQuery),
    select: vi.fn(() => brandQuery),
    then: (resolve) => Promise.resolve({ data: [{ id: "brand-fritz", name: "Fritz Hansen" }], error: null }).then(resolve),
  };
  const productQuery: QueryMock = {
    eq: vi.fn(() => productQuery),
    in: vi.fn(() => productQuery),
    order: vi.fn(() => productQuery),
    range: vi.fn(() => productQuery),
    select: vi.fn(() => productQuery),
    then: (resolve) => Promise.resolve({ data: [{ brand_id: "brand-fritz" }], error: null }).then(resolve),
  };

  return {
    brandQuery,
    calls,
    createClient: vi.fn(async () => ({
      from: (table: string) => {
        calls.push(["from", table]);
        return table === "products" ? productQuery : brandQuery;
      },
    })),
    productQuery,
  };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: state.createClient }));

import {
  getBrandByAirtableId,
  getBrandBySlug,
  getBrands,
  getBrandsForVariants,
  getProductsByBrandAirtableId,
  getProductsByBrandSlug,
} from "./brands";

describe("brands exports", () => {
  it("imports every brand query export", () => {
    expect(getBrands).toBeTypeOf("function");
    expect(getBrandsForVariants).toBeTypeOf("function");
    expect(getBrandBySlug).toBeTypeOf("function");
    expect(getBrandByAirtableId).toBeTypeOf("function");
    expect(getProductsByBrandSlug).toBeTypeOf("function");
    expect(getProductsByBrandAirtableId).toBeTypeOf("function");
  });
});

describe("getBrandsForVariants", () => {
  beforeEach(() => {
    state.calls.length = 0;
    vi.clearAllMocks();
  });

  it("derives a validated brand from a validated parent when the variant has no brand", async () => {
    // Given: a matching variant whose validated parent owns the Fritz Hansen relationship.
    const relations = { productIds: ["product-ikebana"], variantBrandIds: [] };

    // When: related brands are fetched.
    const brands = await getBrandsForVariants(relations);

    // Then: the parent relationship supplies the visible bounded brand result.
    expect(state.calls).toEqual([["from", "products"], ["from", "brands"]]);
    expect(state.productQuery.eq).toHaveBeenCalledWith("validated", true);
    expect(state.productQuery.in).toHaveBeenCalledWith("id", ["product-ikebana"]);
    expect(state.brandQuery.eq).toHaveBeenCalledWith("validated", true);
    expect(state.brandQuery.in).toHaveBeenCalledWith("id", ["brand-fritz"]);
    expect(state.brandQuery.order).toHaveBeenNthCalledWith(1, "name", { ascending: true });
    expect(state.brandQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(state.brandQuery.range).toHaveBeenCalledWith(0, 5);
    expect(brands).toEqual([{ id: "brand-fritz", name: "Fritz Hansen" }]);
  });
});
