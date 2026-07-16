import { describe, expect, it } from "vitest";

import { variantDetailHref } from "./variant-url";

describe("variantDetailHref", () => {
  it("uses the Korean slug when it exists for Korean routes", () => {
    // Given: a variant with translated Korean and Vietnamese slugs.
    const variant = { id: "variant-1", slug: "english-slug", slug_vi: "ghe-viet", slug_ko: "한국-의자" };

    // When: a Korean product URL is built.
    const href = variantDetailHref(variant, "ko");

    // Then: the Korean slug takes precedence.
    expect(href).toBe("/products/%ED%95%9C%EA%B5%AD-%EC%9D%98%EC%9E%90");
  });

  it("uses the Vietnamese slug when it exists for Vietnamese routes", () => {
    // Given: a variant with a Vietnamese slug.
    const variant = { id: "variant-1", slug: "english-slug", slug_vi: "ghe-viet", slug_ko: null };

    // When: a Vietnamese product URL is built.
    const href = variantDetailHref(variant, "vi");

    // Then: the Vietnamese slug takes precedence.
    expect(href).toBe("/products/ghe-viet");
  });

  it("falls back from a missing Korean slug to the default slug", () => {
    // Given: a Korean route without a translated slug.
    const variant = { id: "variant-1", slug: "english-slug", slug_vi: "ghe-viet", slug_ko: null };

    // When: a Korean product URL is built.
    const href = variantDetailHref(variant, "ko");

    // Then: the canonical English slug is used before Vietnamese fallback.
    expect(href).toBe("/products/english-slug");
  });

  it("falls back to the variant id", () => {
    // Given: a variant without a localized or canonical slug.
    const variant = { id: "variant-1", slug: null, slug_vi: null, slug_ko: null };

    // When: an English product URL is built.
    const href = variantDetailHref(variant, "en");

    // Then: the stable variant id is used.
    expect(href).toBe("/products/variant-1");
  });

  it("ignores a truncated localized slug and uses the canonical slug", () => {
    const variant = {
      id: "variant-1",
      slug: "kaiser-idell-6631-t-luxus",
      slug_vi: "this-response-was-truncated-by-the-cut-off-limit-max-tokens-open-the-sidebar",
      slug_ko: null,
    };

    expect(variantDetailHref(variant, "vi")).toBe("/products/kaiser-idell-6631-t-luxus");
  });
});
