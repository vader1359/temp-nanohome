import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: readonly Record<string, never>[] | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly ilike: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly range: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const eqCalls: Array<readonly [string, string | boolean]> = [];
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: string | boolean) => {
      eqCalls.push([column, value]);
      return chain;
    }),
    ilike: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: [{}], error: null }).then(resolve),
  };
  return { chain, eqCalls, from: vi.fn(() => chain) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: state.from })),
}));

import { getProducts, getVariantProducts } from "./products";

beforeEach(() => {
  state.eqCalls.length = 0;
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
    expect(selectArg).not.toBe("*");
  });
});
