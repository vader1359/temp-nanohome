import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { readonly data: readonly Record<string, string | null>[] | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly or: ReturnType<typeof vi.fn>;
  readonly not: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly range: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const eqCalls: Array<readonly [string, boolean]> = [];
  const orCalls: string[] = [];
  const orderCalls: Array<readonly [string, Record<string, boolean>]> = [];
  const rangeCalls: Array<readonly [number, number]> = [];
  const tableCalls: string[] = [];
  const notCalls: Array<readonly [string, string, null]> = [];
  const queryResults: QueryResult[] = [];
  const chain: QueryMock = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: boolean) => {
      eqCalls.push([column, value]);
      return chain;
    }),
    or: vi.fn((filter: string) => {
      orCalls.push(filter);
      return chain;
    }),
    not: vi.fn((column: string, operator: string, value: null) => {
      notCalls.push([column, operator, value]);
      return chain;
    }),
    order: vi.fn((column: string, options: Record<string, boolean>) => {
      orderCalls.push([column, options]);
      return chain;
    }),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      return chain;
    }),
    then: (resolve) => Promise.resolve(queryResults.shift() ?? { data: [{ id: "product" }], error: null }).then(resolve),
  };
  return {
    chain,
    eqCalls,
    from: vi.fn((table: string) => {
      tableCalls.push(table);
      return chain;
    }),
    notCalls,
    orCalls,
    orderCalls,
    queryResults,
    rangeCalls,
    tableCalls,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: state.from })),
}));

import { createClient } from "@/lib/supabase/server";

import { searchProducts } from "./search";

function splitTopLevelOrFilter(filter: string): readonly string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  let depth = 0;

  for (const character of filter) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quoted) {
      current += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      current += character;
      continue;
    }

    if (!quoted && character === "(") {
      depth += 1;
    }

    if (!quoted && character === ")") {
      depth -= 1;
    }

    if (!quoted && depth === 0 && character === ",") {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

describe("searchProducts", () => {
  beforeEach(() => {
    state.eqCalls.length = 0;
    state.orCalls.length = 0;
    state.orderCalls.length = 0;
    state.notCalls.length = 0;
    state.queryResults.length = 0;
    state.rangeCalls.length = 0;
    state.tableCalls.length = 0;
    state.from.mockClear();
    state.chain.select.mockClear();
    state.chain.eq.mockClear();
    state.chain.or.mockClear();
    state.chain.not.mockClear();
    state.chain.order.mockClear();
    state.chain.range.mockClear();
    vi.mocked(createClient).mockClear();
  });

  it("imports every search query export", () => {
    expect(searchProducts).toBeTypeOf("function");
  });

  it("returns an empty result without calling Supabase when the query is blank", async () => {
    // Given: a whitespace-only search submitted by a route handler.
    // When: product search runs.
    const rows = await searchProducts("   ", "vi");

    // Then: the boundary rejects the empty search before any Supabase query is built.
    expect(rows).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses PGroonga and visibility filters for Vietnamese product and variant search", async () => {
    // Given: a Vietnamese search term and second-page pagination.
    state.queryResults.push(
      { data: [{ product_id: "product-from-variant" }], error: null },
      { data: [{ id: "product" }], error: null }
    );

    // When: product search runs.
    const rows = await searchProducts(" đèn ", "vi", { page: 2, pageSize: 10 });

    // Then: the backend contract includes visibility filters, PGroonga, variant fields, ranking order, and range.
    expect(state.tableCalls).toEqual(["variants", "products"]);
    expect(state.chain.select).toHaveBeenCalledWith(
      "*, variants(name,sku,finish,finish_vi,validated,approved)"
    );
    expect(state.eqCalls).toContainEqual(["validated", true]);
    expect(state.eqCalls).toContainEqual(["approved", true]);
    expect(state.eqCalls).toContainEqual(["variants.validated", true]);
    expect(state.eqCalls).toContainEqual(["variants.approved", true]);
    expect(state.orCalls[0]).toContain("finish_vi.&@~.đèn");
    expect(state.orCalls[0]).toContain("sku.&@~.đèn");
    expect(state.notCalls).toContainEqual(["product_id", "is", null]);
    expect(state.orCalls[1]).toContain("name_vi.&@~.đèn");
    expect(state.orCalls[1]).toContain("description_vi.&@~.đèn");
    expect(state.orCalls[1]).toContain("name.&@~.đèn");
    expect(state.orCalls[1]).toContain("description.&@~.đèn");
    expect(state.orCalls[1]).toContain("id.in.(product-from-variant)");
    expect(state.orderCalls[0]).toEqual([
      "name_vi",
      { ascending: true, nullsFirst: false },
    ]);
    expect(state.rangeCalls).toContainEqual([10, 19]);
    expect(rows).toEqual([{ id: "product" }]);
  });

  it("prioritizes English fields while allowing cross-locale matches", async () => {
    // Given: an English search term.
    state.queryResults.push({ data: [], error: null }, { data: [{ id: "product" }], error: null });

    // When: product search runs.
    await searchProducts("lamp", "en");

    // Then: English columns lead the PGroonga disjunction and Vietnamese columns remain searchable.
    expect(state.orCalls[0].startsWith("name.&@~.lamp,sku.&@~.lamp")).toBe(true);
    expect(state.orCalls[0]).toContain("finish_vi.&@~.lamp");
    expect(state.orCalls[1].startsWith("name.&@~.lamp,description.&@~.lamp")).toBe(true);
    expect(state.orCalls[1]).toContain("name_vi.&@~.lamp");
    expect(state.orCalls[1]).toContain("description_vi.&@~.lamp");
    expect(state.orderCalls[0]).toEqual(["name", { ascending: true, nullsFirst: false }]);
  });

  it("quotes malformed search grammar characters before building PGroonga OR filters", async () => {
    // Given: a user search containing PostgREST OR grammar separators and grouping characters.
    const malformedQuery = "lamp,shade.(sale)";
    state.queryResults.push({ data: [], error: null }, { data: [{ id: "product" }], error: null });

    // When: product search builds variant and product PGroonga filters.
    await searchProducts(malformedQuery, "en");

    // Then: the raw query remains one quoted operand per searchable field instead of splitting the OR grammar.
    expect(splitTopLevelOrFilter(state.orCalls[0] ?? "")).toEqual([
      'name.&@~."lamp,shade.(sale)"',
      'sku.&@~."lamp,shade.(sale)"',
      'finish.&@~."lamp,shade.(sale)"',
      'finish_vi.&@~."lamp,shade.(sale)"',
    ]);
    expect(splitTopLevelOrFilter(state.orCalls[1] ?? "")).toEqual([
      'name.&@~."lamp,shade.(sale)"',
      'description.&@~."lamp,shade.(sale)"',
      'name_vi.&@~."lamp,shade.(sale)"',
      'description_vi.&@~."lamp,shade.(sale)"',
    ]);
  });
});
