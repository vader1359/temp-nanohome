import { describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  return { chain, from: vi.fn(() => chain) };
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
});
