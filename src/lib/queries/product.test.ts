import { describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
};

type DetailQueryResult = { readonly data: unknown; readonly error: Error | null };

type DetailQueryMock = PromiseLike<DetailQueryResult> & {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly neq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

type SupabaseQueryMock = QueryMock | DetailQueryMock;

function detailQuery(result: Promise<DetailQueryResult>): DetailQueryMock {
  const query: DetailQueryMock = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    then: (resolve) => result.then(resolve),
  };

  return query;
}

const state = vi.hoisted(() => {
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  return { chain, from: vi.fn<(table: string) => SupabaseQueryMock>(() => chain) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: state.from })),
}));

import { getProductByAirtableId } from "./product";

describe("getProductByAirtableId", () => {
  it("returns null when the product does not exist", async () => {
    // Given: Supabase returns no product for the Airtable id.
    // When: the product detail query runs.
    const product = await getProductByAirtableId("nonexistent");

    // Then: callers receive null instead of an exception.
    expect(product).toBeNull();
  });

  it("starts related products and linked news requests together for an existing product", async () => {
    // Given: the related-products request is slow but linked news is immediately available.
    let resolveRelated: (result: DetailQueryResult) => void = () => {};
    const related = new Promise<DetailQueryResult>((resolve) => {
      resolveRelated = resolve;
    });
    const product = detailQuery(
      Promise.resolve({
        data: {
          brands: null,
          categories: null,
          category_id: "chairs",
          designers: null,
          id: "product-1",
          variants: null,
        },
        error: null,
      }),
    );
    const relatedProducts = detailQuery(related);
    const linkedNews = detailQuery(Promise.resolve({ data: [], error: null }));
    let productQueries = 0;

    state.from.mockClear();
    state.from.mockImplementation((table: string) => {
      switch (table) {
        case "products":
          productQueries += 1;
          return productQueries === 1 ? product : relatedProducts;
        case "news_products":
          return linkedNews;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    // When: the product detail query runs while related products are pending.
    const detail = getProductByAirtableId("airtable-product-1");

    // Then: linked-news lookup starts without waiting for related products.
    await vi.waitFor(() => expect(state.from).toHaveBeenCalledWith("news_products"));

    resolveRelated({ data: [], error: null });
    await expect(detail).resolves.toMatchObject({ id: "product-1", news: [], related: [] });
  });
});
