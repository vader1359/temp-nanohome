import { describe, expect, it } from "vitest";

import { getCategories, getCategoryBySlug } from "./categories";

describe("categories exports", () => {
  it("imports every category query export", () => {
    expect(getCategories).toBeTypeOf("function");
    expect(getCategoryBySlug).toBeTypeOf("function");
  });
});
