import { describe, expect, it } from "vitest";

import { variantDetailHref } from "./variant-url";

describe("variantDetailHref", () => {
  it("uses the Vietnamese slug when it exists", () => {
    expect(variantDetailHref({ id: "variant-1", slug: "english-slug", slug_vi: "ghe-viet" })).toBe("/products/ghe-viet");
  });

  it("falls back to the default slug", () => {
    expect(variantDetailHref({ id: "variant-1", slug: "english-slug", slug_vi: null })).toBe("/products/english-slug");
  });

  it("falls back to the variant id", () => {
    expect(variantDetailHref({ id: "variant-1", slug: null, slug_vi: null })).toBe("/products/variant-1");
  });
});
