import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: Record<string, never> | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly or: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: {}, error: null }).then(resolve),
  };
  return { chain, from: vi.fn(() => chain) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: state.from })),
}));

import { getVariantById, getVariantBySlug, getVariantsByProductId } from "./variants";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("variants exports", () => {
  it("imports every variant query export", () => {
    expect(getVariantById).toBeTypeOf("function");
    expect(getVariantsByProductId).toBeTypeOf("function");
  });
});

describe("getVariantBySlug", () => {
  it("filters by public slug columns for non-UUID slugs", async () => {
    await getVariantBySlug("ghe-viet");

    expect(state.chain.or).toHaveBeenCalledWith("slug.eq.ghe-viet,slug_vi.eq.ghe-viet");
  });

  it("includes the id filter for UUID detail slugs", async () => {
    const id = "11111111-1111-4111-8111-111111111111";

    await getVariantBySlug(id);

    expect(state.chain.or).toHaveBeenCalledWith(`id.eq.${id},slug.eq.${id},slug_vi.eq.${id}`);
  });
});
