import { describe, expect, it } from "vitest";

import { isUsmContactVariant, isUsmVariant } from "./usm";

describe("isUsmContactVariant", () => {
  it("returns true for USMUS items without positive stock", () => {
    // Given: USM variants with unavailable or unknown numeric stock.
    // When: their storefront contact state is derived.
    // Then: each variant uses the contact-price presentation.
    expect(isUsmContactVariant({ sku: "USMUS001", stock: 0 })).toBe(true);
    expect(isUsmContactVariant({ sku: "USMUS002", stock: null })).toBe(true);
  });

  it("returns false for positive-stock USM and non-USM variants", () => {
    // Given: a positive-stock USM variant and an unrelated unavailable variant.
    // When: their storefront contact state is derived.
    // Then: only unavailable USM variants use contact-price presentation.
    expect(isUsmContactVariant({ sku: "USMUS003", stock: 1 })).toBe(false);
    expect(isUsmContactVariant({ sku: "VITRA001", stock: 0 })).toBe(false);
  });

  it("recognizes USM independently from stock state", () => {
    // Given: a positive-stock USM and a non-USM SKU.
    // When: their product family is derived.
    // Then: a positive-stock USM can retain its numeric AMIS price.
    expect(isUsmVariant({ sku: "USMUS004", stock: 1 })).toBe(true);
    expect(isUsmVariant({ sku: "VITRA002", stock: 1 })).toBe(false);
  });
});
