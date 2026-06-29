import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: readonly Record<string, never>[] | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly ilike: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly or: ReturnType<typeof vi.fn>;
  readonly overlaps: ReturnType<typeof vi.fn>;
  readonly range: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const eqCalls: Array<readonly [string, string | boolean]> = [];
  const inCalls: Array<readonly [string, readonly string[]]> = [];
  const overlapCalls: Array<readonly [string, readonly string[]]> = [];
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: string | boolean) => {
      eqCalls.push([column, value]);
      return chain;
    }),
    ilike: vi.fn(() => chain),
    in: vi.fn((column: string, value: readonly string[]) => {
      inCalls.push([column, value]);
      return chain;
    }),
    order: vi.fn(() => chain),
    or: vi.fn(() => chain),
    overlaps: vi.fn((column: string, value: readonly string[]) => {
      overlapCalls.push([column, value]);
      return chain;
    }),
    range: vi.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: [{}], error: null }).then(resolve),
  };
  return { chain, eqCalls, from: vi.fn(() => chain), inCalls, overlapCalls };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: state.from })),
}));

import { getProducts, getVariantProducts } from "./products";

beforeEach(() => {
  state.eqCalls.length = 0;
  state.inCalls.length = 0;
  state.overlapCalls.length = 0;
  vi.clearAllMocks();
});

describe("getProducts", () => {
  it("returns visible products when called with the first page", async () => {
    // Given: a mocked Supabase query builder that records equality filters.
    // When: the product list is fetched.
    const rows = await getProducts({ page: 1 });

    // Then: visibility filters and pagination are applied and rows are returned.
    expect(state.eqCalls).toContainEqual(["validated", true]);
    expect(state.eqCalls).toContainEqual(["approved", true]);
    expect(state.chain.range).toHaveBeenCalledWith(0, 23);
    expect(rows).toEqual([{}]);
  });

  it("rejects malformed pagination before building a range", async () => {
    // Given: a negative page value from an untrusted filter boundary.
    // When: the product list is fetched.
    const action = getProducts({ page: -1 });

    // Then: the invalid range is rejected before Supabase sees it.
    await expect(action).rejects.toThrow(RangeError);
  });
});

describe("getVariantProducts", () => {
  it("selects explicit fields instead of the full variant row", async () => {
    // Given: the product grid only needs a bounded set of variant columns.
    // When: variants are fetched for the listing page.
    await getVariantProducts({ page: 1 });

    // Then: the Supabase payload avoids select('*') while keeping critical fields.
    const selectArg = state.chain.select.mock.calls[0]?.[0];
    expect(selectArg).toContain("id");
    expect(selectArg).toContain("slug_vi");
    expect(selectArg).toContain("price");
    expect(selectArg).toContain("filter_brand");
    expect(selectArg).toContain("filter_category");
    expect(selectArg).toContain("filter_sub_category");
    expect(selectArg).toContain("filter_is_new_arrival");
    expect(selectArg).toContain("filter_room_vi");
    expect(selectArg).not.toBe("*");
  });

  it("applies product list filters when options are present", async () => {
    // Given: product-list filters selected by the user.
    // When: variants are fetched for the filtered listing page.
    await getVariantProducts({
      brand: ["knoll"],
      category: ["furniture"],
      room: ["living-room"],
      search: "lamp",
      status: "sale",
      subCategory: ["table-lamps"],
    });

    // Then: each selected filter is applied at the Supabase query boundary.
    expect(state.inCalls).toContainEqual(["filter_brand", ["knoll"]]);
    expect(state.inCalls).toContainEqual(["filter_category", ["furniture"]]);
    expect(state.inCalls).toContainEqual(["filter_sub_category", ["table-lamps"]]);
    expect(state.overlapCalls).toContainEqual(["filter_room", ["living-room"]]);
    expect(state.chain.or).toHaveBeenCalledWith(
      "name_vi.ilike.%lamp%,name.ilike.%lamp%,sku.ilike.%lamp%,finish_vi.ilike.%lamp%,finish.ilike.%lamp%,brand_name_denorm.ilike.%lamp%",
    );
    expect(state.eqCalls).toContainEqual(["on_sale", true]);
  });

  it("prioritizes in-stock new arrivals with lower priority scores by default", async () => {
    // Given: the default product grid sort.
    // When: variants are fetched without an explicit sort.
    await getVariantProducts({ page: 1 });

    // Then: stock status, new-arrival status, and low Supabase priority scores drive the default order.
    expect(state.chain.order).toHaveBeenNthCalledWith(1, "in_stock", { ascending: false, nullsFirst: false });
    expect(state.chain.order).toHaveBeenNthCalledWith(2, "filter_is_new_arrival", { ascending: false, nullsFirst: false });
    expect(state.chain.order).toHaveBeenNthCalledWith(3, "priority", { ascending: true, nullsFirst: false });
  });

  it("maps status filters to stock and sale columns", async () => {
    // Given: stock status filters from the UI.
    // When: each status is queried.
    await getVariantProducts({ status: "in_stock" });
    await getVariantProducts({ status: "out_of_stock" });

    // Then: the status contract maps to the persisted boolean columns.
    expect(state.eqCalls).toContainEqual(["in_stock", true]);
    expect(state.eqCalls).toContainEqual(["in_stock", false]);
  });
});
