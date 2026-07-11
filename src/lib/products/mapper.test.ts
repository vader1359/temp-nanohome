import { describe, expect, it } from "vitest";

import { variantToProductGridItem } from "./mapper";

describe("variantToProductGridItem", () => {
  it("keeps a zero AMIS price visible for an in-stock USM variant", () => {
    // Given: a USM variant with confirmed positive stock and a zero local price.
    const variant = {
      id: "usm-positive-zero-price",
      name: "USM Haller",
      name_vi: "USM Haller",
      slug: "usm-haller",
      slug_vi: "usm-haller",
      sku: "USMUS005",
      stock: 1,
      price: 0,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
    };

    // When: the storefront grid item is mapped.
    const product = variantToProductGridItem(variant);

    // Then: the zero AMIS price remains numeric rather than changing to contact.
    expect(product.price).toMatch(/^0\s₫$/u);
  });

  it("uses the catalog fallback image when a packshot-only item has no media", () => {
    // Given: a catalog item with no packshot or gallery media.
    const variant = {
      id: "missing-packshot",
      name: "Product",
      name_vi: "Sản phẩm",
      slug: "product",
      slug_vi: "san-pham",
      sku: "VITRA003",
      stock: 1,
      price: 100,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
    };

    // When: the homepage requests a packshot-only product card.
    const product = variantToProductGridItem(variant, { packshotOnly: true });

    // Then: the card has a real fallback image rather than an empty frame.
    expect(product.imageUrl).toBe("/images/p_lc2.png");
  });
});
