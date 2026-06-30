import { describe, expect, it } from "vitest";

import { getBrandByAirtableId, getBrandBySlug, getBrands, getProductsByBrandAirtableId, getProductsByBrandSlug } from "./brands";

describe("brands exports", () => {
  it("imports every brand query export", () => {
    expect(getBrands).toBeTypeOf("function");
    expect(getBrandBySlug).toBeTypeOf("function");
    expect(getBrandByAirtableId).toBeTypeOf("function");
    expect(getProductsByBrandSlug).toBeTypeOf("function");
    expect(getProductsByBrandAirtableId).toBeTypeOf("function");
  });
});
