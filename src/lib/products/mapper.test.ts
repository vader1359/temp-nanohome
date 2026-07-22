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

  it("uses contact pricing for an AMIS placeholder price of one", () => {
    const product = variantToProductGridItem({
      id: "contact-price-one",
      name: "Product",
      name_vi: "Sản phẩm",
      slug: "product",
      slug_vi: "san-pham",
      sku: "CHRBB00006",
      stock: 1,
      price: 1,
      compare_at_price: 100,
      discount_percent: 99,
      on_sale: true,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
    });

    expect(product.price).toBe("Liên hệ");
    expect(product.oldPrice).toBeNull();
    expect(product.discount).toBeNull();
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

  it("uses positive AMIS stock even when the legacy availability flag is false", () => {
    const product = variantToProductGridItem({
      id: "amis-stock-is-source-of-truth",
      name: "Product",
      name_vi: "Sản phẩm",
      slug: "product",
      slug_vi: "san-pham",
      sku: "TBLBB00001",
      stock: 1,
      price: 100,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: false,
      packshot_url: null,
      gallery_urls: [],
    });

    expect(product.status).toBe("in_stock");
  });

  it("localizes the vases sub-category", () => {
    const variant = {
      id: "vase",
      name: "Vase",
      name_vi: "Bình hoa",
      slug: "vase",
      slug_vi: "binh-hoa",
      sku: "ACCMT00003",
      stock: 1,
      price: 100,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
      raw: { filter_sub_category: "vases" },
    };

    expect(variantToProductGridItem(variant, { locale: "vi" }).subtitle).toBe("Bình hoa");
    expect(variantToProductGridItem(variant, { locale: "ko" }).subtitle).toBe("화병");
  });

  it("localizes the Accessories sub-category vocabulary", () => {
    const variant = {
      id: "accessory",
      name: "Cushion",
      name_vi: "Gối",
      slug: "cushion",
      slug_vi: "goi",
      sku: "ACCFH00031",
      stock: 1,
      price: 100,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
      raw: { filter_sub_category: "cushions" },
    };

    expect(variantToProductGridItem(variant, { locale: "vi" }).subtitle).toBe("Gối/Cushion");
    expect(variantToProductGridItem(variant, { locale: "ko" }).subtitle).toBe("쿠션");
  });
});
