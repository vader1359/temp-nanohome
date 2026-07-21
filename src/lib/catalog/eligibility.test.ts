import { describe, expect, it } from "vitest";
import { isCatalogEligibleFor, isPaymentEligible, parseCatalogEligibilityRow } from "./eligibility";

const row = {
  variant_id: "v",
  product_id: "p",
  brand_id: "b",
  sku: "sku-v",
  variant_slug: "variant-v",
  variant_name: "Variant V",
  localized_name: "Biến thể V",
  product_slug: "product-p",
  product_name: "Product P",
  localized_product_name: "Sản phẩm P",
  brand_slug: "brand-b",
  brand_name: "Brand B",
  image_url: "https://example.com/image.jpg",
  price: 10,
  stock: 1,
  price_mode: "fixed",
  has_fresh_stock: true,
  has_supported_media: true,
  catalog_approved_validated: true,
  hidden_brand_sku: false,
  reason_codes: [],
  storefront: true,
  recommendation: true,
  visual_match: true,
  cart: true,
  payment: true,
} satisfies Parameters<typeof parseCatalogEligibilityRow>[0];

describe("catalog eligibility adapter", () => {
  it("Given an approved and validated row, When parsed, Then every capability is available", () => {
    const parsed = parseCatalogEligibilityRow(row);
    expect(isCatalogEligibleFor(parsed, "storefront")).toBe(true);
    expect(isPaymentEligible(parsed)).toBe(true);
  });

  it("Given an approved but unvalidated row, When parsed, Then capability denial is preserved", () => {
    const parsed = parseCatalogEligibilityRow({ ...row, catalog_approved_validated: false, reason_codes: ["variant_not_validated"], storefront: false, recommendation: false, visual_match: false, cart: false, payment: false });
    expect(isCatalogEligibleFor(parsed, "recommendation")).toBe(false);
  });

  it("Given a database row with an unknown field, When parsed, Then the boundary rejects it", () => {
    expect(() => parseCatalogEligibilityRow({ ...row, unexpected: "private" })).toThrow();
  });
});
