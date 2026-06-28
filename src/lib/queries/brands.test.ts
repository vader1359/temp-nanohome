import { describe, expect, it } from "vitest";

import { getBrandBySlug, getBrands, getProductsByBrandSlug } from "./brands";

describe("brands exports", () => {
  it("imports every brand query export", () => {
    expect(getBrands).toBeTypeOf("function");
    expect(getBrandBySlug).toBeTypeOf("function");
    expect(getProductsByBrandSlug).toBeTypeOf("function");
  });
});
