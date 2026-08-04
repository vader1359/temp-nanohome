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

  it("marks a discounted product as out of stock when AMIS stock is zero", () => {
    const product = variantToProductGridItem({
      id: "sold-out-sale",
      name: "Product",
      name_vi: "Sản phẩm",
      slug: "product",
      slug_vi: "san-pham",
      sku: "TBLBB00002",
      stock: 0,
      price: 80,
      compare_at_price: 100,
      discount_percent: 20,
      on_sale: true,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
    });

    expect(product.status).toBe("out_of_stock");
  });

  it("localizes the complete Accessories hierarchy in every supported locale", () => {
    const baseVariant = {
      id: "accessory",
      name: "Accessory",
      name_vi: "Phụ kiện",
      slug: "accessory",
      slug_vi: "phu-kien",
      sku: "ACCFH00031",
      stock: 1,
      price: 100,
      compare_at_price: null,
      discount_percent: null,
      on_sale: false,
      in_stock: true,
      packshot_url: null,
      gallery_urls: [],
    };

    const translations = [
      ["accessories", "Phụ kiện", "Accessories", "액세서리"],
      ["vases", "Bình hoa", "Vases", "화병"],
      ["candles", "Chân nến & nến", "Candles & Candle Holders", "촛대 & 캔들"],
      ["books", "Sách", "Books", "도서"],
      ["cushions", "Gối", "Cushions", "쿠션"],
      ["throws", "Khăn & chăn", "Throws & Blankets", "담요"],
      ["miniatures", "Mô hình thu nhỏ", "Miniatures", "미니어처"],
      ["rugs", "Thảm", "Rugs", "러그"],
      ["home-fragrance", "Hương thơm nhà cửa", "Home Fragrance", "홈 프래그런스"],
      ["organizers", "Đồ lưu trữ & sắp xếp", "Organizers", "수납 & 정리용품"],
      ["tote-bags", "Túi tote", "Tote Bags", "토트백"],
      ["drinkware", "Ly & bình nước", "Drinkware", "컵 & 물병"],
      ["pet", "Bộ sưu tập thú cưng", "Pet Collection", "반려동물 컬렉션"],
      ["decoration", "Đồ trang trí", "Decoration", "장식 소품"],
      ["kitchen-textiles", "Đồ vải nhà bếp", "Kitchen Textiles", "키친 텍스타일"],
      ["kids", "Dành cho trẻ em", "For Kids", "어린이용"],
    ] as const;

    for (const [subCategory, vi, en, ko] of translations) {
      const variant = { ...baseVariant, id: subCategory, raw: { filter_sub_category: subCategory } };
      expect(variantToProductGridItem(variant, { locale: "vi" }).subtitle).toBe(vi);
      expect(variantToProductGridItem(variant, { locale: "en" }).subtitle).toBe(en);
      expect(variantToProductGridItem(variant, { locale: "ko" }).subtitle).toBe(ko);
    }
  });
});
