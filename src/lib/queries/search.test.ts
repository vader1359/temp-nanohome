import { describe, expect, it } from "vitest";

import { postgrestFilterValue } from "./search";

describe("postgrestFilterValue", () => {
  it("quotes PostgREST grammar characters in a user search term", () => {
    // Given: a search term that includes OR grammar separators.
    // When: it crosses the query boundary.
    const value = postgrestFilterValue("lamp,shade.(sale)");

    // Then: it remains one literal ILIKE operand.
    expect(value).toBe('"lamp,shade.(sale)"');
  });
});
